-- =====================================================================
-- 0006 · Recepción digital (acta de ingreso), órdenes de trabajo con
-- reglas de negocio, presupuesto y consulta de estado del cliente.
-- El acta es EVIDENCIA: una vez firmada no se edita ni se borra.
-- =====================================================================

alter table public.ordenes_trabajo add column presupuesto_enviado_en timestamptz;
alter table public.ordenes_trabajo add column presupuesto_aprobado_por text; -- 'cliente_portal' o nota del taller
alter table public.recepciones add column firmado_por text;
alter table public.recepciones add column orden_previa_abierta boolean not null default false;

-- Solo una orden abierta por vehículo: la regla está en crear_recepcion (ORDEN_ABIERTA).

-- Permisos: las órdenes, el historial y las actas solo cambian por funciones.
revoke insert, update, delete on public.recepciones, public.historial_estados from authenticated;
revoke insert, update on public.ordenes_trabajo from authenticated;
grant update (trabajos, tecnico_asignado) on public.ordenes_trabajo to authenticated;

alter publication supabase_realtime add table public.ordenes_trabajo, public.historial_estados;

create or replace function psr_privado.orden_estados() returns text[]
language sql immutable as $$ select array['recibido', 'en_diagnostico', 'esperando_aprobacion', 'en_reparacion', 'en_prueba', 'listo', 'entregado'] $$;

-- ---------- Crear el acta de ingreso y abrir la orden ----------
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

-- ---------- Recordatorios al entregar (se refinan en la Fase 4) ----------
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

-- ---------- Cambiar el estado de una orden (reglas de negocio) ----------
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

-- ---------- Presupuesto ----------
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

-- El taller registra una aprobación recibida por teléfono o en persona (con nota obligatoria).
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

-- El cliente aprueba o rechaza desde el portal (código + 4 dígitos). Queda registrado.
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

-- ---------- Consulta del cliente: línea de tiempo completa ----------
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

-- Permisos de las funciones nuevas.
revoke execute on function psr_privado.generar_recordatorios(uuid), psr_privado.orden_estados() from public, anon, authenticated;
revoke execute on function public.crear_recepcion(jsonb), public.cambiar_estado_orden(uuid, text, jsonb), public.enviar_presupuesto(uuid, numeric, jsonb),
  public.registrar_respuesta_presupuesto(uuid, text, text), public.responder_presupuesto(text, text, text) from public, anon;
grant execute on function public.crear_recepcion(jsonb), public.cambiar_estado_orden(uuid, text, jsonb), public.enviar_presupuesto(uuid, numeric, jsonb),
  public.registrar_respuesta_presupuesto(uuid, text, text) to authenticated;
grant execute on function public.responder_presupuesto(text, text, text) to anon, authenticated;

-- ---------- Abrir el acta buscando por placa (queda en auditoría) ----------
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
revoke execute on function public.ver_vehiculo(text) from public, anon;
grant execute on function public.ver_vehiculo(text) to authenticated;
