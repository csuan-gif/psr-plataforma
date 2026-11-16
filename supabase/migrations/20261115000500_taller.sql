-- =====================================================================
-- 0005 · Panel del taller (Fase 2): bandeja, agenda y citas.
-- Todas exigen sesión del taller (psr_privado.es_taller()).
-- =====================================================================

create or replace function psr_privado.exigir_taller() returns void
language plpgsql stable security definer set search_path = public, psr_privado as $$
begin
  if not psr_privado.es_taller() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
end $$;

-- Cupos por franja con lo usado (vista interna del taller).
create or replace function public.cupos_taller(p_desde date, p_hasta date)
returns table (fecha date, franja text, cupos int, usados int, motivo text)
language plpgsql stable security definer set search_path = public, psr_privado as $$
begin
  perform psr_privado.exigir_taller();
  if p_hasta < p_desde or p_hasta - p_desde > 62 then raise exception 'DATOS_INVALIDOS: rango de fechas'; end if;
  return query
  select d::date, fr.franja,
         case when coalesce(disp.activo, false) then coalesce(disp.cupos, 0)::int else 0 end,
         (select count(*)::int from public.citas c
           where c.fecha = d::date and c.franja = fr.franja and c.estado in ('pendiente', 'confirmada', 'reprogramada')),
         case
           when exists (select 1 from public.festivos fe where fe.fecha = d::date) then (select 'Festivo: ' || fe.nombre from public.festivos fe where fe.fecha = d::date)
           when exists (select 1 from public.dias_bloqueados b where b.fecha = d::date and (b.franja is null or b.franja = fr.franja))
             then 'Cerrado' || coalesce(': ' || (select b.motivo from public.dias_bloqueados b where b.fecha = d::date and (b.franja is null or b.franja = fr.franja) limit 1), '')
         end
    from generate_series(p_desde, p_hasta, interval '1 day') d
   cross join (values ('manana'), ('tarde')) fr (franja)
    left join public.disponibilidad disp on disp.dia_semana = extract(dow from d)::int and disp.franja = fr.franja
   order by 1, 2;
end $$;

-- ¿Hay cupo en una franja? (excluye opcionalmente una cita que se está moviendo)
create or replace function psr_privado.hay_cupo(p_fecha date, p_franja text, p_excluir uuid default null) returns boolean
language sql stable security definer set search_path = public, psr_privado as $$
  select coalesce((
    select disp.activo and disp.cupos > (
             select count(*) from public.citas c
              where c.fecha = p_fecha and c.franja = p_franja and c.estado in ('pendiente', 'confirmada', 'reprogramada')
                and c.id is distinct from p_excluir)
      from public.disponibilidad disp
     where disp.dia_semana = extract(dow from p_fecha)::int and disp.franja = p_franja), false)
  and not exists (select 1 from public.festivos fe where fe.fecha = p_fecha)
  and not exists (select 1 from public.dias_bloqueados b where b.fecha = p_fecha and (b.franja is null or b.franja = p_franja))
$$;

-- Detalle completo de una solicitud. Queda en auditoría (quién vio datos personales).
create or replace function public.ver_solicitud(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare r jsonb;
begin
  perform psr_privado.exigir_taller();
  select jsonb_build_object(
    'id', s.id, 'codigo', s.codigo_seguimiento, 'creadoEn', s.creado_en, 'estado', s.estado, 'canal', s.canal,
    'zonas', to_jsonb(s.zonas), 'sintomas', to_jsonb(s.sintomas), 'descripcion', s.descripcion,
    'movilidad', s.puede_movilizarse, 'desdeCuando', s.desde_cuando, 'adjuntos', s.adjuntos,
    'presupuesto', s.autoriza_presupuesto, 'pruebaRuta', s.autoriza_prueba_ruta, 'kmReportado', s.km_reportado,
    'datosReportados', s.datos_reportados,
    'cliente', jsonb_build_object('id', c.id, 'tipoDocumento', c.tipo_documento, 'numeroDocumento', c.numero_documento,
       'digitoVerificacion', c.digito_verificacion, 'nombre', c.nombre_razon_social, 'celular', c.celular, 'correo', c.correo,
       'direccion', concat_ws(', ', c.direccion, c.barrio_municipio), 'verificado', c.verificado),
    'vehiculo', jsonb_build_object('id', v.id, 'placa', v.placa, 'marca', v.marca, 'linea', v.linea_modelo, 'anio', v.anio_modelo,
       'color', v.color, 'vin', v.vin, 'combustible', v.combustible_tipo, 'km', v.km_ultimo, 'tarjeta', v.foto_tarjeta_propiedad),
    'semaforo', jsonb_build_object('auto', t.semaforo_auto, 'final', t.semaforo_final, 'razones', t.razones, 'motivo', t.motivo_cambio),
    'cita', (select jsonb_build_object('id', ci.id, 'fecha', ci.fecha, 'franja', ci.franja, 'estado', ci.estado, 'notas', ci.notas)
               from public.citas ci where ci.solicitud_id = s.id order by ci.creado_en desc limit 1),
    'cambios', coalesce((select jsonb_agg(jsonb_build_object('de', cs.de, 'a', cs.a, 'motivo', cs.motivo, 'fecha', cs.fecha,
                                 'usuario', (select p.nombre from public.perfiles p where p.id = cs.usuario)) order by cs.fecha)
                           from public.cambios_semaforo cs where cs.solicitud_id = s.id), '[]'))
    into r
    from public.solicitudes s
    join public.clientes c on c.id = s.cliente_id
    join public.vehiculos v on v.id = s.vehiculo_id
    join public.triage_interno t on t.solicitud_id = s.id
   where s.id = p_id;
  if r is null then raise exception 'NO_ENCONTRADO'; end if;
  insert into public.auditoria (usuario, accion, tabla, registro) values (auth.uid(), 'ver', 'clientes', r -> 'cliente' ->> 'id');
  return r;
end $$;

create or replace function public.marcar_solicitud(p_id uuid, p_estado text) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
begin
  perform psr_privado.exigir_taller();
  if p_estado not in ('nueva', 'en_revision', 'atendida', 'descartada') then raise exception 'DATOS_INVALIDOS'; end if;
  update public.solicitudes set estado = p_estado where id = p_id;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
end $$;

-- Confirmar, cancelar (rechazar) o marcar no asistió. Ninguna cita se confirma sola.
create or replace function public.cambiar_estado_cita(p_cita uuid, p_estado text, p_nota text default null) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_sol uuid;
begin
  perform psr_privado.exigir_taller();
  if p_estado not in ('confirmada', 'cancelada', 'no_asistio', 'pendiente') then raise exception 'DATOS_INVALIDOS'; end if;
  update public.citas
     set estado = p_estado,
         confirmada_por = case when p_estado = 'confirmada' then auth.uid() else confirmada_por end,
         confirmada_en  = case when p_estado = 'confirmada' then now() else confirmada_en end,
         notas = coalesce(nullif(trim(p_nota), ''), notas)
   where id = p_cita
  returning solicitud_id into v_sol;
  if v_sol is null then raise exception 'NO_ENCONTRADO'; end if;
  update public.solicitudes set estado = 'en_revision' where id = v_sol and estado = 'nueva';
  insert into public.auditoria (usuario, accion, tabla, registro, detalle)
  values (auth.uid(), 'cita_' || p_estado, 'citas', p_cita::text, jsonb_build_object('nota', p_nota));
end $$;

-- Mover una cita. Si la franja está llena solo se permite con p_forzar (sobrecupo consciente).
create or replace function public.reprogramar_cita(p_cita uuid, p_fecha date, p_franja text, p_forzar boolean default false) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_ant record;
begin
  perform psr_privado.exigir_taller();
  if p_franja not in ('manana', 'tarde') then raise exception 'DATOS_INVALIDOS'; end if;
  perform pg_advisory_xact_lock(hashtext('cita:' || p_fecha || p_franja));
  select fecha, franja into v_ant from public.citas where id = p_cita for update;
  if v_ant.fecha is null then raise exception 'NO_ENCONTRADO'; end if;
  if not coalesce(p_forzar, false) and not psr_privado.hay_cupo(p_fecha, p_franja, p_cita) then
    raise exception 'CUPO_LLENO' using errcode = 'P0409';
  end if;
  update public.citas set fecha = p_fecha, franja = p_franja, estado = 'reprogramada' where id = p_cita;
  insert into public.auditoria (usuario, accion, tabla, registro, detalle)
  values (auth.uid(), 'cita_reprogramada', 'citas', p_cita::text,
          jsonb_build_object('de', v_ant.fecha || ' ' || v_ant.franja, 'a', p_fecha || ' ' || p_franja, 'forzada', p_forzar));
end $$;

-- Crear una cita desde el taller (queda confirmada porque la decide el taller).
create or replace function public.crear_cita_taller(p_solicitud uuid, p_fecha date, p_franja text, p_forzar boolean default false) returns uuid
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_id uuid;
begin
  perform psr_privado.exigir_taller();
  if p_franja not in ('manana', 'tarde') then raise exception 'DATOS_INVALIDOS'; end if;
  perform pg_advisory_xact_lock(hashtext('cita:' || p_fecha || p_franja));
  if not coalesce(p_forzar, false) and not psr_privado.hay_cupo(p_fecha, p_franja) then
    raise exception 'CUPO_LLENO' using errcode = 'P0409';
  end if;
  update public.citas set estado = 'cancelada', notas = 'Reemplazada por una cita nueva'
   where solicitud_id = p_solicitud and estado in ('pendiente', 'confirmada', 'reprogramada');
  insert into public.citas (solicitud_id, fecha, franja, estado, confirmada_por, confirmada_en)
  values (p_solicitud, p_fecha, p_franja, 'confirmada', auth.uid(), now()) returning id into v_id;
  update public.solicitudes set estado = 'en_revision' where id = p_solicitud and estado = 'nueva';
  return v_id;
end $$;

-- Permisos de las funciones nuevas: solo usuarios autenticados (y dentro, solo el taller).
revoke execute on function psr_privado.exigir_taller(), psr_privado.hay_cupo(date, text, uuid) from public, anon, authenticated;
revoke execute on function public.cupos_taller(date, date), public.ver_solicitud(uuid), public.marcar_solicitud(uuid, text),
  public.cambiar_estado_cita(uuid, text, text), public.reprogramar_cita(uuid, date, text, boolean),
  public.crear_cita_taller(uuid, date, text, boolean) from public, anon;
grant execute on function public.cupos_taller(date, date), public.ver_solicitud(uuid), public.marcar_solicitud(uuid, text),
  public.cambiar_estado_cita(uuid, text, text), public.reprogramar_cita(uuid, date, text, boolean),
  public.crear_cita_taller(uuid, date, text, boolean) to authenticated;

-- Presencia ("otro usuario está viendo esta solicitud") en un canal PRIVADO de Realtime:
-- solo el taller puede escuchar o publicar en él.
create policy taller_presencia_leer on realtime.messages for select to authenticated
  using (realtime.topic() = 'taller-presencia' and psr_privado.es_taller());
create policy taller_presencia_publicar on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'taller-presencia' and psr_privado.es_taller());
