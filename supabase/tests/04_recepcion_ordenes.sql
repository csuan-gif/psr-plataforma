-- Pruebas de la Fase 3: acta de ingreso, reglas de estados, presupuesto y consulta del cliente.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false); -- técnico

do $$ declare v_sol uuid; v_veh uuid; r jsonb; v_ord uuid; base jsonb;
begin
  select s.id, s.vehiculo_id into v_sol, v_veh from public.solicitudes s where s.codigo_seguimiento = 'PSR-DEMO04';
  base := jsonb_build_object('solicitudId', v_sol, 'vehiculoId', v_veh, 'kmIngreso', 54200, 'nivelCombustible', 0.375,
    'checklist', '{"luces_bajas":{"estado":"bien"}}'::jsonb, 'mapaDanos', '[{"zona":"puerta_del_izq","tipo":"rayon","nota":"rayón leve"}]'::jsonb,
    'fotos', '[{"tipo":"frente","ruta":"actas/x/1.jpg"},{"tipo":"lateral_izq","ruta":"actas/x/2.jpg"},{"tipo":"lateral_der","ruta":"actas/x/3.jpg"},{"tipo":"tablero","ruta":"actas/x/4.jpg"}]'::jsonb,
    'autorizaPresupuestoPrevio', true, 'autorizaPruebaRuta', false, 'firmaCliente', 'actas/x/firma.png', 'firmadoPor', 'Diana Torres',
    'vehiculo', '{"vin":"9FBHSRAJ5JM123456","color":"Plata"}'::jsonb, 'cliente', '{"correo":"diana@ejemplo.com"}'::jsonb);

  -- Faltan fotos obligatorias → rechazo.
  begin perform public.crear_recepcion(base || '{"fotos":[{"tipo":"frente","ruta":"actas/x/1.jpg"}]}'::jsonb); raise exception 'FALLA: aceptó acta sin las 4 fotos';
  exception when others then if sqlerrm not like 'FALTAN_FOTOS%' then raise; end if; end;
  -- Combustible fuera de pasos de 1/8 → rechazo.
  begin perform public.crear_recepcion(base || '{"nivelCombustible":0.3}'::jsonb); raise exception 'FALLA: aceptó combustible 0.3';
  exception when others then if sqlerrm not like 'DATOS_INVALIDOS%' then raise; end if; end;
  -- Sin firma → rechazo.
  begin perform public.crear_recepcion(base - 'firmaCliente'); raise exception 'FALLA: aceptó acta sin firma';
  exception when others then if sqlerrm not like 'DATOS_INVALIDOS%' then raise; end if; end;

  r := public.crear_recepcion(base);
  v_ord := (r ->> 'ordenId')::uuid;
  perform set_config('prueba.orden', v_ord::text, false);
  if (select km_ultimo from public.vehiculos where id = v_veh) <> 54200 then raise exception 'FALLA: no actualizó el km'; end if;
  if (select vin from public.vehiculos where id = v_veh) <> '9FBHSRAJ5JM123456' then raise exception 'FALLA: no guardó el VIN'; end if;
  if not (select verificado from public.clientes c join public.vehiculos v on v.cliente_id = c.id where v.id = v_veh) then raise exception 'FALLA: no verificó al cliente'; end if;
  if (select estado from public.solicitudes where id = v_sol) <> 'convertida' then raise exception 'FALLA: la solicitud no quedó convertida'; end if;
  if (select presupuesto_estado from public.ordenes_trabajo where id = v_ord) <> 'pendiente' then raise exception 'FALLA: presupuesto previo no quedó pendiente'; end if;

  -- Segunda acta del mismo vehículo con la orden abierta → rechazo.
  begin perform public.crear_recepcion(base); raise exception 'FALLA: abrió dos órdenes del mismo vehículo';
  exception when others then if sqlerrm not like 'ORDEN_ABIERTA%' then raise; end if; end;

  -- El acta es inmutable.
  begin update public.recepciones set km_ingreso = 1; raise exception 'FALLA: se pudo editar el acta';
  exception when insufficient_privilege then null; end;
  begin update public.ordenes_trabajo set presupuesto_estado = 'aprobado' where id = v_ord; raise exception 'FALLA: el taller aprobó el presupuesto directo';
  exception when insufficient_privilege then null; end;
  update public.ordenes_trabajo set tecnico_asignado = 'aaaaaaaa-0000-0000-0000-000000000002' where id = v_ord; -- esto sí se permite

  perform public.cambiar_estado_orden(v_ord, 'en_diagnostico', '{"nota":"Revisando frenos"}');
  -- Regla 1: sin presupuesto aprobado no pasa a reparación.
  begin perform public.cambiar_estado_orden(v_ord, 'en_reparacion'); raise exception 'FALLA: reparó sin presupuesto aprobado';
  exception when others then if sqlerrm not like 'PRESUPUESTO_NO_APROBADO%' then raise; end if; end;
  perform public.enviar_presupuesto(v_ord, 280000, '[{"descripcion":"Cambio de pastillas delanteras","tipo":"correctivo","repuestos":"Pastillas"},{"descripcion":"Cambio de líquido de frenos","tipo":"preventivo","planId":"8"}]');
  if (select estado from public.ordenes_trabajo where id = v_ord) <> 'esperando_aprobacion' then raise exception 'FALLA: no pasó a esperando aprobación'; end if;
end $$;

-- El cliente consulta y aprueba desde el portal.
reset role;
set role anon;
do $$ declare r jsonb; begin
  r := public.consultar_estado('PSR-DEMO04', '4050');
  if r -> 'presupuesto' ->> 'estado' <> 'pendiente' or (r -> 'presupuesto' ->> 'total')::numeric <> 280000 then raise exception 'FALLA: el cliente no ve el presupuesto: %', r; end if;
  if r::text ~* 'semaforo|rojo|amarillo|verde' then raise exception 'FALLA: la consulta filtra el semáforo'; end if;
  if not exists (select 1 from jsonb_array_elements(r -> 'pasos') p where p ->> 'clave' = 'en_diagnostico' and (p ->> 'hecho')::boolean) then raise exception 'FALLA: línea de tiempo sin diagnóstico'; end if;
  if public.responder_presupuesto('PSR-DEMO04', '0000', 'aprobado') is not null then raise exception 'FALLA: aprobó con dígitos errados'; end if;
  r := public.responder_presupuesto('PSR-DEMO04', '4050', 'aprobado');
  if r ->> 'estado' <> 'aprobado' then raise exception 'FALLA: no aprobó'; end if;
  if public.responder_presupuesto('PSR-DEMO04', '4050', 'rechazado') is not null then raise exception 'FALLA: permitió responder dos veces'; end if;
  begin perform public.cambiar_estado_orden(current_setting('prueba.orden')::uuid, 'entregado'); raise exception 'FALLA: anon cambió una orden';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
do $$ declare v_ord uuid := current_setting('prueba.orden')::uuid; n int;
begin
  perform public.cambiar_estado_orden(v_ord, 'en_reparacion');
  -- Regla 2: sin autorización de prueba de ruta hay que registrar cómo se probó.
  begin perform public.cambiar_estado_orden(v_ord, 'en_prueba'); raise exception 'FALLA: pasó a prueba sin autorización ni registro';
  exception when others then if sqlerrm not like 'PRUEBA_RUTA_NO_AUTORIZADA%' then raise; end if; end;
  perform public.cambiar_estado_orden(v_ord, 'en_prueba', '{"pruebaSinConducir":"Prueba estática en elevador y freno de mano"}');
  if not exists (select 1 from public.historial_estados where orden_id = v_ord and nota like 'Prueba sin conducir:%') then raise exception 'FALLA: no registró cómo se probó'; end if;
  perform public.cambiar_estado_orden(v_ord, 'listo');
  -- Regla 3: entrega con km, trabajos y garantía.
  begin perform public.cambiar_estado_orden(v_ord, 'entregado', '{"kmSalida":100}'); raise exception 'FALLA: entregó con km menor al de ingreso y sin garantía';
  exception when others then if sqlerrm not like 'DATOS_ENTREGA%' then raise; end if; end;
  perform public.cambiar_estado_orden(v_ord, 'entregado', jsonb_build_object('kmSalida', 54215, 'garantiaHasta', (now() at time zone 'America/Bogota')::date + 90));
  select count(*) into n from public.recordatorios r join public.vehiculos v on v.id = r.vehiculo_id where v.placa = 'TUV234' and r.estado = 'pendiente';
  if n <> 1 then raise exception 'FALLA: se esperaban 1 recordatorio (líquido de frenos), hay %', n; end if;
  if (select km_estimado from public.recordatorios r join public.vehiculos v on v.id = r.vehiculo_id where v.placa = 'TUV234') <> 54215 + 40000 then raise exception 'FALLA: km del recordatorio'; end if;
  -- Orden cerrada: el técnico no la reabre.
  begin perform public.cambiar_estado_orden(v_ord, 'en_reparacion'); raise exception 'FALLA: técnico reabrió una orden entregada';
  exception when others then if sqlerrm not like 'ORDEN_CERRADA%' then raise; end if; end;
  if (select count(*) from public.historial_estados where orden_id = v_ord) < 7 then raise exception 'FALLA: historial incompleto'; end if;
end $$;
reset role;

set role anon;
do $$ declare r jsonb; begin
  r := public.consultar_estado('PSR-DEMO04', '4050');
  if not (select bool_and((p ->> 'hecho')::boolean) from jsonb_array_elements(r -> 'pasos') p) then raise exception 'FALLA: la línea de tiempo no quedó completa: %', r -> 'pasos'; end if;
  if r -> 'entrega' ->> 'garantiaHasta' is null then raise exception 'FALLA: no muestra la garantía'; end if;
end $$;
reset role;

-- Buscar por placa para abrir un acta.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
do $$ declare r jsonb; begin
  r := public.ver_vehiculo('jkl-123');
  if r -> 'vehiculo' ->> 'placa' <> 'JKL123' or (r ->> 'ordenAbierta')::boolean then raise exception 'FALLA: ver_vehiculo %', r; end if;
  if public.ver_vehiculo('NOEXISTE') is not null then raise exception 'FALLA: placa inexistente'; end if;
end $$;
reset role;
set role anon;
do $$ begin perform public.ver_vehiculo('JKL123'); raise exception 'FALLA: anon usó ver_vehiculo';
exception when insufficient_privilege then null; end $$;
reset role;
