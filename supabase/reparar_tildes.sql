-- =====================================================================
-- Reparación de tildes (generado por scripts/generar-reparacion-tildes.mjs)
-- Corrige el texto que llegó como "Pasi√≥n" en vez de "Pasión".
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================
begin;

-- 1) Funciones y vistas, otra vez y en orden (61 objetos).
-- 20261115000200_semaforo.sql
create or replace function psr_privado.normalizar(t text) returns text
language sql immutable as $$
  select regexp_replace(
           trim(translate(lower(coalesce(t, '')), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio')),
           '\s+', ' ', 'g')
$$;

-- 20261115000200_semaforo.sql
create or replace function psr_privado.clasificar(
  p_zonas text[], p_sintomas text[], p_descripcion text, p_movilidad text
) returns jsonb
language plpgsql stable security definer set search_path = public, psr_privado as $$
declare
  v_rojo  text[] := '{}';
  v_amar  text[] := '{}';
  v_txt   text   := psr_privado.normalizar(p_descripcion);
  v_razon text;
  v_color text;
  r       record;
begin
  for r in select * from public.reglas_semaforo where activo order by id loop
    v_razon := null;
    if r.tipo = 'movilidad' and p_movilidad = r.valor then
      v_razon := 'El cliente indica que el vehículo no puede movilizarse';
    elsif r.tipo = 'movilidad_zona' and p_movilidad = r.valor and r.zona = any (coalesce(p_zonas, '{}')) then
      v_razon := 'No está seguro de poder movilizarse y marcó la zona ' || r.zona;
    elsif r.tipo = 'sintoma' and r.valor = any (coalesce(p_sintomas, '{}')) then
      v_razon := 'Síntoma marcado: ' || r.valor;
    elsif r.tipo = 'palabra' and v_txt <> '' and position(psr_privado.normalizar(r.valor) in v_txt) > 0 then
      v_razon := 'La descripción menciona «' || r.valor || '»';
    end if;
    if v_razon is not null then
      if r.color = 'rojo' then v_rojo := v_rojo || v_razon;
      elsif r.color = 'amarillo' then v_amar := v_amar || v_razon;
      end if;
    end if;
  end loop;

  v_color := case when cardinality(v_rojo) > 0 then 'rojo'
                  when cardinality(v_amar) > 0 then 'amarillo'
                  else 'verde' end;
  return jsonb_build_object(
    'color', v_color,
    'razones', to_jsonb(case v_color
                          when 'rojo' then v_rojo
                          when 'amarillo' then v_amar
                          else array['Mantenimiento, cotización, latonería sin compromiso mecánico o duda general'] end));
end $$;

-- 20261115000200_semaforo.sql
create or replace function psr_privado.tg_solicitud_semaforo() returns trigger
language plpgsql security definer set search_path = public, psr_privado as $$
declare v jsonb;
begin
  v := psr_privado.clasificar(new.zonas, new.sintomas, new.descripcion, new.puede_movilizarse);
  if tg_op = 'INSERT' then
    insert into public.triage_interno (solicitud_id, semaforo_auto, semaforo_final, razones)
    values (new.id, v ->> 'color', v ->> 'color', v -> 'razones');
  else
    update public.triage_interno t
       set semaforo_auto  = v ->> 'color',
           -- si nadie lo cambió a mano, el color final sigue al automático
           semaforo_final = case when t.motivo_cambio is null then v ->> 'color' else t.semaforo_final end,
           razones        = v -> 'razones',
           calculado_en   = now()
     where t.solicitud_id = new.id;
  end if;
  return new;
end $$;

-- 20261115000300_funciones.sql
create or replace function psr_privado.hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;

-- 20261115000300_funciones.sql
create or replace function psr_privado.origen_hash() returns text
language plpgsql stable as $$
declare h text := nullif(current_setting('request.headers', true), '');
        ip text;
begin
  if h is not null then ip := split_part(coalesce(h::json ->> 'x-forwarded-for', h::json ->> 'x-real-ip', ''), ',', 1); end if;
  return md5('psr:' || coalesce(nullif(trim(ip), ''), 'sin-ip'));
end $$;

-- 20261115000300_funciones.sql
create or replace function psr_privado.limitar(p_clave text, p_max int, p_ventana interval) returns void
language plpgsql security definer set search_path = psr_privado as $$
begin
  delete from psr_privado.intentos where creado_en < now() - interval '1 day';
  if (select count(*) from psr_privado.intentos where clave = p_clave and creado_en > now() - p_ventana) >= p_max then
    raise exception 'DEMASIADOS_INTENTOS' using errcode = 'P0429';
  end if;
  insert into psr_privado.intentos (clave) values (p_clave);
end $$;

-- 20261115000300_funciones.sql
create or replace function psr_privado.nuevo_codigo() returns text
language plpgsql volatile as $$
declare a constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; c text;
begin
  loop
    c := 'PSR-';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.solicitudes where codigo_seguimiento = c);
  end loop;
  return c;
end $$;

-- 20261115000300_funciones.sql
create or replace function psr_privado.festivos_colombia(p_anio int)
returns table (fecha date, nombre text)
language plpgsql immutable as $$
declare
  a int := p_anio % 19; b int := p_anio / 100; c int := p_anio % 100; d int := b / 4; e int := b % 4;
  f int := (b + 8) / 25; g int := (b - f + 1) / 3; h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4; k int := c % 4; l int := (32 + 2 * e + 2 * i - h - k) % 7; m int := (a + 11 * h + 22 * l) / 451;
  pascua date := make_date(p_anio, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
begin
  return query
  with base (f, n, mover) as (values
    (make_date(p_anio, 1, 1),  'Año Nuevo', false),
    (make_date(p_anio, 1, 6),  'Día de los Reyes Magos', true),
    (make_date(p_anio, 3, 19), 'Día de San José', true),
    (pascua - 3,  'Jueves Santo', false),
    (pascua - 2,  'Viernes Santo', false),
    (make_date(p_anio, 5, 1),  'Día del Trabajo', false),
    (pascua + 43, 'Ascensión del Señor', false),
    (pascua + 64, 'Corpus Christi', false),
    (pascua + 71, 'Sagrado Corazón', false),
    (make_date(p_anio, 6, 29), 'San Pedro y San Pablo', true),
    (make_date(p_anio, 7, 20), 'Día de la Independencia', false),
    (make_date(p_anio, 8, 7),  'Batalla de Boyacá', false),
    (make_date(p_anio, 8, 15), 'Asunción de la Virgen', true),
    (make_date(p_anio, 10, 12),'Día de la Raza', true),
    (make_date(p_anio, 11, 1), 'Todos los Santos', true),
    (make_date(p_anio, 11, 11),'Independencia de Cartagena', true),
    (make_date(p_anio, 12, 8), 'Inmaculada Concepción', false),
    (make_date(p_anio, 12, 25),'Navidad', false))
  select case when mover then base.f + ((8 - extract(isodow from base.f)::int) % 7) else base.f end, n
    from base order by 1;
end $$;

-- 20261115000300_funciones.sql
create or replace function public.disponibilidad_publica(p_desde date, p_hasta date)
returns table (fecha date, franja text, disponible boolean, motivo text)
language plpgsql stable security definer set search_path = public, psr_privado as $$
declare v_hoy date := psr_privado.hoy();
begin
  if p_hasta < p_desde or p_hasta - p_desde > 62 then raise exception 'DATOS_INVALIDOS: rango de fechas'; end if;
  return query
  select d::date, fr.franja,
         (m.motivo is null and coalesce(disp.activo, false) and coalesce(disp.cupos, 0) > u.usados),
         m.motivo
    from generate_series(p_desde, p_hasta, interval '1 day') d
   cross join (values ('manana'), ('tarde')) fr (franja)
    left join public.disponibilidad disp on disp.dia_semana = extract(dow from d)::int and disp.franja = fr.franja
   cross join lateral (
     select count(*)::int as usados from public.citas c
      where c.fecha = d::date and c.franja = fr.franja and c.estado in ('pendiente', 'confirmada', 'reprogramada')) u
   cross join lateral (
     select case
       when d::date <= v_hoy then 'Desde mañana'
       when exists (select 1 from public.festivos fe where fe.fecha = d::date) then 'Festivo'
       when exists (select 1 from public.dias_bloqueados b where b.fecha = d::date and (b.franja is null or b.franja = fr.franja)) then 'Cerrado'
     end as motivo) m
   order by 1, 2;
end $$;

-- 20261115000300_funciones.sql
create or replace function public.crear_solicitud(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare
  v_origen   text := psr_privado.origen_hash();
  c          jsonb := p -> 'cliente';
  ve         jsonb := p -> 'vehiculo';
  au         jsonb := p -> 'autorizaciones';
  v_tipo     text := c ->> 'tipoDocumento';
  v_doc      text;
  v_placa    text := upper(regexp_replace(coalesce(ve ->> 'placa', ''), '[^A-Za-z0-9]', '', 'g'));
  v_borrador text := p ->> 'borradorId';
  v_cli      uuid;
  v_veh      uuid;
  v_sol      uuid;
  v_codigo   text;
  v_fecha    date;
  v_franja   text;
  v_libre    boolean;
  v_adj      jsonb;
  v_zonas    text[];
  v_sint     text[];
begin
  -- Honeypot: los robots llenan el campo oculto. Se responde "éxito" sin guardar nada.
  if coalesce(p ->> 'website', '') <> '' then
    return jsonb_build_object('codigo', psr_privado.nuevo_codigo(), 'cita', null);
  end if;
  perform psr_privado.limitar('solicitud:' || v_origen, 8, interval '1 hour');

  v_doc := case when v_tipo = 'PAS' then upper(regexp_replace(coalesce(c ->> 'numeroDocumento', ''), '[^A-Za-z0-9]', '', 'g'))
                else regexp_replace(coalesce(c ->> 'numeroDocumento', ''), '\D', '', 'g') end;
  select coalesce(array_agg(x), '{}') into v_zonas from jsonb_array_elements_text(coalesce(p -> 'zonas', '[]')) x;
  select coalesce(array_agg(x), '{}') into v_sint  from jsonb_array_elements_text(coalesce(p -> 'sintomas', '[]')) x;
  v_adj := coalesce(p -> 'adjuntos', '[]');

  -- Validación (lo obligatorio). Lo demás solo se advierte en el navegador.
  if coalesce((coalesce((au ->> 'datos')::boolean, false) is not true
     or coalesce(v_tipo, '') not in ('CC', 'CE', 'NIT', 'PAS') or length(v_doc) not between 4 and 15
     or length(regexp_replace(coalesce(c ->> 'celular', ''), '\D', '', 'g')) not between 7 and 12
     or (coalesce(p ->> 'esClienteExistente', 'false') <> 'true' and length(trim(coalesce(c ->> 'nombre', ''))) < 2)
     or length(v_placa) not between 3 and 8 or length(trim(coalesce(ve ->> 'marca', ''))) < 1
     or coalesce(p ->> 'movilidad', '') not in ('si', 'no', 'nose')
     or coalesce(au ->> 'presupuesto', '') not in ('previo', 'sin_presupuesto')
     or cardinality(v_zonas) not between 1 and 15 or cardinality(v_sint) > 40
     or length(coalesce(p ->> 'descripcion', '')) > 1500
     or jsonb_array_length(v_adj) > 12
     or coalesce(v_borrador, '') !~ '^[0-9a-f-]{36}$'
     or exists (select 1 from jsonb_array_elements(v_adj) a where coalesce(a ->> 'ruta', '') not like 'pendientes/' || v_borrador || '/%')
     or exists (select 1 from unnest(v_zonas) z where z not in (select id from public.zonas))
     or exists (select 1 from unnest(v_sint) s where s not in (select id from public.sintomas))), true)
  then
    raise exception 'DATOS_INVALIDOS' using errcode = 'P0422';
  end if;

  -- Cliente: si ya existe se vincula, pero sus datos NO se sobrescriben desde el portal
  -- (cualquiera podría escribir un documento ajeno). Lo reportado queda en datos_reportados.
  select id into v_cli from public.clientes where tipo_documento = v_tipo and numero_documento = v_doc;
  if v_cli is null then
    insert into public.clientes (tipo_documento, numero_documento, digito_verificacion, nombre_razon_social, celular,
                                 correo, direccion, barrio_municipio, autoriza_datos, autoriza_datos_fecha, autoriza_datos_version)
    values (v_tipo, v_doc, nullif(c ->> 'digitoVerificacion', ''), trim(c ->> 'nombre'),
            regexp_replace(c ->> 'celular', '\D', '', 'g'), nullif(trim(c ->> 'correo'), ''), nullif(trim(c ->> 'direccion'), ''),
            nullif(trim(c ->> 'barrioMunicipio'), ''), true, now(), au ->> 'versionAviso')
    returning id into v_cli;
  end if;

  select id into v_veh from public.vehiculos where placa = v_placa;
  if v_veh is null then
    insert into public.vehiculos (cliente_id, placa, marca, linea_modelo, anio_modelo, color, vin, combustible_tipo, km_ultimo, km_ultimo_fecha, foto_tarjeta_propiedad)
    values (v_cli, v_placa, trim(ve ->> 'marca'), nullif(trim(ve ->> 'linea'), ''), nullif(ve ->> 'anio', '')::smallint,
            nullif(ve ->> 'color', ''),
            case when upper(coalesce(ve ->> 'vin', '')) ~ '^[A-HJ-NPR-Z0-9]{17}$' then upper(ve ->> 'vin') end,
            case when ve ->> 'combustible' in ('gasolina', 'diesel', 'gas', 'hibrido', 'electrico', 'nose') then ve ->> 'combustible' end,
            nullif(ve ->> 'km', '')::int, case when nullif(ve ->> 'km', '') is not null then psr_privado.hoy() end,
            (select a ->> 'ruta' from jsonb_array_elements(v_adj) a where a ->> 'tipo' = 'tarjeta' limit 1))
    returning id into v_veh;
  end if;

  v_codigo := psr_privado.nuevo_codigo();
  insert into public.solicitudes (codigo_seguimiento, cliente_id, vehiculo_id, datos_reportados, zonas, sintomas, descripcion,
                                  puede_movilizarse, desde_cuando, km_reportado, adjuntos, nota_voz_url, franja_preferida,
                                  autoriza_presupuesto, autoriza_prueba_ruta, autoriza_datos_en, autoriza_datos_version, canal, origen_hash)
  values (v_codigo, v_cli, v_veh, jsonb_build_object('cliente', c, 'vehiculo', ve, 'esClienteExistente', p -> 'esClienteExistente'),
          v_zonas, v_sint, trim(coalesce(p ->> 'descripcion', '')), p ->> 'movilidad', nullif(p ->> 'desdeCuando', ''),
          nullif(ve ->> 'km', '')::int, v_adj,
          (select a ->> 'ruta' from jsonb_array_elements(v_adj) a where a ->> 'tipo' = 'audio' limit 1),
          p -> 'cita' ->> 'franja', au ->> 'presupuesto', coalesce((au ->> 'pruebaRuta')::boolean, false), now(),
          coalesce(au ->> 'versionAviso', 'sin-version'),
          case when p ->> 'canal' in ('portal', 'qr', 'recordatorio') then p ->> 'canal' else 'portal' end, v_origen)
  returning id into v_sol;

  -- Cita: queda PENDIENTE. Se bloquea la franja para que dos clientes no tomen el último cupo.
  if jsonb_typeof(p -> 'cita') = 'object' then
    v_fecha := (p -> 'cita' ->> 'fecha')::date;
    v_franja := p -> 'cita' ->> 'franja';
    if v_franja not in ('manana', 'tarde') or v_fecha > psr_privado.hoy() + 62 then
      raise exception 'DATOS_INVALIDOS' using errcode = 'P0422';
    end if;
    perform pg_advisory_xact_lock(hashtext('cita:' || v_fecha || v_franja));
    select d.disponible into v_libre from public.disponibilidad_publica(v_fecha, v_fecha) d where d.franja = v_franja;
    if not coalesce(v_libre, false) then
      raise exception 'CUPO_LLENO' using errcode = 'P0409';
    end if;
    insert into public.citas (solicitud_id, fecha, franja) values (v_sol, v_fecha, v_franja);
  end if;

  insert into public.auditoria (usuario, accion, tabla, registro, detalle)
  values (null, 'crear', 'solicitudes', v_sol::text, jsonb_build_object('canal', 'portal'));

  return jsonb_build_object('codigo', v_codigo,
    'cita', case when v_fecha is null then null
                 else jsonb_build_object('fecha', v_fecha, 'franja', v_franja, 'estado', 'pendiente') end);
end $$;

-- 20261115000300_funciones.sql
create or replace function public.precargar_vehiculo(p_placa text, p_doc4 text, p_cel4 text) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_placa text := upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g')); r record;
begin
  perform psr_privado.limitar('precarga:' || psr_privado.origen_hash(), 10, interval '15 minutes');
  perform psr_privado.limitar('precarga-placa:' || v_placa, 5, interval '15 minutes');
  select v.placa, v.marca, v.linea_modelo, v.anio_modelo, v.color, v.combustible_tipo, v.km_ultimo into r
    from public.vehiculos v join public.clientes c on c.id = v.cliente_id
   where v.placa = v_placa and c.anonimizado_en is null
     and right(c.numero_documento, 4) = p_doc4 and right(regexp_replace(c.celular, '\D', '', 'g'), 4) = p_cel4;
  if not found then return null; end if;
  return jsonb_build_object('placa', r.placa, 'marca', r.marca, 'linea', coalesce(r.linea_modelo, ''), 'anio', r.anio_modelo,
                            'color', coalesce(r.color, ''), 'combustible', coalesce(r.combustible_tipo, ''), 'km', r.km_ultimo);
end $$;

-- 20261115000300_funciones.sql
create or replace function public.consultar_estado(p_codigo text, p_doc4 text) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_cod text := upper(trim(coalesce(p_codigo, ''))); s record; ci record;
begin
  perform psr_privado.limitar('consulta:' || psr_privado.origen_hash(), 10, interval '15 minutes');
  perform psr_privado.limitar('consulta-codigo:' || v_cod, 5, interval '15 minutes');
  select so.id, so.codigo_seguimiento, so.creado_en, v.placa, concat_ws(' ', v.marca, v.linea_modelo) as linea into s
    from public.solicitudes so
    join public.clientes c on c.id = so.cliente_id
    join public.vehiculos v on v.id = so.vehiculo_id
   where so.codigo_seguimiento = v_cod and right(c.numero_documento, 4) = p_doc4 and c.anonimizado_en is null;
  if not found then return null; end if;
  select fecha, franja, estado, confirmada_en into ci from public.citas where solicitud_id = s.id order by creado_en desc limit 1;
  -- Fase 3 amplía los pasos con historial_estados (recibido → entregado).
  return jsonb_build_object(
    'codigo', s.codigo_seguimiento, 'placa', s.placa, 'linea', s.linea,
    'cita', case when ci.fecha is null then null else jsonb_build_object('fecha', ci.fecha, 'franja', ci.franja, 'estado', ci.estado) end,
    'pasos', jsonb_build_array(
      jsonb_build_object('clave', 'recibida', 'nombre', 'Solicitud recibida', 'fecha', s.creado_en, 'hecho', true),
      jsonb_build_object('clave', 'cita', 'nombre', 'Cita confirmada', 'fecha', ci.confirmada_en, 'hecho', coalesce(ci.estado = 'confirmada', false)),
      jsonb_build_object('clave', 'recibido', 'nombre', 'Vehículo recibido', 'fecha', null, 'hecho', false)));
end $$;

-- 20261115000300_funciones.sql
create or replace function psr_privado.es_taller() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo)
$$;

-- 20261115000300_funciones.sql
create or replace function psr_privado.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo and rol = 'admin')
$$;

-- 20261115000300_funciones.sql
create or replace function public.cambiar_semaforo(p_solicitud uuid, p_color text, p_motivo text) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_actual text;
begin
  if not psr_privado.es_taller() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  if p_color not in ('rojo', 'amarillo', 'verde') then raise exception 'DATOS_INVALIDOS'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'MOTIVO_OBLIGATORIO'; end if;
  select semaforo_final into v_actual from public.triage_interno where solicitud_id = p_solicitud for update;
  if v_actual is null then raise exception 'NO_ENCONTRADO'; end if;
  update public.triage_interno set semaforo_final = p_color, motivo_cambio = trim(p_motivo), cambiado_por = auth.uid(), cambiado_en = now()
   where solicitud_id = p_solicitud;
  insert into public.cambios_semaforo (solicitud_id, de, a, motivo, usuario) values (p_solicitud, v_actual, p_color, trim(p_motivo), auth.uid());
  insert into public.auditoria (usuario, accion, tabla, registro, detalle)
  values (auth.uid(), 'cambiar_semaforo', 'triage_interno', p_solicitud::text, jsonb_build_object('de', v_actual, 'a', p_color));
end $$;

-- 20261115000300_funciones.sql
create or replace function psr_privado.tg_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria (usuario, accion, tabla, registro)
  values (auth.uid(), lower(tg_op), tg_table_name, (case when tg_op = 'DELETE' then old.id else new.id end)::text);
  return coalesce(new, old);
end $$;

-- 20261115000500_taller.sql
create or replace function psr_privado.exigir_taller() returns void
language plpgsql stable security definer set search_path = public, psr_privado as $$
begin
  if not psr_privado.es_taller() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
end $$;

-- 20261115000500_taller.sql
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

-- 20261115000500_taller.sql
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

-- 20261115000500_taller.sql
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

-- 20261115000500_taller.sql
create or replace function public.marcar_solicitud(p_id uuid, p_estado text) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
begin
  perform psr_privado.exigir_taller();
  if p_estado not in ('nueva', 'en_revision', 'atendida', 'descartada') then raise exception 'DATOS_INVALIDOS'; end if;
  update public.solicitudes set estado = p_estado where id = p_id;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
end $$;

-- 20261115000500_taller.sql
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

-- 20261115000500_taller.sql
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

-- 20261115000500_taller.sql
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

-- 20261115000600_recepcion_ordenes.sql
create or replace function psr_privado.orden_estados() returns text[]
language sql immutable as $$ select array['recibido', 'en_diagnostico', 'esperando_aprobacion', 'en_reparacion', 'en_prueba', 'listo', 'entregado'] $$;

-- 20261115000600_recepcion_ordenes.sql
create or replace function public.crear_recepcion(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare
  v_veh     public.vehiculos;
  v_sol     uuid := nullif(p ->> 'solicitudId', '')::uuid;
  v_rec     uuid;
  v_ord     uuid;
  v_fotos   jsonb := coalesce(p -> 'fotos', '[]');
  v_nivel   numeric := (p ->> 'nivelCombustible')::numeric;
  v_km      int := (p ->> 'kmIngreso')::int;
  v_previo  boolean := coalesce((p ->> 'autorizaPresupuestoPrevio')::boolean, true);
  v_faltan  text[];
begin
  perform psr_privado.exigir_taller();
  select * into v_veh from public.vehiculos where id = (p ->> 'vehiculoId')::uuid for update;
  if v_veh.id is null then raise exception 'NO_ENCONTRADO'; end if;

  if exists (select 1 from public.ordenes_trabajo o join public.recepciones r on r.id = o.recepcion_id
              where r.vehiculo_id = v_veh.id and o.estado not in ('entregado', 'cancelado')) then
    raise exception 'ORDEN_ABIERTA' using errcode = 'P0409';
  end if;

  select array_agg(t) into v_faltan
    from unnest(array['frente', 'lateral_izq', 'lateral_der', 'tablero']) t
   where not exists (select 1 from jsonb_array_elements(v_fotos) f where f ->> 'tipo' = t and coalesce(f ->> 'ruta', '') <> '');
  if v_faltan is not null then raise exception 'FALTAN_FOTOS: %', array_to_string(v_faltan, ', '); end if;

  if v_km is null or v_km < 0 or v_nivel is null or v_nivel not between 0 and 1 or (v_nivel * 8) <> round(v_nivel * 8)
     or coalesce(p ->> 'firmaCliente', '') not like 'actas/%' or length(trim(coalesce(p ->> 'firmadoPor', ''))) < 3
     or exists (select 1 from jsonb_array_elements(v_fotos) f where coalesce(f ->> 'ruta', '') not like 'actas/%')
     or coalesce(p ->> 'videoInspeccion', 'actas/') not like 'actas/%' then
    raise exception 'DATOS_INVALIDOS' using errcode = 'P0422';
  end if;

  insert into public.recepciones (solicitud_id, vehiculo_id, km_ingreso, nivel_combustible, checklist, mapa_danos, objetos_personales,
                                  accesorios, fotos, video_inspeccion_url, autoriza_presupuesto_previo, autoriza_reparar_sin_presupuesto,
                                  autoriza_prueba_ruta, observaciones, firma_cliente_url, firmado_por, recibido_por)
  values (v_sol, v_veh.id, v_km, v_nivel, coalesce(p -> 'checklist', '{}'), coalesce(p -> 'mapaDanos', '[]'),
          nullif(trim(p ->> 'objetosPersonales'), ''), nullif(trim(p ->> 'accesorios'), ''), v_fotos, nullif(p ->> 'videoInspeccion', ''),
          v_previo, not v_previo, coalesce((p ->> 'autorizaPruebaRuta')::boolean, false), nullif(trim(p ->> 'observaciones'), ''),
          p ->> 'firmaCliente', trim(p ->> 'firmadoPor'), auth.uid())
  returning id into v_rec;

  -- La recepción confirma (verifica) los datos del vehículo y del cliente.
  update public.vehiculos set
    km_ultimo = v_km, km_ultimo_fecha = psr_privado.hoy(),
    color = coalesce(nullif(p -> 'vehiculo' ->> 'color', ''), color),
    vin = coalesce(case when upper(p -> 'vehiculo' ->> 'vin') ~ '^[A-HJ-NPR-Z0-9]{17}$' then upper(p -> 'vehiculo' ->> 'vin') end, vin),
    combustible_tipo = coalesce(case when p -> 'vehiculo' ->> 'combustible' in ('gasolina', 'diesel', 'gas', 'hibrido', 'electrico') then p -> 'vehiculo' ->> 'combustible' end, combustible_tipo),
    actualizado_en = now()
  where id = v_veh.id;
  update public.clientes set
    correo = coalesce(nullif(trim(p -> 'cliente' ->> 'correo'), ''), correo),
    direccion = coalesce(nullif(trim(p -> 'cliente' ->> 'direccion'), ''), direccion),
    verificado = true, actualizado_en = now()
  where id = v_veh.cliente_id;

  insert into public.ordenes_trabajo (recepcion_id, estado, presupuesto_estado)
  values (v_rec, 'recibido', case when v_previo then 'pendiente' else 'no_requerido' end)
  returning id into v_ord;
  insert into public.historial_estados (orden_id, estado, usuario, nota) values (v_ord, 'recibido', auth.uid(), 'Vehículo recibido con acta firmada');

  if v_sol is not null then update public.solicitudes set estado = 'convertida' where id = v_sol; end if;
  insert into public.auditoria (usuario, accion, tabla, registro) values (auth.uid(), 'crear_acta', 'recepciones', v_rec::text);
  return jsonb_build_object('recepcionId', v_rec, 'ordenId', v_ord,
    'codigo', (select codigo_seguimiento from public.solicitudes where id = v_sol));
end $$;

-- 20261115000600_recepcion_ordenes.sql
create or replace function psr_privado.generar_recordatorios(p_orden uuid) returns int
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare o record; t jsonb; pl record; n int := 0;
begin
  select ot.*, r.vehiculo_id into o from public.ordenes_trabajo ot join public.recepciones r on r.id = ot.recepcion_id where ot.id = p_orden;
  for t in select * from jsonb_array_elements(coalesce(o.trabajos, '[]')) loop
    continue when nullif(t ->> 'planId', '') is null;
    select * into pl from public.planes_mantenimiento where id = (t ->> 'planId')::bigint and activo;
    continue when pl.id is null;
    update public.recordatorios set estado = 'descartado'
     where vehiculo_id = o.vehiculo_id and servicio = pl.servicio and estado = 'pendiente';
    insert into public.recordatorios (vehiculo_id, servicio, fecha_estimada, km_estimado)
    values (o.vehiculo_id, pl.servicio,
            case when pl.intervalo_meses is not null then (o.fecha_entrega at time zone 'America/Bogota')::date + make_interval(months => pl.intervalo_meses) end,
            case when pl.intervalo_km is not null then o.km_salida + pl.intervalo_km end);
    n := n + 1;
  end loop;
  return n;
end $$;

-- 20261115000600_recepcion_ordenes.sql
create or replace function public.cambiar_estado_orden(p_orden uuid, p_estado text, p_datos jsonb default '{}') returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare
  o public.ordenes_trabajo;
  r public.recepciones;
  v_nota text := nullif(trim(coalesce(p_datos ->> 'nota', '')), '');
  v_km int; v_garantia date; v_trabajos jsonb;
begin
  perform psr_privado.exigir_taller();
  select * into o from public.ordenes_trabajo where id = p_orden for update;
  if o.id is null then raise exception 'NO_ENCONTRADO'; end if;
  select * into r from public.recepciones where id = o.recepcion_id;
  if p_estado <> 'cancelado' and not (p_estado = any (psr_privado.orden_estados())) then raise exception 'DATOS_INVALIDOS'; end if;
  if o.estado in ('entregado', 'cancelado') and not psr_privado.es_admin() then raise exception 'ORDEN_CERRADA'; end if;
  if p_estado = o.estado then return; end if;

  -- Regla 1: con presupuesto previo, no se repara sin aprobación.
  --   Si el cliente lo RECHAZÓ, el vehículo puede pasar a "listo" para devolverlo sin reparar.
  if r.autoriza_presupuesto_previo and (
       (p_estado in ('en_reparacion', 'en_prueba') and o.presupuesto_estado <> 'aprobado')
    or (p_estado = 'listo' and o.presupuesto_estado = 'pendiente')) then
    raise exception 'PRESUPUESTO_NO_APROBADO' using errcode = 'P0412';
  end if;

  -- Regla 2: sin autorización de prueba de ruta, hay que registrar cómo se probó o la nueva autorización.
  if p_estado = 'en_prueba' and not r.autoriza_prueba_ruta then
    if length(coalesce(p_datos ->> 'autorizacionNueva', '')) >= 5 then
      v_nota := 'Nueva autorización de prueba de ruta: ' || trim(p_datos ->> 'autorizacionNueva');
    elsif length(coalesce(p_datos ->> 'pruebaSinConducir', '')) >= 5 then
      v_nota := 'Prueba sin conducir: ' || trim(p_datos ->> 'pruebaSinConducir');
    else
      raise exception 'PRUEBA_RUTA_NO_AUTORIZADA' using errcode = 'P0412';
    end if;
  end if;

  -- Regla 3: la entrega exige km de salida, trabajos realizados y garantía.
  if p_estado = 'entregado' then
    v_km := nullif(p_datos ->> 'kmSalida', '')::int;
    v_garantia := nullif(p_datos ->> 'garantiaHasta', '')::date;
    v_trabajos := coalesce(p_datos -> 'trabajos', o.trabajos);
    if v_km is null or v_km < coalesce(r.km_ingreso, 0) or v_garantia is null or v_garantia < psr_privado.hoy()
       or jsonb_typeof(v_trabajos) <> 'array' or jsonb_array_length(v_trabajos) = 0 then
      raise exception 'DATOS_ENTREGA' using errcode = 'P0412';
    end if;
    update public.ordenes_trabajo set km_salida = v_km, garantia_hasta = v_garantia, trabajos = v_trabajos, fecha_entrega = now() where id = p_orden;
    update public.vehiculos set km_ultimo = v_km, km_ultimo_fecha = psr_privado.hoy() where id = r.vehiculo_id;
  end if;

  update public.ordenes_trabajo set estado = p_estado where id = p_orden;
  insert into public.historial_estados (orden_id, estado, usuario, nota) values (p_orden, p_estado, auth.uid(), v_nota);
  if p_estado = 'entregado' then
    perform psr_privado.generar_recordatorios(p_orden);
  end if;
end $$;

-- 20261115000600_recepcion_ordenes.sql
create or replace function public.enviar_presupuesto(p_orden uuid, p_total numeric, p_trabajos jsonb) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare o public.ordenes_trabajo;
begin
  perform psr_privado.exigir_taller();
  select * into o from public.ordenes_trabajo where id = p_orden for update;
  if o.id is null then raise exception 'NO_ENCONTRADO'; end if;
  if o.estado in ('entregado', 'cancelado') then raise exception 'ORDEN_CERRADA'; end if;
  if p_total is null or p_total <= 0 or jsonb_typeof(p_trabajos) <> 'array' or jsonb_array_length(p_trabajos) = 0 then raise exception 'DATOS_INVALIDOS'; end if;
  update public.ordenes_trabajo
     set presupuesto_total = p_total, trabajos = p_trabajos, presupuesto_estado = 'pendiente', presupuesto_enviado_en = now(),
         fecha_aprobacion = null, presupuesto_aprobado_por = null, estado = 'esperando_aprobacion'
   where id = p_orden;
  insert into public.historial_estados (orden_id, estado, usuario, nota) values (p_orden, 'esperando_aprobacion', auth.uid(), 'Presupuesto enviado al cliente');
end $$;

-- 20261115000600_recepcion_ordenes.sql
create or replace function public.registrar_respuesta_presupuesto(p_orden uuid, p_decision text, p_nota text) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
begin
  perform psr_privado.exigir_taller();
  if p_decision not in ('aprobado', 'rechazado') or length(trim(coalesce(p_nota, ''))) < 5 then raise exception 'DATOS_INVALIDOS'; end if;
  update public.ordenes_trabajo set presupuesto_estado = p_decision, fecha_aprobacion = now(), presupuesto_aprobado_por = 'taller: ' || trim(p_nota)
   where id = p_orden and presupuesto_estado = 'pendiente' and presupuesto_enviado_en is not null;
  if not found then raise exception 'SIN_PRESUPUESTO_PENDIENTE'; end if;
  insert into public.historial_estados (orden_id, estado, usuario, nota)
  values (p_orden, (select estado from public.ordenes_trabajo where id = p_orden), auth.uid(), 'Presupuesto ' || p_decision || ' (' || trim(p_nota) || ')');
end $$;

-- 20261115000600_recepcion_ordenes.sql
create or replace function public.responder_presupuesto(p_codigo text, p_doc4 text, p_decision text) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_cod text := upper(trim(coalesce(p_codigo, ''))); v_ord uuid;
begin
  perform psr_privado.limitar('presupuesto:' || psr_privado.origen_hash(), 10, interval '15 minutes');
  perform psr_privado.limitar('presupuesto-codigo:' || v_cod, 5, interval '15 minutes');
  if p_decision not in ('aprobado', 'rechazado') then raise exception 'DATOS_INVALIDOS'; end if;
  select o.id into v_ord
    from public.solicitudes s join public.clientes c on c.id = s.cliente_id
    join public.recepciones r on r.solicitud_id = s.id join public.ordenes_trabajo o on o.recepcion_id = r.id
   where s.codigo_seguimiento = v_cod and right(c.numero_documento, 4) = p_doc4
     and o.presupuesto_estado = 'pendiente' and o.presupuesto_enviado_en is not null
   order by o.creado_en desc limit 1;
  if v_ord is null then return null; end if;
  update public.ordenes_trabajo set presupuesto_estado = p_decision, fecha_aprobacion = now(), presupuesto_aprobado_por = 'cliente_portal' where id = v_ord;
  insert into public.historial_estados (orden_id, estado, usuario, nota)
  values (v_ord, 'esperando_aprobacion', null, case when p_decision = 'aprobado' then 'El cliente APROBÓ el presupuesto desde el portal' else 'El cliente RECHAZÓ el presupuesto desde el portal' end);
  insert into public.auditoria (usuario, accion, tabla, registro, detalle)
  values (null, 'presupuesto_' || p_decision, 'ordenes_trabajo', v_ord::text, jsonb_build_object('canal', 'portal'));
  return jsonb_build_object('estado', p_decision);
end $$;

-- 20261115000600_recepcion_ordenes.sql
create or replace function public.consultar_estado(p_codigo text, p_doc4 text) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare
  v_cod text := upper(trim(coalesce(p_codigo, '')));
  s record; ci record; o record; v_rec record;
  v_estados text[] := psr_privado.orden_estados();
  v_nombres text[] := array['Vehículo recibido', 'En diagnóstico', 'Esperando tu aprobación', 'En reparación', 'En prueba', 'Listo para entregar', 'Entregado'];
  v_idx int; v_pasos jsonb; i int;
begin
  perform psr_privado.limitar('consulta:' || psr_privado.origen_hash(), 10, interval '15 minutes');
  perform psr_privado.limitar('consulta-codigo:' || v_cod, 5, interval '15 minutes');
  select so.id, so.codigo_seguimiento, so.creado_en, v.placa, concat_ws(' ', v.marca, v.linea_modelo) as linea into s
    from public.solicitudes so
    join public.clientes c on c.id = so.cliente_id
    join public.vehiculos v on v.id = so.vehiculo_id
   where so.codigo_seguimiento = v_cod and right(c.numero_documento, 4) = p_doc4 and c.anonimizado_en is null;
  if not found then return null; end if;
  select fecha, franja, estado, confirmada_en into ci from public.citas where solicitud_id = s.id order by creado_en desc limit 1;
  select ot.* into o from public.ordenes_trabajo ot join public.recepciones r on r.id = ot.recepcion_id
   where r.solicitud_id = s.id order by ot.creado_en desc limit 1;

  v_idx := coalesce(array_position(v_estados, o.estado), 0);
  v_pasos := jsonb_build_array(
    jsonb_build_object('clave', 'recibida', 'nombre', 'Solicitud recibida', 'fecha', s.creado_en, 'hecho', true),
    jsonb_build_object('clave', 'cita', 'nombre', 'Cita confirmada', 'fecha', ci.confirmada_en,
                       'hecho', coalesce(ci.estado = 'confirmada', false) or o.id is not null));
  for i in 1..array_length(v_estados, 1) loop
    v_pasos := v_pasos || jsonb_build_object(
      'clave', v_estados[i], 'nombre', v_nombres[i],
      'fecha', (select min(h.fecha) from public.historial_estados h where h.orden_id = o.id and h.estado = v_estados[i]),
      'hecho', o.id is not null and o.estado <> 'cancelado' and v_idx >= i,
      'nota', case when v_estados[i] = 'esperando_aprobacion' and o.presupuesto_estado = 'no_requerido' then 'No requerida: autorizaste reparar sin presupuesto previo' end);
  end loop;

  return jsonb_build_object(
    'codigo', s.codigo_seguimiento, 'placa', s.placa, 'linea', s.linea,
    'cita', case when ci.fecha is null then null else jsonb_build_object('fecha', ci.fecha, 'franja', ci.franja, 'estado', ci.estado) end,
    'pasos', v_pasos,
    'cancelada', coalesce(o.estado = 'cancelado', false),
    'presupuesto', case when o.presupuesto_enviado_en is null then null else jsonb_build_object(
       'total', o.presupuesto_total, 'estado', o.presupuesto_estado, 'enviadoEn', o.presupuesto_enviado_en,
       'trabajos', coalesce((select jsonb_agg(jsonb_build_object('descripcion', t ->> 'descripcion', 'repuestos', t ->> 'repuestos')) from jsonb_array_elements(o.trabajos) t), '[]')) end,
    'entrega', case when o.estado = 'entregado' then jsonb_build_object('fecha', o.fecha_entrega, 'garantiaHasta', o.garantia_hasta) end);
end $$;

-- 20261115000600_recepcion_ordenes.sql
create or replace function public.ver_vehiculo(p_placa text) returns jsonb
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare v_placa text := upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g')); r jsonb;
begin
  perform psr_privado.exigir_taller();
  select jsonb_build_object(
    'vehiculo', jsonb_build_object('id', v.id, 'placa', v.placa, 'marca', v.marca, 'linea', v.linea_modelo, 'anio', v.anio_modelo, 'color', v.color,
                                   'vin', v.vin, 'combustible', v.combustible_tipo, 'km', v.km_ultimo),
    'cliente', jsonb_build_object('id', c.id, 'tipoDocumento', c.tipo_documento, 'numeroDocumento', c.numero_documento, 'nombre', c.nombre_razon_social,
                                  'celular', c.celular, 'correo', c.correo, 'direccion', c.direccion),
    'ordenAbierta', exists (select 1 from public.ordenes_trabajo o join public.recepciones r on r.id = o.recepcion_id
                             where r.vehiculo_id = v.id and o.estado not in ('entregado', 'cancelado')),
    'solicitudId', (select s.id from public.solicitudes s where s.vehiculo_id = v.id and s.estado in ('nueva', 'en_revision') order by s.creado_en desc limit 1))
    into r
    from public.vehiculos v join public.clientes c on c.id = v.cliente_id
   where v.placa = v_placa;
  if r is not null then
    insert into public.auditoria (usuario, accion, tabla, registro) values (auth.uid(), 'ver', 'clientes', r -> 'cliente' ->> 'id');
  end if;
  return r;
end $$;

-- 20261115000700_clientes_mantenimiento.sql
create or replace view psr_privado.lecturas_km as
  select vehiculo_id, km_reportado as km, creado_en::date as fecha from public.solicitudes where km_reportado is not null
  union all select vehiculo_id, km_ingreso, (fecha_hora at time zone 'America/Bogota')::date from public.recepciones where km_ingreso is not null
  union all select r.vehiculo_id, o.km_salida, (o.fecha_entrega at time zone 'America/Bogota')::date
              from public.ordenes_trabajo o join public.recepciones r on r.id = o.recepcion_id where o.km_salida is not null and o.fecha_entrega is not null
  union all select id, km_ultimo, km_ultimo_fecha from public.vehiculos where km_ultimo is not null and km_ultimo_fecha is not null;

-- 20261115000700_clientes_mantenimiento.sql
create or replace function psr_privado.km_por_dia(p_vehiculo uuid) returns numeric
language sql stable security definer set search_path = public, psr_privado as $$
  with l as (select km, fecha from psr_privado.lecturas_km where vehiculo_id = p_vehiculo),
       a as (select (select km from l order by fecha, km limit 1) km0, min(fecha) f0,
                    (select km from l order by fecha desc, km desc limit 1) km1, max(fecha) f1, count(*) n from l)
  select case when n >= 2 and f1 - f0 >= 14 and km1 >= km0 then least(round((km1 - km0)::numeric / (f1 - f0), 1), 500) end from a
$$;

-- 20261115000700_clientes_mantenimiento.sql
create or replace view psr_privado.v_recordatorios as
  select r.*, v.placa, v.marca, v.linea_modelo, v.cliente_id, v.km_ultimo, v.km_ultimo_fecha,
         psr_privado.km_por_dia(v.id) as km_dia,
         case when r.km_estimado is not null and psr_privado.km_por_dia(v.id) > 0 and v.km_ultimo is not null
              then v.km_ultimo_fecha + ceil(greatest(r.km_estimado - v.km_ultimo, 0) / psr_privado.km_por_dia(v.id))::int end as fecha_por_km
    from public.recordatorios r join public.vehiculos v on v.id = r.vehiculo_id;

-- 20261115000700_clientes_mantenimiento.sql
create or replace function psr_privado.fecha_objetivo(r psr_privado.v_recordatorios) returns date
language sql immutable as $$ select coalesce(least(r.fecha_estimada, r.fecha_por_km), r.fecha_estimada, r.fecha_por_km) $$;

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000700_clientes_mantenimiento.sql
create or replace function public.registrar_exportacion(p_filas int, p_formato text) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  insert into public.auditoria (usuario, accion, tabla, detalle) values (auth.uid(), 'exportar', 'clientes', jsonb_build_object('filas', p_filas, 'formato', p_formato));
end $$;

-- 20261115000700_clientes_mantenimiento.sql
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

-- 20261115000800_configuracion_admin.sql
create or replace function public.config_publica() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select valor from public.config_taller where clave = 'publico'), '{}'::jsonb)
$$;

-- 20261115000800_configuracion_admin.sql
create or replace function public.usuarios_taller() returns jsonb
language plpgsql stable security definer set search_path = public, psr_privado, auth as $$
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', p.rol, 'especialidad', p.especialidad, 'activo', p.activo,
                                                       'correo', (select u.email from auth.users u where u.id = p.id)) order by p.nombre)
                     from public.perfiles p), '[]');
end $$;

-- 20261115000800_configuracion_admin.sql
create or replace function public.agregar_usuario(p_correo text, p_nombre text, p_rol text) returns uuid
language plpgsql volatile security definer set search_path = public, psr_privado, auth as $$
declare v uuid;
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  if p_rol not in ('admin', 'tecnico') or length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'DATOS_INVALIDOS'; end if;
  select id into v from auth.users where lower(email) = lower(trim(p_correo));
  if v is null then raise exception 'USUARIO_NO_EXISTE'; end if;
  insert into public.perfiles (id, nombre, rol) values (v, trim(p_nombre), p_rol)
  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, activo = true;
  insert into public.auditoria (usuario, accion, tabla, registro, detalle) values (auth.uid(), 'dar_acceso', 'perfiles', v::text, jsonb_build_object('rol', p_rol));
  return v;
end $$;

-- 20261115000800_configuracion_admin.sql
create or replace function public.actualizar_usuario(p_id uuid, p_rol text, p_activo boolean, p_especialidad text default null) returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  if p_rol not in ('admin', 'tecnico') then raise exception 'DATOS_INVALIDOS'; end if;
  -- Nunca dejar el taller sin administrador activo.
  if (p_rol <> 'admin' or not p_activo)
     and not exists (select 1 from public.perfiles where activo and rol = 'admin' and id <> p_id) then
    raise exception 'ULTIMO_ADMIN';
  end if;
  update public.perfiles set rol = p_rol, activo = p_activo,
    especialidad = case when p_especialidad in ('mecanica', 'electrica', 'general') then p_especialidad else especialidad end
  where id = p_id;
  insert into public.auditoria (usuario, accion, tabla, registro, detalle)
  values (auth.uid(), 'cambiar_acceso', 'perfiles', p_id::text, jsonb_build_object('rol', p_rol, 'activo', p_activo));
end $$;

-- 20261115000800_configuracion_admin.sql
create or replace function public.probar_semaforo(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, psr_privado as $$
declare z text[]; s text[];
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  select coalesce(array_agg(x), '{}') into z from jsonb_array_elements_text(coalesce(p -> 'zonas', '[]')) x;
  select coalesce(array_agg(x), '{}') into s from jsonb_array_elements_text(coalesce(p -> 'sintomas', '[]')) x;
  return psr_privado.clasificar(z, s, p ->> 'descripcion', coalesce(p ->> 'movilidad', 'si'));
end $$;

-- 20261115000800_configuracion_admin.sql
create or replace function public.alta_rapida(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare
  v_tipo text := coalesce(p ->> 'tipoDocumento', 'CC');
  v_doc text := case when v_tipo = 'PAS' then upper(regexp_replace(coalesce(p ->> 'numeroDocumento', ''), '[^A-Za-z0-9]', '', 'g')) else regexp_replace(coalesce(p ->> 'numeroDocumento', ''), '\D', '', 'g') end;
  v_placa text := upper(regexp_replace(coalesce(p ->> 'placa', ''), '[^A-Za-z0-9]', '', 'g'));
  v_cli uuid; v_veh uuid; v_sol uuid;
begin
  perform psr_privado.exigir_taller();
  if coalesce((p ->> 'autorizaDatos')::boolean, false) is not true or v_tipo not in ('CC', 'CE', 'NIT', 'PAS') or length(v_doc) < 4
     or length(trim(coalesce(p ->> 'nombre', ''))) < 2 or length(regexp_replace(coalesce(p ->> 'celular', ''), '\D', '', 'g')) < 7
     or length(v_placa) not between 3 and 8 or length(trim(coalesce(p ->> 'marca', ''))) < 1 then
    raise exception 'DATOS_INVALIDOS' using errcode = 'P0422';
  end if;
  select id into v_cli from public.clientes where tipo_documento = v_tipo and numero_documento = v_doc;
  if v_cli is null then
    insert into public.clientes (tipo_documento, numero_documento, nombre_razon_social, celular, correo, origen, autoriza_datos, autoriza_datos_fecha, autoriza_datos_version, verificado)
    values (v_tipo, v_doc, trim(p ->> 'nombre'), regexp_replace(p ->> 'celular', '\D', '', 'g'), nullif(trim(p ->> 'correo'), ''), 'taller', true, now(),
            coalesce((select valor #>> '{}' from public.config_taller where clave = 'aviso_privacidad_version'), 'sin-version'), true)
    returning id into v_cli;
  else
    -- Cliente conocido (p. ej. importado): en persona da la autorización que faltaba.
    update public.clientes set autoriza_datos = true, autoriza_datos_fecha = coalesce(autoriza_datos_fecha, now()),
      autoriza_datos_version = coalesce(autoriza_datos_version, 'taller'), verificado = true where id = v_cli;
  end if;
  select id into v_veh from public.vehiculos where placa = v_placa;
  if v_veh is null then
    insert into public.vehiculos (cliente_id, placa, marca, linea_modelo, anio_modelo)
    values (v_cli, v_placa, trim(p ->> 'marca'), nullif(trim(p ->> 'linea'), ''), nullif(regexp_replace(coalesce(p ->> 'anio', ''), '\D', '', 'g'), '')::smallint)
    returning id into v_veh;
  elsif (select cliente_id from public.vehiculos where id = v_veh) <> v_cli then
    raise exception 'PLACA_DE_OTRO_CLIENTE';
  end if;
  insert into public.solicitudes (codigo_seguimiento, cliente_id, vehiculo_id, zonas, sintomas, descripcion, puede_movilizarse, autoriza_presupuesto,
                                  autoriza_prueba_ruta, autoriza_datos_en, autoriza_datos_version, canal, estado)
  values (psr_privado.nuevo_codigo(), v_cli, v_veh, '{nose}', '{}', trim(coalesce(p ->> 'motivo', '')), 'si',
          'previo', false, now(), 'taller', 'taller', 'en_revision')
  returning id into v_sol;
  insert into public.auditoria (usuario, accion, tabla, registro) values (auth.uid(), 'alta_rapida', 'clientes', v_cli::text);
  return v_sol;
end $$;

-- 20261115000800_configuracion_admin.sql
create or replace function psr_privado.archivos_huerfanos() returns setof text
language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
   where o.bucket_id = 'solicitudes' and o.name like 'pendientes/%' and o.created_at < now() - interval '2 days'
     and not exists (select 1 from public.solicitudes s, jsonb_array_elements(s.adjuntos) a where a ->> 'ruta' = o.name)
     and not exists (select 1 from public.vehiculos v where v.foto_tarjeta_propiedad = o.name)
$$;

-- 20261115000800_configuracion_admin.sql
create or replace function psr_privado.archivos_suprimidos() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct ruta from (
    select r.firma_cliente_url as ruta from public.recepciones r join public.vehiculos v on v.id = r.vehiculo_id join public.clientes c on c.id = v.cliente_id where c.anonimizado_en is not null
    union all select f ->> 'ruta' from public.recepciones r join public.vehiculos v on v.id = r.vehiculo_id join public.clientes c on c.id = v.cliente_id, jsonb_array_elements(r.fotos) f where c.anonimizado_en is not null
    union all select r.video_inspeccion_url from public.recepciones r join public.vehiculos v on v.id = r.vehiculo_id join public.clientes c on c.id = v.cliente_id where c.anonimizado_en is not null
  ) x where ruta is not null and ruta <> 'borrado'
$$;

-- 20261115000800_configuracion_admin.sql
create or replace function psr_privado.marcar_archivos_borrados(p_rutas text[]) returns void
language sql volatile security definer set search_path = public as $$
  update public.recepciones set firma_cliente_url = 'borrado' where firma_cliente_url = any (p_rutas);
  update public.recepciones set video_inspeccion_url = null where video_inspeccion_url = any (p_rutas);
  update public.recepciones set fotos = (select coalesce(jsonb_agg(case when f ->> 'ruta' = any (p_rutas) then f || '{"ruta":"borrado"}' else f end), '[]') from jsonb_array_elements(fotos) f)
   where exists (select 1 from jsonb_array_elements(fotos) f where f ->> 'ruta' = any (p_rutas));
$$;

-- 20261115000800_configuracion_admin.sql
create or replace function public.limpieza_pendiente() returns jsonb
language sql stable security definer set search_path = public, psr_privado as $$
  select jsonb_build_object('huerfanos', coalesce((select jsonb_agg(x) from psr_privado.archivos_huerfanos() x), '[]'),
                            'suprimidos', coalesce((select jsonb_agg(x) from psr_privado.archivos_suprimidos() x), '[]'))
$$;

-- 20261115000800_configuracion_admin.sql
create or replace function public.limpieza_marcar(p_rutas text[]) returns void
language sql volatile security definer set search_path = public, psr_privado as $$ select psr_privado.marcar_archivos_borrados(p_rutas) $$;

-- 2) Datos: convierte de vuelta solo el texto que tiene el daño.
create or replace function psr_privado.reparar_tildes_texto(t text) returns text
language plpgsql immutable as $$
declare
  v_mapa constant text := 'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';
  v_hex text := '';
  c text;
  p int;
begin
  if t is null or t !~ '[¬√‚·ŒœÔ]' then return t; end if;
  foreach c in array regexp_split_to_array(t, '') loop
    if ascii(c) < 128 then v_hex := v_hex || lpad(to_hex(ascii(c)), 2, '0');
    else
      p := strpos(v_mapa, c);
      if p = 0 then return t; end if;  -- no es texto dañado: se deja igual
      v_hex := v_hex || to_hex(127 + p);
    end if;
  end loop;
  return convert_from(decode(v_hex, 'hex'), 'UTF8');
exception when others then
  return t;  -- si no es UTF-8 válido, no era texto dañado
end $$;

do $$
declare
  r record;
  n int;
  total int := 0;
begin
  for r in
    select c.table_schema s, c.table_name tb, c.column_name col, c.data_type dt, c.udt_name udt
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema in ('public', 'psr_privado')
      and (c.data_type in ('text', 'character varying', 'jsonb') or c.udt_name = '_text')
  loop
    if r.dt = 'jsonb' then
      execute format('update %I.%I set %I = psr_privado.reparar_tildes_texto(%I::text)::jsonb where %I::text ~ ''[¬√‚·ŒœÔ]''',
                     r.s, r.tb, r.col, r.col, r.col);
    elsif r.udt = '_text' then
      execute format('update %I.%I set %I = (select array_agg(psr_privado.reparar_tildes_texto(x) order by o) from unnest(%I) with ordinality u(x, o)) where array_to_string(%I, '' '') ~ ''[¬√‚·ŒœÔ]''',
                     r.s, r.tb, r.col, r.col, r.col);
    else
      execute format('update %I.%I set %I = psr_privado.reparar_tildes_texto(%I) where %I ~ ''[¬√‚·ŒœÔ]''',
                     r.s, r.tb, r.col, r.col, r.col);
    end if;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  raise notice 'Filas reparadas: %', total;
end $$;

drop function psr_privado.reparar_tildes_texto(text);

-- 3) Comprobación: debe decir "PSR Pasión Sobre Ruedas".
select valor ->> 'nombre' as nombre_del_taller from public.config_taller where clave = 'publico';

commit;
