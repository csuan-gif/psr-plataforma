-- Pruebas del panel del taller (Fase 2). Usa los perfiles creados en 02_seguridad.sql.

-- El anónimo no puede usar las funciones del taller.
set role anon;
do $$ begin perform public.ver_solicitud(gen_random_uuid()); raise exception 'FALLA: anon usó ver_solicitud';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.cupos_taller((now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date + 7); raise exception 'FALLA: anon usó cupos_taller';
exception when insufficient_privilege then null; end $$;
reset role;

-- Usuario autenticado SIN perfil del taller: rechazado.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
do $$ begin perform public.cupos_taller((now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date + 7); raise exception 'FALLA: usuario sin perfil usó cupos_taller';
exception when others then if sqlerrm <> 'NO_AUTORIZADO' then raise; end if; end $$;

-- Técnico: ve detalle (queda en auditoría), confirma, mueve y crea citas.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
do $$ declare r jsonb; v_cita uuid; v_sol uuid; dia date; lleno date; i int;
begin
  select c.id, c.solicitud_id into v_cita, v_sol from public.citas c join public.solicitudes s on s.id = c.solicitud_id
   where s.codigo_seguimiento = current_setting('prueba.codigo');
  r := public.ver_solicitud(v_sol);
  if r -> 'semaforo' ->> 'final' <> 'rojo' or r -> 'cliente' ->> 'numeroDocumento' <> '1012345678' then raise exception 'FALLA: detalle incompleto %', r; end if;

  perform public.cambiar_estado_cita(v_cita, 'confirmada');
  if (select estado from public.citas where id = v_cita) <> 'confirmada' then raise exception 'FALLA: no confirmó'; end if;
  if (select confirmada_por from public.citas where id = v_cita) <> 'aaaaaaaa-0000-0000-0000-000000000002' then raise exception 'FALLA: no registró quién confirmó'; end if;
  if (select estado from public.solicitudes where id = v_sol) <> 'en_revision' then raise exception 'FALLA: la solicitud no pasó a en_revision'; end if;

  -- Llena una franja y comprueba que mover ahí exige forzar.
  select fecha into lleno from public.cupos_taller((now() at time zone 'America/Bogota')::date + 1, (now() at time zone 'America/Bogota')::date + 20) where franja = 'manana' and motivo is null and cupos = 3 and usados = 0 limit 1;
  for i in 1..3 loop perform public.crear_cita_taller((select id from public.solicitudes where codigo_seguimiento = 'PSR-DEMO0' || i), lleno, 'manana'); end loop;
  if (select usados from public.cupos_taller(lleno, lleno) where franja = 'manana') <> 3 then raise exception 'FALLA: cupos_taller no cuenta bien'; end if;
  begin perform public.reprogramar_cita(v_cita, lleno, 'manana'); raise exception 'FALLA: movió a franja llena sin forzar';
  exception when others then if sqlerrm not like 'CUPO_LLENO%' then raise; end if; end;
  perform public.reprogramar_cita(v_cita, lleno, 'manana', true);
  if (select estado from public.citas where id = v_cita) <> 'reprogramada' then raise exception 'FALLA: no quedó reprogramada'; end if;

  -- Festivo: no hay cupo aunque sea día hábil.
  select fecha into dia from public.festivos where fecha > (now() at time zone 'America/Bogota')::date and extract(dow from fecha) between 1 and 5 order by fecha limit 1;
  if dia is not null then
    begin perform public.crear_cita_taller(v_sol, dia, 'tarde'); raise exception 'FALLA: creó cita en festivo';
    exception when others then if sqlerrm not like 'CUPO_LLENO%' then raise; end if; end;
  end if;

  perform public.marcar_solicitud(v_sol, 'atendida');
  begin perform public.marcar_solicitud(v_sol, 'inventado'); raise exception 'FALLA: aceptó estado inválido';
  exception when others then if sqlerrm not like 'DATOS_INVALIDOS%' then raise; end if; end;

  -- El técnico no administra la agenda.
  begin insert into public.dias_bloqueados (fecha, motivo) values ((now() at time zone 'America/Bogota')::date + 5, 'x'); raise exception 'FALLA: técnico bloqueó un día';
  exception when insufficient_privilege then null; end;
end $$;

-- Presencia: canal privado solo para el taller.
select set_config('realtime.topic', 'taller-presencia', false);
do $$ begin insert into realtime.messages (topic, payload) values ('taller-presencia', '{}'); end $$;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
do $$ begin insert into realtime.messages (topic, payload) values ('taller-presencia', '{}'); raise exception 'FALLA: usuario sin perfil publicó presencia';
exception when insufficient_privilege then null; end $$;

-- Admin: bloquea un día y deja de haber cupo.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ declare dia date; begin
  select fecha into dia from public.cupos_taller((now() at time zone 'America/Bogota')::date + 1, (now() at time zone 'America/Bogota')::date + 20) where franja = 'tarde' and motivo is null and cupos > usados limit 1;
  insert into public.dias_bloqueados (fecha, motivo) values (dia, 'Inventario');
  if (select motivo from public.cupos_taller(dia, dia) where franja = 'tarde') <> 'Cerrado: Inventario' then raise exception 'FALLA: el bloqueo no se refleja'; end if;
  if exists (select 1 from public.disponibilidad_publica(dia, dia) where disponible) then raise exception 'FALLA: el portal ofrece un día bloqueado'; end if;
  if not exists (select 1 from public.auditoria where accion = 'ver' and tabla = 'clientes') then raise exception 'FALLA: no quedó auditado el ver_solicitud'; end if;
end $$;
reset role;
