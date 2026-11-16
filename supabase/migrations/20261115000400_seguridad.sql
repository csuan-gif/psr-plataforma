-- =====================================================================
-- 0004 · Seguridad: RLS en todas las tablas, permisos mínimos por rol,
-- Realtime y Storage privado.
--   anon (portal):  solo RPC + lectura del catálogo de síntomas.
--   taller:         usuarios autenticados con fila en perfiles.
--   admin:          configuración, reglas, auditoría y supresión.
-- =====================================================================

-- 1) RLS en todas las tablas del esquema público.
do $$ declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 2) Permisos de tabla: el anónimo no toca ninguna tabla salvo el catálogo.
revoke all on all tables in schema public from anon;
grant select on public.zonas, public.sintomas to anon;
revoke all on all tables in schema psr_privado from anon, authenticated;

-- 3) Funciones: nadie ejecuta nada salvo lo concedido explícitamente.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema psr_privado from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema psr_privado revoke execute on functions from public, anon, authenticated;

grant execute on function public.crear_solicitud(jsonb) to anon, authenticated;
grant execute on function public.disponibilidad_publica(date, date) to anon, authenticated;
grant execute on function public.precargar_vehiculo(text, text, text) to anon, authenticated;
grant execute on function public.consultar_estado(text, text) to anon, authenticated;
grant execute on function public.cambiar_semaforo(uuid, text, text) to authenticated;
grant usage on schema psr_privado to authenticated;
grant execute on function psr_privado.es_taller(), psr_privado.es_admin() to authenticated;

-- 4) Políticas.
create policy catalogo_publico_z on public.zonas for select to anon using (activo);
create policy catalogo_publico_s on public.sintomas for select to anon using (activo);
create policy catalogo_lectura_z on public.zonas for select to authenticated using (activo or psr_privado.es_admin());
create policy catalogo_lectura_s on public.sintomas for select to authenticated using (activo or psr_privado.es_admin());
create policy catalogo_admin_z on public.zonas for all to authenticated using (psr_privado.es_admin()) with check (psr_privado.es_admin());
create policy catalogo_admin_s on public.sintomas for all to authenticated using (psr_privado.es_admin()) with check (psr_privado.es_admin());

create policy perfil_propio on public.perfiles for select to authenticated using (id = auth.uid() or psr_privado.es_taller());
create policy perfil_admin on public.perfiles for all to authenticated using (psr_privado.es_admin()) with check (psr_privado.es_admin());

-- Datos operativos: todo el taller lee y escribe; solo el admin borra.
do $$ declare t text;
begin
  foreach t in array array['clientes', 'vehiculos', 'solicitudes', 'citas', 'recepciones', 'ordenes_trabajo', 'historial_estados', 'recordatorios'] loop
    execute format('create policy taller_leer on public.%I for select to authenticated using (psr_privado.es_taller())', t);
    execute format('create policy taller_crear on public.%I for insert to authenticated with check (psr_privado.es_taller())', t);
    execute format('create policy taller_editar on public.%I for update to authenticated using (psr_privado.es_taller()) with check (psr_privado.es_taller())', t);
    execute format('create policy admin_borrar on public.%I for delete to authenticated using (psr_privado.es_admin())', t);
  end loop;
end $$;

-- Semáforo: el taller lo lee; se cambia SOLO con cambiar_semaforo() (motivo obligatorio).
create policy taller_leer on public.triage_interno for select to authenticated using (psr_privado.es_taller());
create policy taller_leer on public.cambios_semaforo for select to authenticated using (psr_privado.es_taller());
revoke insert, update, delete on public.triage_interno, public.cambios_semaforo from authenticated;

-- Configuración: el taller la lee, el admin la edita.
do $$ declare t text;
begin
  foreach t in array array['reglas_semaforo', 'planes_mantenimiento', 'config_taller', 'disponibilidad', 'dias_bloqueados', 'festivos'] loop
    execute format('create policy taller_leer on public.%I for select to authenticated using (psr_privado.es_taller())', t);
    execute format('create policy admin_todo on public.%I for all to authenticated using (psr_privado.es_admin()) with check (psr_privado.es_admin())', t);
  end loop;
end $$;

-- Auditoría: solo el admin la consulta; nadie la modifica.
create policy admin_leer on public.auditoria for select to authenticated using (psr_privado.es_admin());
revoke insert, update, delete on public.auditoria from authenticated;

-- 5) Realtime para el panel del taller (respeta RLS: el anónimo no recibe nada).
alter publication supabase_realtime add table public.solicitudes, public.triage_interno, public.citas;

-- 6) Storage privado. El anónimo solo puede SUBIR a pendientes/ (no leer, no listar, no borrar).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('solicitudes', 'solicitudes', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
         'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp',
         'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/x-m4a']),
  ('recepciones', 'recepciones', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'])
on conflict (id) do nothing;

create policy portal_sube_pendientes on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'solicitudes' and (storage.foldername(name))[1] = 'pendientes');
create policy taller_lee_archivos on storage.objects for select to authenticated
  using (bucket_id in ('solicitudes', 'recepciones') and psr_privado.es_taller());
create policy taller_gestiona_recepciones on storage.objects for insert to authenticated
  with check (bucket_id = 'recepciones' and psr_privado.es_taller());
create policy admin_borra_archivos on storage.objects for delete to authenticated
  using (bucket_id in ('solicitudes', 'recepciones') and psr_privado.es_admin());
