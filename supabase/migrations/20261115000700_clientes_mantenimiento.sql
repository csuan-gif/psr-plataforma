-- =====================================================================
-- 0007 · Base de clientes e historial, importación desde Excel,
-- mantenimiento preventivo (km/día, recordatorios, SOAT y RTM),
-- "Mi mantenimiento" del cliente y supresión de datos (Ley 1581).
-- =====================================================================

alter table public.clientes add column origen text not null default 'portal' check (origen in ('portal', 'importado', 'taller'));
alter table public.clientes add column acepta_recordatorios boolean not null default true; -- el cliente puede pedir no recibir más

alter table public.recordatorios add column tipo text not null default 'mantenimiento' check (tipo in ('mantenimiento', 'soat', 'tecnomecanica'));
alter table public.recordatorios add column token uuid not null default gen_random_uuid() unique; -- para el enlace de agendar (no adivinable)
alter table public.recordatorios add column solicitud_id uuid references public.solicitudes(id) on delete set null;
alter table public.recordatorios add column agendado_en timestamptz;
create index on public.recordatorios (estado, fecha_estimada);

insert into public.config_taller (clave, valor) values ('dias_aviso_vencimiento', '30') on conflict do nothing; -- EDITAR

-- ---------- Lecturas de kilometraje (todas las fuentes) y km por día ----------
create or replace view psr_privado.lecturas_km as
  select vehiculo_id, km_reportado as km, creado_en::date as fecha from public.solicitudes where km_reportado is not null
  union all select vehiculo_id, km_ingreso, (fecha_hora at time zone 'America/Bogota')::date from public.recepciones where km_ingreso is not null
  union all select r.vehiculo_id, o.km_salida, (o.fecha_entrega at time zone 'America/Bogota')::date
              from public.ordenes_trabajo o join public.recepciones r on r.id = o.recepcion_id where o.km_salida is not null and o.fecha_entrega is not null
  union all select id, km_ultimo, km_ultimo_fecha from public.vehiculos where km_ultimo is not null and km_ultimo_fecha is not null;

-- Promedio diario: requiere 2+ lecturas separadas al menos 14 días. Si no hay historial, null (se usa la fecha).
create or replace function psr_privado.km_por_dia(p_vehiculo uuid) returns numeric
language sql stable security definer set search_path = public, psr_privado as $$
  with l as (select km, fecha from psr_privado.lecturas_km where vehiculo_id = p_vehiculo),
       a as (select (select km from l order by fecha, km limit 1) km0, min(fecha) f0,
                    (select km from l order by fecha desc, km desc limit 1) km1, max(fecha) f1, count(*) n from l)
  select case when n >= 2 and f1 - f0 >= 14 and km1 >= km0 then least(round((km1 - km0)::numeric / (f1 - f0), 1), 500) end from a
$$;

-- Recordatorios con su fecha objetivo calculada (la más cercana entre la fecha y el km estimado).
create or replace view psr_privado.v_recordatorios as
  select r.*, v.placa, v.marca, v.linea_modelo, v.cliente_id, v.km_ultimo, v.km_ultimo_fecha,
         psr_privado.km_por_dia(v.id) as km_dia,
         case when r.km_estimado is not null and psr_privado.km_por_dia(v.id) > 0 and v.km_ultimo is not null
              then v.km_ultimo_fecha + ceil(greatest(r.km_estimado - v.km_ultimo, 0) / psr_privado.km_por_dia(v.id))::int end as fecha_por_km
    from public.recordatorios r join public.vehiculos v on v.id = r.vehiculo_id;

create or replace function psr_privado.fecha_objetivo(r psr_privado.v_recordatorios) returns date
language sql immutable as $$ select coalesce(least(r.fecha_estimada, r.fecha_por_km), r.fecha_estimada, r.fecha_por_km) $$;

-- ---------- SOAT y RTM: un recordatorio vivo por vehículo y tipo ----------
create or replace function psr_privado.tg_vencimientos() returns trigger
language plpgsql security definer set search_path = public, psr_privado as $$
declare t text; f date;
begin
  foreach t in array array['soat', 'tecnomecanica'] loop
    f := case t when 'soat' then new.fecha_soat else new.fecha_tecnomecanica end;
    if tg_op = 'UPDATE' and f is not distinct from (case t when 'soat' then old.fecha_soat else old.fecha_tecnomecanica end) then continue; end if;
    update public.recordatorios set estado = 'descartado'
     where vehiculo_id = new.id and tipo = t and estado in ('pendiente', 'enviado');
    if f is not null then
      insert into public.recordatorios (vehiculo_id, servicio, tipo, fecha_estimada)
      values (new.id, case t when 'soat' then 'Vencimiento del SOAT' else 'Vencimiento de la revisión técnico-mecánica' end, t, f);
    end if;
  end loop;
  return new;
end $$;
create trigger vehiculo_vencimientos after insert or update of fecha_soat, fecha_tecnomecanica on public.vehiculos
  for each row execute function psr_privado.tg_vencimientos();

-- ---------- Recordatorios de la semana (taller) ----------
create or replace function public.recordatorios_proximos(p_dias int default 14) returns jsonb
language plpgsql stable security definer set search_path = public, psr_privado as $$
declare v_hoy date := psr_privado.hoy(); v_aviso int := coalesce((select valor::text::int from public.config_taller where clave = 'dias_aviso_vencimiento'), 30);
begin
  perform psr_privado.exigir_taller();
  return coalesce((
    select jsonb_agg(x order by x ->> 'fechaObjetivo') from (
      select jsonb_build_object(
        'id', r.id, 'token', r.token, 'tipo', r.tipo, 'servicio', r.servicio, 'estado', r.estado,
        'fechaEstimada', r.fecha_estimada, 'kmEstimado', r.km_estimado, 'fechaPorKm', r.fecha_por_km,
        'fechaObjetivo', psr_privado.fecha_objetivo(r), 'kmDia', r.km_dia,
        'kmHoy', case when r.km_dia is not null then r.km_ultimo + round(r.km_dia * (v_hoy - r.km_ultimo_fecha)) else r.km_ultimo end,
        'enviadoEn', r.enviado_en,
        'vehiculo', jsonb_build_object('id', r.vehiculo_id, 'placa', r.placa, 'marca', r.marca, 'linea', r.linea_modelo),
        'cliente', jsonb_build_object('id', c.id, 'nombre', c.nombre_razon_social, 'celular', c.celular, 'autorizaDatos', c.autoriza_datos,
                                      'aceptaRecordatorios', c.acepta_recordatorios, 'origen', c.origen)) x
        from psr_privado.v_recordatorios r join public.clientes c on c.id = r.cliente_id
       where r.estado in ('pendiente', 'enviado') and c.anonimizado_en is null
         and psr_privado.fecha_objetivo(r) <= v_hoy + p_dias + case when r.tipo = 'mantenimiento' then 0 else v_aviso end) s), '[]');
end $$;

create or replace function public.marcar_recordatorio(p_id uuid, p_estado text) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
begin
  perform psr_privado.exigir_taller();
  if p_estado not in ('pendiente', 'enviado', 'agendado', 'descartado') then raise exception 'DATOS_INVALIDOS'; end if;
  update public.recordatorios set estado = p_estado,
    enviado_en = case when p_estado = 'enviado' then coalesce(enviado_en, now()) else enviado_en end,
    canal = case when p_estado = 'enviado' then 'whatsapp' else canal end,
    agendado_en = case when p_estado = 'agendado' then now() else agendado_en end
  where id = p_id;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
end $$;

-- Conversión: de los recordatorios enviados en el periodo, cuántos terminaron en cita.
create or replace function public.indicador_recordatorios(p_dias int default 90) returns jsonb
language plpgsql stable security definer set search_path = public, psr_privado as $$
declare e int; a int;
begin
  perform psr_privado.exigir_taller();
  select count(*) filter (where enviado_en >= now() - make_interval(days => p_dias)),
         count(*) filter (where enviado_en >= now() - make_interval(days => p_dias) and estado = 'agendado')
    into e, a from public.recordatorios;
  return jsonb_build_object('dias', p_dias, 'enviados', e, 'agendados', a, 'conversion', case when e > 0 then round(a::numeric / e, 3) end);
end $$;

-- ---------- Enlace del recordatorio → solicitud precargada (solo datos del vehículo) ----------
create or replace function public.precarga_recordatorio(p_token uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare r jsonb;
begin
  perform psr_privado.limitar('recordatorio:' || psr_privado.origen_hash(), 20, interval '15 minutes');
  select jsonb_build_object('servicio', re.servicio, 'tipo', re.tipo, 'placa', v.placa, 'marca', v.marca, 'linea', coalesce(v.linea_modelo, ''),
                            'anio', v.anio_modelo, 'color', coalesce(v.color, ''), 'combustible', coalesce(v.combustible_tipo, ''), 'km', v.km_ultimo)
    into r
    from public.recordatorios re join public.vehiculos v on v.id = re.vehiculo_id join public.clientes c on c.id = v.cliente_id
   where re.token = p_token and re.estado in ('pendiente', 'enviado') and c.anonimizado_en is null;
  return r;
end $$;

-- Al enviar la solicitud desde el enlace, el recordatorio queda "agendado" (alimenta el indicador).
create or replace function public.vincular_recordatorio(p_token uuid, p_codigo text) returns boolean
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_sol record;
begin
  perform psr_privado.limitar('vincular:' || psr_privado.origen_hash(), 20, interval '15 minutes');
  select id, vehiculo_id into v_sol from public.solicitudes
   where codigo_seguimiento = upper(trim(p_codigo)) and creado_en > now() - interval '1 hour';
  if v_sol.id is null then return false; end if;
  update public.recordatorios set estado = 'agendado', agendado_en = now(), solicitud_id = v_sol.id
   where token = p_token and vehiculo_id = v_sol.vehiculo_id and estado in ('pendiente', 'enviado');
  if found then update public.solicitudes set canal = 'recordatorio' where id = v_sol.id; end if;
  return found;
end $$;

-- ---------- "Mi mantenimiento" del cliente (placa + 4 del documento + 4 del celular) ----------
create or replace function psr_privado.vehiculo_de_cliente(p_placa text, p_doc4 text, p_cel4 text) returns uuid
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_placa text := upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g')); v uuid;
begin
  perform psr_privado.limitar('mantenimiento:' || psr_privado.origen_hash(), 10, interval '15 minutes');
  perform psr_privado.limitar('mantenimiento-placa:' || v_placa, 5, interval '15 minutes');
  select ve.id into v from public.vehiculos ve join public.clientes c on c.id = ve.cliente_id
   where ve.placa = v_placa and c.anonimizado_en is null
     and right(c.numero_documento, 4) = p_doc4 and right(regexp_replace(c.celular, '\D', '', 'g'), 4) = p_cel4;
  return v;
end $$;

create or replace function public.mi_mantenimiento(p_placa text, p_doc4 text, p_cel4 text) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v uuid := psr_privado.vehiculo_de_cliente(p_placa, p_doc4, p_cel4);
begin
  if v is null then return null; end if;
  return (select jsonb_build_object(
    'placa', ve.placa, 'marca', ve.marca, 'linea', coalesce(ve.linea_modelo, ''), 'anio', ve.anio_modelo, 'color', coalesce(ve.color, ''),
    'combustible', coalesce(ve.combustible_tipo, ''), 'km', ve.km_ultimo, 'kmFecha', ve.km_ultimo_fecha,
    'fechaSoat', ve.fecha_soat, 'fechaTecnomecanica', ve.fecha_tecnomecanica,
    'proximos', coalesce((select jsonb_agg(jsonb_build_object('servicio', r.servicio, 'tipo', r.tipo, 'fecha', psr_privado.fecha_objetivo(r), 'km', r.km_estimado)
                                           order by psr_privado.fecha_objetivo(r))
                            from psr_privado.v_recordatorios r where r.vehiculo_id = ve.id and r.estado in ('pendiente', 'enviado')), '[]'),
    'ultimoServicio', (select jsonb_build_object('fecha', o.fecha_entrega, 'km', o.km_salida,
                                                 'trabajos', coalesce((select jsonb_agg(t ->> 'descripcion') from jsonb_array_elements(o.trabajos) t), '[]'))
                         from public.ordenes_trabajo o join public.recepciones re on re.id = o.recepcion_id
                        where re.vehiculo_id = ve.id and o.estado = 'entregado' order by o.fecha_entrega desc limit 1))
    from public.vehiculos ve where ve.id = v);
end $$;

create or replace function public.registrar_vencimientos(p_placa text, p_doc4 text, p_cel4 text, p_soat date, p_rtm date) returns boolean
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v uuid := psr_privado.vehiculo_de_cliente(p_placa, p_doc4, p_cel4); h date := psr_privado.hoy();
begin
  if v is null then return false; end if;
  if (p_soat is not null and p_soat not between h - 365 and h + 400) or (p_rtm is not null and p_rtm not between h - 365 and h + 6 * 366) then
    raise exception 'DATOS_INVALIDOS' using errcode = 'P0422';
  end if;
  update public.vehiculos set fecha_soat = p_soat, fecha_tecnomecanica = p_rtm, actualizado_en = now() where id = v;
  return true;
end $$;

-- ---------- Ficha del cliente con historial completo (auditada) ----------
create or replace function public.ver_cliente(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_res jsonb;
begin
  perform psr_privado.exigir_taller();
  select jsonb_build_object(
    'id', c.id, 'tipoDocumento', c.tipo_documento, 'numeroDocumento', c.numero_documento, 'digitoVerificacion', c.digito_verificacion,
    'nombre', c.nombre_razon_social, 'celular', c.celular, 'correo', c.correo, 'direccion', c.direccion, 'barrioMunicipio', c.barrio_municipio,
    'autorizaDatos', c.autoriza_datos, 'autorizaFecha', c.autoriza_datos_fecha, 'autorizaVersion', c.autoriza_datos_version,
    'verificado', c.verificado, 'origen', c.origen, 'aceptaRecordatorios', c.acepta_recordatorios, 'anonimizadoEn', c.anonimizado_en, 'creadoEn', c.creado_en,
    'vehiculos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'placa', v.placa, 'marca', v.marca, 'linea', v.linea_modelo, 'anio', v.anio_modelo, 'color', v.color, 'vin', v.vin,
        'combustible', v.combustible_tipo, 'km', v.km_ultimo, 'kmFecha', v.km_ultimo_fecha, 'kmDia', psr_privado.km_por_dia(v.id),
        'fechaSoat', v.fecha_soat, 'fechaTecnomecanica', v.fecha_tecnomecanica,
        'solicitudes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'codigo', s.codigo_seguimiento, 'creadoEn', s.creado_en, 'estado', s.estado,
                                   'zonas', to_jsonb(s.zonas), 'sintomas', to_jsonb(s.sintomas), 'descripcion', s.descripcion) order by s.creado_en desc)
                                  from public.solicitudes s where s.vehiculo_id = v.id), '[]'),
        'ordenes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'estado', o.estado, 'creadoEn', o.creado_en, 'fechaEntrega', o.fecha_entrega,
                                   'recepcionId', re.id, 'kmIngreso', re.km_ingreso, 'kmSalida', o.km_salida, 'trabajos', o.trabajos,
                                   'presupuestoTotal', o.presupuesto_total, 'presupuestoEstado', o.presupuesto_estado, 'garantiaHasta', o.garantia_hasta) order by o.creado_en desc)
                               from public.ordenes_trabajo o join public.recepciones re on re.id = o.recepcion_id where re.vehiculo_id = v.id), '[]'),
        'recordatorios', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'servicio', r.servicio, 'tipo', r.tipo, 'estado', r.estado,
                                   'fechaObjetivo', psr_privado.fecha_objetivo(r), 'kmEstimado', r.km_estimado) order by psr_privado.fecha_objetivo(r))
                                     from psr_privado.v_recordatorios r where r.vehiculo_id = v.id and r.estado in ('pendiente', 'enviado', 'agendado')), '[]')
      ) order by v.placa) from public.vehiculos v where v.cliente_id = c.id), '[]'))
    into v_res from public.clientes c where c.id = p_id;
  if v_res is null then raise exception 'NO_ENCONTRADO'; end if;
  insert into public.auditoria (usuario, accion, tabla, registro) values (auth.uid(), 'ver', 'clientes', p_id::text);
  return v_res;
end $$;

-- ---------- Derecho de supresión: anonimizar un cliente (solo admin) ----------
-- Se conservan el vehículo y las órdenes (garantías, deber contable) pero sin datos que identifiquen a la persona.
create or replace function public.anonimizar_cliente(p_id uuid, p_motivo text) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'MOTIVO_OBLIGATORIO'; end if;
  update public.clientes set
    nombre_razon_social = 'Cliente anonimizado', numero_documento = 'ANON-' || left(replace(id::text, '-', ''), 10),
    digito_verificacion = null, celular = '', correo = null, direccion = null, barrio_municipio = null,
    acepta_recordatorios = false, anonimizado_en = now(), actualizado_en = now()
  where id = p_id and anonimizado_en is null;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
  update public.solicitudes set datos_reportados = '{}', descripcion = '' where cliente_id = p_id;
  update public.recepciones re set firmado_por = 'Anonimizado', objetos_personales = null
    from public.vehiculos v where v.id = re.vehiculo_id and v.cliente_id = p_id;
  update public.recordatorios r set estado = 'descartado' from public.vehiculos v
   where v.id = r.vehiculo_id and v.cliente_id = p_id and r.estado in ('pendiente', 'enviado');
  insert into public.auditoria (usuario, accion, tabla, registro, detalle)
  values (auth.uid(), 'anonimizar', 'clientes', p_id::text, jsonb_build_object('motivo', trim(p_motivo)));
end $$;

-- Exportar datos personales queda registrado (solo admin).
create or replace function public.registrar_exportacion(p_filas int, p_formato text) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  insert into public.auditoria (usuario, accion, tabla, detalle) values (auth.uid(), 'exportar', 'clientes', jsonb_build_object('filas', p_filas, 'formato', p_formato));
end $$;

-- ---------- Importar la base de Excel del taller (solo admin) ----------
-- No sobrescribe datos existentes: solo completa campos vacíos. Los importados quedan
-- marcados SIN autorización registrada hasta que el cliente la dé (Ley 1581).
create or replace function public.importar_clientes(p_filas jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare
  f jsonb; i int := 0; v_cli uuid; v_veh uuid; v_tipo text; v_doc text; v_placa text; v_km int; v_fecha date; v_pl record;
  cn int := 0; ca int := 0; vn int := 0; va int := 0; rn int := 0; errores jsonb := '[]';
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 2000 then raise exception 'DATOS_INVALIDOS: máximo 2000 filas por carga'; end if;
  for f in select * from jsonb_array_elements(p_filas) loop
    i := i + 1;
    begin
      v_tipo := upper(coalesce(nullif(trim(f ->> 'tipoDocumento'), ''), 'CC'));
      if v_tipo in ('CEDULA', 'CÉDULA', 'C.C.', 'C.C') then v_tipo := 'CC'; end if;
      v_doc := case when v_tipo = 'PAS' then upper(regexp_replace(coalesce(f ->> 'numeroDocumento', ''), '[^A-Za-z0-9]', '', 'g'))
                    else regexp_replace(coalesce(f ->> 'numeroDocumento', ''), '\D', '', 'g') end;
      v_placa := upper(regexp_replace(coalesce(f ->> 'placa', ''), '[^A-Za-z0-9]', '', 'g'));
      if v_tipo not in ('CC', 'CE', 'NIT', 'PAS') then raise exception 'Tipo de documento no reconocido: %', f ->> 'tipoDocumento'; end if;
      if length(v_doc) < 4 then raise exception 'Falta el número de documento'; end if;
      if length(trim(coalesce(f ->> 'nombre', ''))) < 2 then raise exception 'Falta el nombre'; end if;

      select id into v_cli from public.clientes where tipo_documento = v_tipo and numero_documento = v_doc;
      if v_cli is null then
        insert into public.clientes (tipo_documento, numero_documento, nombre_razon_social, celular, correo, direccion, origen, autoriza_datos)
        values (v_tipo, v_doc, trim(f ->> 'nombre'), regexp_replace(coalesce(f ->> 'celular', ''), '\D', '', 'g'),
                nullif(trim(f ->> 'correo'), ''), nullif(trim(f ->> 'direccion'), ''), 'importado', false)
        returning id into v_cli;
        cn := cn + 1;
      else
        update public.clientes set
          celular = case when celular = '' then regexp_replace(coalesce(f ->> 'celular', ''), '\D', '', 'g') else celular end,
          correo = coalesce(correo, nullif(trim(f ->> 'correo'), '')), direccion = coalesce(direccion, nullif(trim(f ->> 'direccion'), ''))
        where id = v_cli;
        ca := ca + 1;
      end if;

      if length(v_placa) between 3 and 8 then
        v_km := nullif(regexp_replace(coalesce(f ->> 'km', ''), '\D', '', 'g'), '')::int;
        v_fecha := nullif(f ->> 'fechaUltimoServicio', '')::date;
        select id into v_veh from public.vehiculos where placa = v_placa;
        if v_veh is null then
          insert into public.vehiculos (cliente_id, placa, marca, linea_modelo, anio_modelo, color, km_ultimo, km_ultimo_fecha, fecha_soat, fecha_tecnomecanica)
          values (v_cli, v_placa, coalesce(nullif(trim(f ->> 'marca'), ''), 'Sin dato'), nullif(trim(f ->> 'linea'), ''),
                  nullif(regexp_replace(coalesce(f ->> 'anio', ''), '\D', '', 'g'), '')::smallint, nullif(trim(f ->> 'color'), ''),
                  v_km, case when v_km is not null then coalesce(v_fecha, psr_privado.hoy()) end,
                  nullif(f ->> 'fechaSoat', '')::date, nullif(f ->> 'fechaTecnomecanica', '')::date)
          returning id into v_veh;
          vn := vn + 1;
        else
          update public.vehiculos set
            linea_modelo = coalesce(linea_modelo, nullif(trim(f ->> 'linea'), '')), color = coalesce(color, nullif(trim(f ->> 'color'), '')),
            km_ultimo = case when v_km > coalesce(km_ultimo, -1) then v_km else km_ultimo end,
            km_ultimo_fecha = case when v_km > coalesce(km_ultimo, -1) then coalesce(v_fecha, psr_privado.hoy()) else km_ultimo_fecha end,
            fecha_soat = coalesce(fecha_soat, nullif(f ->> 'fechaSoat', '')::date),
            fecha_tecnomecanica = coalesce(fecha_tecnomecanica, nullif(f ->> 'fechaTecnomecanica', '')::date)
          where id = v_veh;
          va := va + 1;
        end if;
        -- Si la fila trae el último servicio y coincide con un plan, se programa el próximo.
        if v_fecha is not null and nullif(trim(f ->> 'ultimoServicio'), '') is not null then
          select * into v_pl from public.planes_mantenimiento where activo and lower(servicio) like '%' || lower(trim(f ->> 'ultimoServicio')) || '%' order by id limit 1;
          if v_pl.id is not null and not exists (select 1 from public.recordatorios where vehiculo_id = v_veh and servicio = v_pl.servicio and estado in ('pendiente', 'enviado')) then
            insert into public.recordatorios (vehiculo_id, servicio, fecha_estimada, km_estimado)
            values (v_veh, v_pl.servicio, case when v_pl.intervalo_meses is not null then v_fecha + make_interval(months => v_pl.intervalo_meses) end,
                    case when v_pl.intervalo_km is not null and v_km is not null then v_km + v_pl.intervalo_km end);
            rn := rn + 1;
          end if;
        end if;
      end if;
    exception when others then
      errores := errores || jsonb_build_object('fila', i, 'motivo', sqlerrm);
    end;
  end loop;
  insert into public.auditoria (usuario, accion, tabla, detalle)
  values (auth.uid(), 'importar', 'clientes', jsonb_build_object('filas', i, 'errores', jsonb_array_length(errores)));
  return jsonb_build_object('filas', i, 'clientesNuevos', cn, 'clientesActualizados', ca, 'vehiculosNuevos', vn, 'vehiculosActualizados', va,
                            'recordatorios', rn, 'errores', errores);
end $$;

-- ---------- Permisos ----------
revoke all on psr_privado.lecturas_km, psr_privado.v_recordatorios from public, anon, authenticated;
revoke execute on function psr_privado.km_por_dia(uuid), psr_privado.fecha_objetivo(psr_privado.v_recordatorios),
  psr_privado.vehiculo_de_cliente(text, text, text) from public, anon, authenticated;
revoke execute on function public.recordatorios_proximos(int), public.marcar_recordatorio(uuid, text), public.indicador_recordatorios(int),
  public.precarga_recordatorio(uuid), public.vincular_recordatorio(uuid, text), public.mi_mantenimiento(text, text, text),
  public.registrar_vencimientos(text, text, text, date, date), public.ver_cliente(uuid), public.anonimizar_cliente(uuid, text),
  public.registrar_exportacion(int, text), public.importar_clientes(jsonb) from public, anon;
grant execute on function public.recordatorios_proximos(int), public.marcar_recordatorio(uuid, text), public.indicador_recordatorios(int),
  public.ver_cliente(uuid), public.anonimizar_cliente(uuid, text), public.registrar_exportacion(int, text), public.importar_clientes(jsonb) to authenticated;
grant execute on function public.precarga_recordatorio(uuid), public.vincular_recordatorio(uuid, text), public.mi_mantenimiento(text, text, text),
  public.registrar_vencimientos(text, text, text, date, date) to anon, authenticated;
