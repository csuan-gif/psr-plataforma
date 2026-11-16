-- Pruebas de la Fase 4: km por día, recordatorios, conversión, "Mi mantenimiento", ficha, importación y supresión.

-- Historial de km para TUV234: una solicitud de hace 60 días con 48.000 km (ya tiene entrega con 54.215 km hoy).
insert into public.solicitudes (codigo_seguimiento, cliente_id, vehiculo_id, zonas, puede_movilizarse, autoriza_presupuesto, autoriza_datos_en, autoriza_datos_version, km_reportado, creado_en)
select 'PSR-KMHIST', cliente_id, id, '{general}', 'si', 'previo', now(), 't', 48000, now() - interval '60 days' from public.vehiculos where placa = 'TUV234';

do $$ declare k numeric; f date; begin
  k := psr_privado.km_por_dia((select id from public.vehiculos where placa = 'TUV234'));
  if k is null or k not between 100 and 110 then raise exception 'FALLA: km/día esperado ~103,6, obtuvo %', k; end if;
  -- El recordatorio de líquido de frenos (+40.000 km o +24 meses) debe salir antes por km (~387 días).
  select psr_privado.fecha_objetivo(r) into f from psr_privado.v_recordatorios r where r.placa = 'TUV234' and r.servicio like 'Cambio de líquido%';
  if f is null or f - (now() at time zone 'America/Bogota')::date not between 380 and 395 then raise exception 'FALLA: fecha objetivo por km %', f; end if;
  if psr_privado.km_por_dia((select id from public.vehiculos where placa = 'WXY567')) is not null then raise exception 'FALLA: km/día sin historial suficiente'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
do $$ declare l jsonb; r jsonb;
begin
  l := public.recordatorios_proximos(14);
  if not exists (select 1 from jsonb_array_elements(l) x where x -> 'vehiculo' ->> 'placa' = 'QRS789' and x ->> 'servicio' like 'Cambio de aceite%') then raise exception 'FALLA: falta el cambio de aceite próximo: %', l; end if;
  if not exists (select 1 from jsonb_array_elements(l) x where x ->> 'tipo' = 'soat' and x -> 'vehiculo' ->> 'placa' = 'JKL123') then raise exception 'FALLA: falta el vencimiento del SOAT'; end if;
  if exists (select 1 from jsonb_array_elements(l) x where x -> 'vehiculo' ->> 'placa' = 'TUV234') then raise exception 'FALLA: incluyó un recordatorio lejano'; end if;
  select x into r from jsonb_array_elements(l) x where x -> 'vehiculo' ->> 'placa' = 'QRS789';
  perform public.marcar_recordatorio((r ->> 'id')::uuid, 'enviado');
  perform set_config('prueba.token', r ->> 'token', false);
  if (public.indicador_recordatorios(90) ->> 'enviados')::int <> 1 then raise exception 'FALLA: indicador de enviados'; end if;
  begin perform public.anonimizar_cliente((select cliente_id from public.vehiculos where placa = 'QRS789'), 'motivo de prueba'); raise exception 'FALLA: técnico anonimizó';
  exception when insufficient_privilege then null; end;
  begin perform public.importar_clientes('[]'); raise exception 'FALLA: técnico importó';
  exception when insufficient_privilege then null; end;
  r := public.ver_cliente((select cliente_id from public.vehiculos where placa = 'TUV234'));
  if jsonb_array_length(r -> 'vehiculos' -> 0 -> 'ordenes') < 1 or (r -> 'vehiculos' -> 0 ->> 'kmDia') is null then raise exception 'FALLA: ficha sin historial: %', r; end if;
end $$;
reset role;

-- El cliente agenda desde el enlace del recordatorio → queda "agendado" y cuenta en la conversión.
set role anon;
do $$ declare p jsonb; s jsonb;
begin
  p := public.precarga_recordatorio(current_setting('prueba.token')::uuid);
  if p ->> 'placa' <> 'QRS789' or p::text ~* 'Rincón|79555111|3157778899' then raise exception 'FALLA: precarga del recordatorio: %', p; end if;
  if public.precarga_recordatorio(gen_random_uuid()) is not null then raise exception 'FALLA: token inventado devolvió datos'; end if;
  s := public.crear_solicitud(jsonb_build_object('borradorId', '44444444-4444-4444-4444-444444444444', 'esClienteExistente', true,
    'cliente', jsonb_build_object('tipoDocumento', 'CC', 'numeroDocumento', '79555111', 'celular', '3157778899'),
    'vehiculo', jsonb_build_object('placa', 'QRS789', 'marca', 'Mazda'), 'zonas', '["general"]'::jsonb, 'sintomas', '["general.mantenimiento"]'::jsonb,
    'movilidad', 'si', 'autorizaciones', '{"presupuesto":"sin_presupuesto","datos":true,"versionAviso":"t"}'::jsonb, 'canal', 'recordatorio'));
  if not public.vincular_recordatorio(current_setting('prueba.token')::uuid, s ->> 'codigo') then raise exception 'FALLA: no vinculó el recordatorio'; end if;

  -- Mi mantenimiento: solo datos del vehículo.
  p := public.mi_mantenimiento('JKL-123', '3456', '2233');
  if p is null or p ->> 'fechaSoat' is null or p::text ~* 'Camacho|80123456|3001112233' then raise exception 'FALLA: mi_mantenimiento %', p; end if;
  if public.mi_mantenimiento('JKL123', '3456', '0000') is not null then raise exception 'FALLA: mi_mantenimiento con celular errado'; end if;
  if not public.registrar_vencimientos('JKL123', '3456', '2233', (now() at time zone 'America/Bogota')::date + 20, (now() at time zone 'America/Bogota')::date + 100) then raise exception 'FALLA: no registró vencimientos'; end if;
  if not public.registrar_vencimientos('JKL123', '3456', '2233', (now() at time zone 'America/Bogota')::date + 20, (now() at time zone 'America/Bogota')::date + 200) then raise exception 'FALLA: no actualizó RTM'; end if;
  begin perform public.registrar_vencimientos('JKL123', '3456', '2233', (now() at time zone 'America/Bogota')::date + 3000, null); raise exception 'FALLA: aceptó un SOAT absurdo';
  exception when others then if sqlerrm not like 'DATOS_INVALIDOS%' then raise; end if; end;
  begin perform public.ver_cliente(gen_random_uuid()); raise exception 'FALLA: anon usó ver_cliente';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin
  if (select count(*) from public.recordatorios r join public.vehiculos v on v.id = r.vehiculo_id where v.placa = 'JKL123' and r.tipo = 'tecnomecanica' and r.estado = 'pendiente') <> 1
    then raise exception 'FALLA: debe haber un solo recordatorio vivo de RTM'; end if;
  if (select fecha_estimada from public.recordatorios r join public.vehiculos v on v.id = r.vehiculo_id where v.placa = 'JKL123' and r.tipo = 'tecnomecanica' and r.estado = 'pendiente') <> (now() at time zone 'America/Bogota')::date + 200
    then raise exception 'FALLA: el RTM vivo no tiene la fecha nueva'; end if;
  if (select estado from public.recordatorios where token = current_setting('prueba.token')::uuid) <> 'agendado' then raise exception 'FALLA: recordatorio no quedó agendado'; end if;
end $$;

-- Admin: indicador, importación y supresión.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ declare r jsonb; c uuid;
begin
  r := public.indicador_recordatorios(90);
  if (r ->> 'agendados')::int <> 1 or (r ->> 'conversion')::numeric <> 1 then raise exception 'FALLA: conversión %', r; end if;

  r := public.importar_clientes('[
    {"tipoDocumento":"Cédula","numeroDocumento":"1.111.222.333","nombre":"Pedro Importado","celular":"300 999 8877","placa":"imp-001","marca":"Chevrolet","linea":"Spark","km":"85.000","fechaUltimoServicio":"2026-09-01","ultimoServicio":"aceite y filtro (aceite mineral)"},
    {"tipoDocumento":"CC","numeroDocumento":"80123456","nombre":"Otro nombre","celular":"3000000000","correo":"nuevo@correo.com","placa":"JKL123","km":"90000"},
    {"tipoDocumento":"XX","numeroDocumento":"123","nombre":"Malo"},
    {"tipoDocumento":"CC","numeroDocumento":"","nombre":"Sin documento"}]');
  if (r ->> 'clientesNuevos')::int <> 1 or (r ->> 'clientesActualizados')::int <> 1 or (r ->> 'vehiculosNuevos')::int <> 1 or jsonb_array_length(r -> 'errores') <> 2 or (r ->> 'recordatorios')::int <> 1 then
    raise exception 'FALLA: resultado de importación %', r; end if;
  if (select nombre_razon_social from public.clientes where numero_documento = '80123456') <> 'Andrés Camacho (ficticio)' then raise exception 'FALLA: la importación sobrescribió el nombre'; end if;
  if (select autoriza_datos from public.clientes where numero_documento = '1111222333') then raise exception 'FALLA: un importado quedó con autorización'; end if;
  if (select correo from public.clientes where numero_documento = '80123456') is distinct from 'cliente1@ejemplo.com' and (select correo from public.clientes where numero_documento = '80123456') is distinct from 'nuevo@correo.com' then raise exception 'FALLA: correo inesperado'; end if;
  if (select km_ultimo from public.vehiculos where placa = 'JKL123') <> 90000 then raise exception 'FALLA: no tomó el km mayor del Excel'; end if;
  if not exists (select 1 from public.recordatorios r join public.vehiculos v on v.id = r.vehiculo_id where v.placa = 'IMP001' and r.km_estimado = 90000 and r.fecha_estimada = '2027-03-01') then
    raise exception 'FALLA: no programó el próximo mantenimiento del importado'; end if;

  c := (select cliente_id from public.vehiculos where placa = 'QRS789');
  begin perform public.anonimizar_cliente(c, 'no'); raise exception 'FALLA: anonimizó sin motivo';
  exception when others then if sqlerrm not like 'MOTIVO_OBLIGATORIO%' then raise; end if; end;
  perform public.anonimizar_cliente(c, 'Solicitud de supresión del titular por correo');
  if exists (select 1 from public.clientes where id = c and (nombre_razon_social <> 'Cliente anonimizado' or celular <> '' or numero_documento = '79555111')) then raise exception 'FALLA: quedaron datos personales'; end if;
  if not exists (select 1 from public.auditoria where accion = 'anonimizar' and registro = c::text) then raise exception 'FALLA: supresión sin auditoría'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  if public.mi_mantenimiento('QRS789', '5111', '8899') is not null then raise exception 'FALLA: el anonimizado sigue consultable'; end if;
end $$;
reset role;
