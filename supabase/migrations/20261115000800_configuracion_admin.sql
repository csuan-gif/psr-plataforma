-- =====================================================================
-- 0008 · Configuración del administrador (7.7): datos públicos del taller,
-- usuarios y roles, probador del semáforo, alta rápida en recepción y
-- apoyo a la limpieza de archivos (Edge Function "limpieza").
-- =====================================================================

-- ---------- Datos públicos del taller (los lee el portal) ----------
-- Solo campos pensados para mostrarse en público. EDITAR desde Ajustes.
insert into public.config_taller (clave, valor) values ('publico', '{
  "nombre": "PSR Pasión Sobre Ruedas", "whatsapp": "573000000000", "telefono": "+57 300 000 0000", "correo": "contacto@ejemplo.com",
  "direccion": "Barrio Santa María del Lago, Engativá, Bogotá", "mapa": "",
  "horarios": [{"dias": "Lunes a viernes", "horas": "7:30 a. m. – 5:30 p. m."}, {"dias": "Sábados", "horas": "8:00 a. m. – 1:00 p. m."}],
  "responsableDatos": "", "nit": "", "conservacion": "", "regionDatos": ""
}') on conflict (clave) do nothing;

create or replace function public.config_publica() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select valor from public.config_taller where clave = 'publico'), '{}'::jsonb)
$$;

-- ---------- Usuarios del taller ----------
create or replace function public.usuarios_taller() returns jsonb
language plpgsql stable security definer set search_path = public, psr_privado, auth as $$
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', p.rol, 'especialidad', p.especialidad, 'activo', p.activo,
                                                       'correo', (select u.email from auth.users u where u.id = p.id)) order by p.nombre)
                     from public.perfiles p), '[]');
end $$;

-- El usuario se crea primero en Supabase → Authentication (correo y contraseña); aquí se le da acceso al taller.
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

-- ---------- Probar el semáforo sin crear una solicitud (solo admin) ----------
create or replace function public.probar_semaforo(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, psr_privado as $$
declare z text[]; s text[];
begin
  if not psr_privado.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  select coalesce(array_agg(x), '{}') into z from jsonb_array_elements_text(coalesce(p -> 'zonas', '[]')) x;
  select coalesce(array_agg(x), '{}') into s from jsonb_array_elements_text(coalesce(p -> 'sintomas', '[]')) x;
  return psr_privado.clasificar(z, s, p ->> 'descripcion', coalesce(p ->> 'movilidad', 'si'));
end $$;

-- ---------- Alta rápida: cliente que llega sin solicitud (desde el acta) ----------
-- Crea cliente + vehículo + solicitud (canal "taller") y devuelve la solicitud para abrir el acta.
-- La autorización de datos la da el cliente en el taller y queda registrada.
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

-- ---------- Apoyo a la Edge Function de limpieza (se ejecuta con la service_role, en el servidor) ----------
-- Archivos subidos al portal hace más de 2 días que no quedaron en ninguna solicitud.
create or replace function psr_privado.archivos_huerfanos() returns setof text
language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
   where o.bucket_id = 'solicitudes' and o.name like 'pendientes/%' and o.created_at < now() - interval '2 days'
     and not exists (select 1 from public.solicitudes s, jsonb_array_elements(s.adjuntos) a where a ->> 'ruta' = o.name)
     and not exists (select 1 from public.vehiculos v where v.foto_tarjeta_propiedad = o.name)
$$;
-- Archivos de actas de clientes anonimizados (fotos, video y firma) que se deben borrar.
create or replace function psr_privado.archivos_suprimidos() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct ruta from (
    select r.firma_cliente_url as ruta from public.recepciones r join public.vehiculos v on v.id = r.vehiculo_id join public.clientes c on c.id = v.cliente_id where c.anonimizado_en is not null
    union all select f ->> 'ruta' from public.recepciones r join public.vehiculos v on v.id = r.vehiculo_id join public.clientes c on c.id = v.cliente_id, jsonb_array_elements(r.fotos) f where c.anonimizado_en is not null
    union all select r.video_inspeccion_url from public.recepciones r join public.vehiculos v on v.id = r.vehiculo_id join public.clientes c on c.id = v.cliente_id where c.anonimizado_en is not null
  ) x where ruta is not null and ruta <> 'borrado'
$$;
create or replace function psr_privado.marcar_archivos_borrados(p_rutas text[]) returns void
language sql volatile security definer set search_path = public as $$
  update public.recepciones set firma_cliente_url = 'borrado' where firma_cliente_url = any (p_rutas);
  update public.recepciones set video_inspeccion_url = null where video_inspeccion_url = any (p_rutas);
  update public.recepciones set fotos = (select coalesce(jsonb_agg(case when f ->> 'ruta' = any (p_rutas) then f || '{"ruta":"borrado"}' else f end), '[]') from jsonb_array_elements(fotos) f)
   where exists (select 1 from jsonb_array_elements(fotos) f where f ->> 'ruta' = any (p_rutas));
$$;
-- La Edge Function usa la service_role; se expone una sola función envoltorio para ella.
create or replace function public.limpieza_pendiente() returns jsonb
language sql stable security definer set search_path = public, psr_privado as $$
  select jsonb_build_object('huerfanos', coalesce((select jsonb_agg(x) from psr_privado.archivos_huerfanos() x), '[]'),
                            'suprimidos', coalesce((select jsonb_agg(x) from psr_privado.archivos_suprimidos() x), '[]'))
$$;
create or replace function public.limpieza_marcar(p_rutas text[]) returns void
language sql volatile security definer set search_path = public, psr_privado as $$ select psr_privado.marcar_archivos_borrados(p_rutas) $$;

-- ---------- Permisos ----------
revoke execute on function psr_privado.archivos_huerfanos(), psr_privado.archivos_suprimidos(), psr_privado.marcar_archivos_borrados(text[]) from public, anon, authenticated;
revoke execute on function public.config_publica(), public.usuarios_taller(), public.agregar_usuario(text, text, text), public.actualizar_usuario(uuid, text, boolean, text),
  public.probar_semaforo(jsonb), public.alta_rapida(jsonb), public.limpieza_pendiente(), public.limpieza_marcar(text[]) from public, anon, authenticated;
grant execute on function public.config_publica() to anon, authenticated;
grant execute on function public.usuarios_taller(), public.agregar_usuario(text, text, text), public.actualizar_usuario(uuid, text, boolean, text),
  public.probar_semaforo(jsonb), public.alta_rapida(jsonb) to authenticated;
-- limpieza_pendiente / limpieza_marcar: solo service_role (la usa la Edge Function).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.limpieza_pendiente(), public.limpieza_marcar(text[]) to service_role';
  end if;
end $$;
