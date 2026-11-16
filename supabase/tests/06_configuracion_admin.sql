-- Pruebas de la Fase 5: configuración pública, usuarios, probador del semáforo, alta rápida y limpieza.
update auth.users set email = 'javier@psr.test' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update auth.users set email = 'mecanico@psr.test' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
update auth.users set email = 'nuevo@psr.test' where id = 'aaaaaaaa-0000-0000-0000-000000000003';

set role anon;
do $$ declare c jsonb; begin
  c := public.config_publica();
  if c ->> 'nombre' is null or c::text ~* 'semaforo|reglas' then raise exception 'FALLA: config pública %', c; end if;
  begin perform public.usuarios_taller(); raise exception 'FALLA: anon listó usuarios'; exception when insufficient_privilege then null; end;
  begin perform public.limpieza_pendiente(); raise exception 'FALLA: anon vio la limpieza'; exception when insufficient_privilege then null; end;
  begin update public.config_taller set valor = '{}' where clave = 'publico'; raise exception 'FALLA: anon editó la config'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false); -- técnico
do $$ begin
  begin perform public.usuarios_taller(); raise exception 'FALLA: técnico listó usuarios'; exception when insufficient_privilege then null; end;
  begin perform public.probar_semaforo('{}'); raise exception 'FALLA: técnico usó el probador'; exception when insufficient_privilege then null; end;
  begin perform public.limpieza_pendiente(); raise exception 'FALLA: técnico vio la limpieza'; exception when insufficient_privilege then null; end;
  begin update public.config_taller set valor = '{}' where clave = 'publico'; if found then raise exception 'FALLA: técnico editó la config'; end if; end;
end $$;
-- Alta rápida (técnico): cliente que llega sin solicitud.
do $$ declare s uuid; begin
  begin perform public.alta_rapida('{"numeroDocumento":"1234567","nombre":"Walk In","celular":"3001234567","placa":"WAL123","marca":"Kia"}'); raise exception 'FALLA: alta sin autorización';
  exception when others then if sqlerrm not like 'DATOS_INVALIDOS%' then raise; end if; end;
  s := public.alta_rapida('{"numeroDocumento":"1234567","nombre":"Walk In (ficticio)","celular":"3001234567","placa":"wal-123","marca":"Kia","linea":"Picanto","autorizaDatos":true,"motivo":"Ruido en la suspensión"}');
  if (select canal from public.solicitudes where id = s) <> 'taller' then raise exception 'FALLA: canal de la alta rápida'; end if;
  if not (select autoriza_datos and verificado and origen = 'taller' from public.clientes where numero_documento = '1234567') then raise exception 'FALLA: cliente del alta rápida'; end if;
  -- Un importado sin autorización la da en persona.
  perform public.alta_rapida('{"numeroDocumento":"1111222333","nombre":"Pedro","celular":"3009998877","placa":"IMP001","marca":"Chevrolet","autorizaDatos":true}');
  if not (select autoriza_datos from public.clientes where numero_documento = '1111222333') then raise exception 'FALLA: no registró la autorización del importado'; end if;
  begin perform public.alta_rapida('{"numeroDocumento":"7654321","nombre":"Otro","celular":"3001234567","placa":"WAL123","marca":"Kia","autorizaDatos":true}'); raise exception 'FALLA: usó la placa de otro cliente';
  exception when others then if sqlerrm not like 'PLACA_DE_OTRO_CLIENTE%' then raise; end if; end;
end $$;

-- Admin: usuarios y probador.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ declare u jsonb; r jsonb; begin
  u := public.usuarios_taller();
  if not exists (select 1 from jsonb_array_elements(u) x where x ->> 'correo' = 'javier@psr.test') then raise exception 'FALLA: lista de usuarios %', u; end if;
  begin perform public.agregar_usuario('noexiste@psr.test', 'Nadie', 'tecnico'); raise exception 'FALLA: agregó un correo sin cuenta';
  exception when others then if sqlerrm not like 'USUARIO_NO_EXISTE%' then raise; end if; end;
  perform public.agregar_usuario('NUEVO@psr.test', 'Eléctrico', 'tecnico');
  if not exists (select 1 from public.perfiles where id = 'aaaaaaaa-0000-0000-0000-000000000003' and rol = 'tecnico') then raise exception 'FALLA: no dio acceso'; end if;
  begin perform public.actualizar_usuario('aaaaaaaa-0000-0000-0000-000000000001', 'tecnico', true); raise exception 'FALLA: dejó el taller sin admin';
  exception when others then if sqlerrm not like 'ULTIMO_ADMIN%' then raise; end if; end;
  perform public.actualizar_usuario('aaaaaaaa-0000-0000-0000-000000000003', 'tecnico', false);
  r := public.probar_semaforo('{"zonas":["frenos"],"sintomas":["frenos.chilla"],"descripcion":"y sale humo","movilidad":"si"}');
  if r ->> 'color' <> 'rojo' then raise exception 'FALLA: probador %', r; end if;
  update public.config_taller set valor = jsonb_set(valor, '{whatsapp}', '"573101112233"') where clave = 'publico';
end $$;
reset role;
do $$ begin if public.config_publica() ->> 'whatsapp' <> '573101112233' then raise exception 'FALLA: la config editada no se refleja'; end if; end $$;

-- Limpieza (como service_role): huérfanos de pendientes/ y archivos de clientes anonimizados.
insert into storage.objects (bucket_id, name, created_at) values ('solicitudes', 'pendientes/viejo/a.jpg', now() - interval '5 days'), ('solicitudes', 'pendientes/nuevo/b.jpg', now());
set role service_role;
do $$ declare l jsonb; begin
  l := public.limpieza_pendiente();
  if not (l -> 'huerfanos') ? 'pendientes/viejo/a.jpg' or (l -> 'huerfanos') ? 'pendientes/nuevo/b.jpg' then raise exception 'FALLA: huérfanos %', l; end if;
  if (l -> 'huerfanos') ? 'pendientes/11111111-1111-1111-1111-111111111111/a.jpg' then raise exception 'FALLA: marcó como huérfano un adjunto en uso'; end if;
end $$;
reset role;
-- (El cliente de QRS789 fue anonimizado en 05; si tuviera actas, sus archivos aparecerían en "suprimidos".)
