-- =====================================================================
-- 0003 · Funciones (RPC). El portal público SOLO entra por aquí.
-- Ninguna respuesta pública incluye el semáforo ni datos personales.
-- =====================================================================

-- ---------- Utilidades internas ----------
create or replace function psr_privado.hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;

create or replace function psr_privado.origen_hash() returns text
language plpgsql stable as $$
declare h text := nullif(current_setting('request.headers', true), '');
        ip text;
begin
  if h is not null then ip := split_part(coalesce(h::json ->> 'x-forwarded-for', h::json ->> 'x-real-ip', ''), ',', 1); end if;
  return md5('psr:' || coalesce(nullif(trim(ip), ''), 'sin-ip'));
end $$;

-- Límite de intentos (anti fuerza bruta). Lanza DEMASIADOS_INTENTOS.
create or replace function psr_privado.limitar(p_clave text, p_max int, p_ventana interval) returns void
language plpgsql security definer set search_path = psr_privado as $$
begin
  delete from psr_privado.intentos where creado_en < now() - interval '1 day';
  if (select count(*) from psr_privado.intentos where clave = p_clave and creado_en > now() - p_ventana) >= p_max then
    raise exception 'DEMASIADOS_INTENTOS' using errcode = 'P0429';
  end if;
  insert into psr_privado.intentos (clave) values (p_clave);
end $$;

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

-- Festivos de Colombia (Ley 51 de 1983). Igual a src/compartido/util/festivos.ts
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

-- ---------- Catálogo y disponibilidad pública ----------
-- Solo dice si una franja tiene cupo: nunca cuántas citas hay ni de quién.
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

-- ---------- Crear solicitud (portal) ----------
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

-- ---------- "Ya soy cliente": solo datos del VEHÍCULO ----------
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

-- ---------- Consultar estado con código + 4 dígitos ----------
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

-- ---------- Taller ----------
create or replace function psr_privado.es_taller() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo)
$$;
create or replace function psr_privado.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo and rol = 'admin')
$$;

-- Cambiar el semáforo exige motivo y queda registrado.
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

-- Auditoría automática de cambios en datos personales.
create or replace function psr_privado.tg_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria (usuario, accion, tabla, registro)
  values (auth.uid(), lower(tg_op), tg_table_name, (case when tg_op = 'DELETE' then old.id else new.id end)::text);
  return coalesce(new, old);
end $$;
create trigger auditar_clientes after update or delete on public.clientes for each row execute function psr_privado.tg_auditar();
create trigger auditar_vehiculos after update or delete on public.vehiculos for each row execute function psr_privado.tg_auditar();
