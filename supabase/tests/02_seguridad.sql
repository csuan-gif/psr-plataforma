-- Pruebas de seguridad (regla 1 y sección 11). Se ejecutan como el rol anónimo
-- del portal y como usuarios del taller. Cada bloque falla con 'FALLA ...'.

-- ===== Como ANÓNIMO (portal público) =====
set role anon;

-- No puede leer el semáforo, las reglas, ni datos personales.
do $$ begin perform 1 from public.triage_interno limit 1; raise exception 'FALLA: anon leyó triage_interno';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.reglas_semaforo limit 1; raise exception 'FALLA: anon leyó reglas_semaforo';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.clientes limit 1; raise exception 'FALLA: anon leyó clientes';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.solicitudes limit 1; raise exception 'FALLA: anon leyó solicitudes';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.citas limit 1; raise exception 'FALLA: anon leyó citas';
exception when insufficient_privilege then null; end $$;
do $$ begin insert into public.solicitudes (codigo_seguimiento) values ('X'); raise exception 'FALLA: anon insertó directo en solicitudes';
exception when insufficient_privilege then null; end $$;
do $$ begin perform psr_privado.clasificar('{}', '{}', '', 'si'); raise exception 'FALLA: anon ejecutó clasificar';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.cambiar_semaforo(gen_random_uuid(), 'verde', 'motivo largo'); raise exception 'FALLA: anon cambió semáforo';
exception when insufficient_privilege then null; end $$;

-- Sí puede leer el catálogo público (sin colores).
do $$ begin if (select count(*) from public.sintomas) < 50 then raise exception 'FALLA: anon no ve el catálogo'; end if; end $$;

-- Disponibilidad: solo booleano por franja, festivos cerrados.
do $$ declare n int;
begin
  select count(*) into n from public.disponibilidad_publica((now() at time zone 'America/Bogota')::date + 1, (now() at time zone 'America/Bogota')::date + 30);
  if n <> 60 then raise exception 'FALLA: disponibilidad devolvió % filas', n; end if;
  if exists (select 1 from public.disponibilidad_publica((now() at time zone 'America/Bogota')::date + 1, (now() at time zone 'America/Bogota')::date + 60) where motivo = 'Festivo' and disponible) then
    raise exception 'FALLA: un festivo aparece disponible'; end if;
  if exists (select 1 from public.disponibilidad_publica((now() at time zone 'America/Bogota')::date - 3, (now() at time zone 'America/Bogota')::date) where disponible) then
    raise exception 'FALLA: se puede pedir cita para hoy o el pasado'; end if;
end $$;

-- Crear solicitud: respuesta neutra, SIN semáforo.
do $$ declare r jsonb; dia date;
begin
  select fecha into dia from public.disponibilidad_publica((now() at time zone 'America/Bogota')::date + 1, (now() at time zone 'America/Bogota')::date + 20) where disponible and franja = 'manana' limit 1;
  r := public.crear_solicitud(jsonb_build_object(
    'borradorId', '11111111-1111-1111-1111-111111111111', 'esClienteExistente', false,
    'cliente', jsonb_build_object('tipoDocumento', 'CC', 'numeroDocumento', '1.012.345.678', 'nombre', 'Prueba Ficticia', 'celular', '300 555 1234'),
    'vehiculo', jsonb_build_object('placa', 'zzz-999', 'marca', 'Renault', 'linea', 'Kwid', 'km', 15000),
    'zonas', jsonb_build_array('frenos'), 'sintomas', jsonb_build_array('frenos.pedal_blando'), 'descripcion', 'se hunde el pedal',
    'movilidad', 'nose', 'adjuntos', jsonb_build_array(jsonb_build_object('ruta', 'pendientes/11111111-1111-1111-1111-111111111111/a.jpg', 'tipo', 'foto')),
    'cita', jsonb_build_object('fecha', dia, 'franja', 'manana'),
    'autorizaciones', jsonb_build_object('presupuesto', 'previo', 'pruebaRuta', true, 'datos', true, 'versionAviso', 'test'),
    'canal', 'portal'));
  if r::text ~* 'rojo|amarillo|verde|semaforo|prioridad|razon' then raise exception 'FALLA: la respuesta filtra el semáforo: %', r; end if;
  if r ->> 'codigo' !~ '^PSR-[2-9A-HJ-NP-Z]{6}$' then raise exception 'FALLA: código inválido %', r; end if;
  if r -> 'cita' ->> 'estado' <> 'pendiente' then raise exception 'FALLA: la cita no quedó pendiente'; end if;
  perform set_config('prueba.codigo', r ->> 'codigo', false);
end $$;

-- Sin autorización de datos → rechazo.
do $$ begin
  perform public.crear_solicitud('{"borradorId":"11111111-1111-1111-1111-111111111111","cliente":{"tipoDocumento":"CC","numeroDocumento":"123456","nombre":"X Y","celular":"3001234567"},"vehiculo":{"placa":"AAA111","marca":"Kia"},"zonas":["motor"],"movilidad":"si","autorizaciones":{"presupuesto":"previo","datos":false}}');
  raise exception 'FALLA: aceptó sin autorización de datos';
exception when others then if sqlerrm not like 'DATOS_INVALIDOS%' then raise; end if; end $$;

-- Adjunto fuera de la carpeta del borrador → rechazo.
do $$ begin
  perform public.crear_solicitud('{"borradorId":"11111111-1111-1111-1111-111111111111","cliente":{"tipoDocumento":"CC","numeroDocumento":"123456","nombre":"X Y","celular":"3001234567"},"vehiculo":{"placa":"AAA111","marca":"Kia"},"zonas":["motor"],"movilidad":"si","adjuntos":[{"ruta":"recepciones/otro.jpg"}],"autorizaciones":{"presupuesto":"previo","datos":true}}');
  raise exception 'FALLA: aceptó adjunto de otra carpeta';
exception when others then if sqlerrm not like 'DATOS_INVALIDOS%' then raise; end if; end $$;

-- Cliente existente: NO se sobrescriben sus datos desde el portal.
do $$ declare r jsonb; begin
  r := public.crear_solicitud('{"borradorId":"22222222-2222-2222-2222-222222222222","esClienteExistente":true,"cliente":{"tipoDocumento":"CC","numeroDocumento":"80123456","nombre":"Impostor","celular":"3009999999"},"vehiculo":{"placa":"JKL123","marca":"Otra marca"},"zonas":["general"],"sintomas":["general.mantenimiento"],"movilidad":"si","autorizaciones":{"presupuesto":"previo","datos":true,"versionAviso":"t"}}');
end $$;

-- Consultar estado: con código + 4 dígitos correctos; sin semáforo.
do $$ declare r jsonb; begin
  r := public.consultar_estado(current_setting('prueba.codigo'), '5678');
  if r is null then raise exception 'FALLA: no encontró la solicitud'; end if;
  if r::text ~* 'rojo|amarillo|verde|semaforo|Prueba Ficticia|1012345678|3005551234' then raise exception 'FALLA: consultar_estado filtra datos: %', r; end if;
  if public.consultar_estado(current_setting('prueba.codigo'), '0000') is not null then raise exception 'FALLA: aceptó dígitos errados'; end if;
end $$;

-- Ya soy cliente: devuelve solo el vehículo.
do $$ declare r jsonb; begin
  r := public.precargar_vehiculo('JKL-123', '3456', '2233');
  if r is null or r ->> 'linea' <> 'Sandero' then raise exception 'FALLA: no precargó el vehículo: %', r; end if;
  if r::text ~* 'Camacho|80123456|3001112233' then raise exception 'FALLA: precarga expone datos personales: %', r; end if;
  if public.precargar_vehiculo('JKL123', '3456', '0000') is not null then raise exception 'FALLA: precargó con celular errado'; end if;
end $$;

-- Límite de intentos: la 6.ª consulta del mismo código en 15 min se bloquea.
do $$ declare i int; begin
  for i in 1..10 loop perform public.consultar_estado('PSR-NOEXIS', '1111'); end loop;
  raise exception 'FALLA: no limitó los intentos';
exception when others then if sqlerrm not like 'DEMASIADOS_INTENTOS%' then raise; end if; end $$;

-- Honeypot: responde "éxito" pero no guarda.
do $$ declare antes int; r jsonb; begin
  r := public.crear_solicitud('{"website":"http://spam","borradorId":"x"}');
  if r ->> 'codigo' is null then raise exception 'FALLA: honeypot no respondió'; end if;
end $$;

-- Storage: el anónimo puede subir a pendientes/ pero no leer ni subir a otra carpeta.
do $$ begin insert into storage.objects (bucket_id, name) values ('solicitudes', 'pendientes/abc/foto.jpg'); end $$;
do $$ begin insert into storage.objects (bucket_id, name) values ('recepciones', 'x/foto.jpg'); raise exception 'FALLA: anon subió a recepciones';
exception when insufficient_privilege then null; end $$;
do $$ begin if exists (select 1 from storage.objects) then raise exception 'FALLA: anon puede listar archivos'; end if; end $$;

reset role;

-- ===== Datos internos tras las operaciones anónimas =====
do $$ declare c text; t record; begin
  select nombre_razon_social into c from public.clientes where numero_documento = '80123456';
  if c <> 'Andrés Camacho (ficticio)' then raise exception 'FALLA: el portal sobrescribió al cliente: %', c; end if;
  select t2.semaforo_auto, s.puede_movilizarse into t from public.solicitudes s join public.triage_interno t2 on t2.solicitud_id = s.id
   where s.codigo_seguimiento = current_setting('prueba.codigo');
  if t.semaforo_auto <> 'rojo' then raise exception 'FALLA: la solicitud de prueba no quedó en rojo (%).', t.semaforo_auto; end if;
  if (select count(*) from public.citas c join public.solicitudes s on s.id = c.solicitud_id where s.codigo_seguimiento = current_setting('prueba.codigo') and c.estado = 'pendiente') <> 1 then
    raise exception 'FALLA: no se creó la cita pendiente'; end if;
end $$;

-- Cupo lleno: se llena una franja y el siguiente intento falla con CUPO_LLENO.
do $$ declare dia date; i int; begin
  select fecha into dia from public.disponibilidad_publica((now() at time zone 'America/Bogota')::date + 1, (now() at time zone 'America/Bogota')::date + 20) where disponible and franja = 'tarde' limit 1;
  for i in 1..10 loop
    perform public.crear_solicitud(jsonb_build_object('borradorId', '33333333-3333-3333-3333-333333333333',
      'cliente', jsonb_build_object('tipoDocumento', 'CC', 'numeroDocumento', (5550000 + i)::text, 'nombre', 'Lleno ' || i, 'celular', '3001110000'),
      'vehiculo', jsonb_build_object('placa', 'LLE' || lpad(i::text, 3, '0'), 'marca', 'Kia'),
      'zonas', '["general"]'::jsonb, 'movilidad', 'si', 'cita', jsonb_build_object('fecha', dia, 'franja', 'tarde'),
      'autorizaciones', '{"presupuesto":"previo","datos":true,"versionAviso":"t"}'::jsonb));
  end loop;
  raise exception 'FALLA: no se detuvo al llenarse la franja';
exception when others then if sqlerrm not like 'CUPO_LLENO%' and sqlerrm not like 'DEMASIADOS_INTENTOS%' then raise; end if; end $$;

-- ===== Como TÉCNICO y como ADMIN =====
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001'), ('aaaaaaaa-0000-0000-0000-000000000002'), ('aaaaaaaa-0000-0000-0000-000000000003');
insert into public.perfiles (id, nombre, rol) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Javier (admin)', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Mecánico', 'tecnico');

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
do $$ declare n int; begin
  select count(*) into n from public.triage_interno;
  if n < 10 then raise exception 'FALLA: el técnico no ve el semáforo'; end if;
  begin update public.triage_interno set semaforo_final = 'verde'; raise exception 'FALLA: técnico editó semáforo sin motivo';
  exception when insufficient_privilege then null; end;
  begin perform public.cambiar_semaforo((select solicitud_id from public.triage_interno limit 1), 'verde', 'no'); raise exception 'FALLA: aceptó motivo vacío';
  exception when others then if sqlerrm not like 'MOTIVO_OBLIGATORIO%' then raise; end if; end;
  perform public.cambiar_semaforo((select s.id from public.solicitudes s where codigo_seguimiento = 'PSR-DEMO09'), 'amarillo', 'Lo revisé por teléfono: pastillas, no hidráulico');
  if (select count(*) from public.cambios_semaforo) <> 1 then raise exception 'FALLA: el cambio no quedó registrado'; end if;
  if exists (select 1 from public.auditoria) then raise exception 'FALLA: técnico ve la auditoría'; end if;
  begin delete from public.solicitudes where codigo_seguimiento = 'PSR-DEMO01';
    if found then raise exception 'FALLA: técnico borró una solicitud'; end if; end;
  begin insert into public.reglas_semaforo (tipo, valor, color) values ('palabra', 'x', 'verde'); raise exception 'FALLA: técnico editó reglas';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false); -- usuario sin perfil
do $$ begin
  if exists (select 1 from public.clientes) or exists (select 1 from public.triage_interno) then raise exception 'FALLA: usuario sin perfil ve datos'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ begin
  if not exists (select 1 from public.auditoria where accion = 'cambiar_semaforo') then raise exception 'FALLA: admin no ve la auditoría del cambio'; end if;
  insert into public.reglas_semaforo (tipo, valor, color) values ('palabra', 'prueba-admin', 'amarillo');
end $$;
reset role;
-- El cambio de reglas aplica sin tocar código:
do $$ begin
  if psr_privado.clasificar('{general}', '{}', 'esto es una prueba-admin', 'si') ->> 'color' <> 'amarillo' then raise exception 'FALLA: la regla nueva no aplicó'; end if;
end $$;
