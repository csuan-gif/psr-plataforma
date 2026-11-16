-- GENERADO por scripts/generar-semillas.mjs. Prueba el semáforo SQL con tests/casos.json.

do $$ declare v text := psr_privado.clasificar(array['general']::text[], array['general.mantenimiento']::text[], 'Mantenimiento de los 40.000 km', 'si') ->> 'color';
begin if v is distinct from 'verde' then raise exception 'FALLA C1: esperado verde, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['carroceria']::text[], array['carroceria.rayon', 'general.cotizacion']::text[], 'Cotización de pintura para el guardabarros rayado', 'si') ->> 'color';
begin if v is distinct from 'verde' then raise exception 'FALLA C2: esperado verde, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['motor']::text[], array['motor.cambio_aceite']::text[], 'Cambio de aceite y filtros', 'si') ->> 'color';
begin if v is distinct from 'verde' then raise exception 'FALLA C3: esperado verde, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['frenos']::text[], array['frenos.chilla']::text[], 'Chilla al frenar desde hace tres días', 'si') ->> 'color';
begin if v is distinct from 'amarillo' then raise exception 'FALLA C4: esperado amarillo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['electrico']::text[], array['electrico.testigo']::text[], 'Se encendió una luz en el tablero, el carro anda normal', 'si') ->> 'color';
begin if v is distinct from 'amarillo' then raise exception 'FALLA C5: esperado amarillo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['direccion']::text[], array['direccion.vibra_velocidad']::text[], 'El volante vibra a más de 80 km/h', 'si') ->> 'color';
begin if v is distinct from 'amarillo' then raise exception 'FALLA C6: esperado amarillo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['motor']::text[], array['motor.no_enciende']::text[], 'No enciende', 'no') ->> 'color';
begin if v is distinct from 'rojo' then raise exception 'FALLA C7: esperado rojo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['motor', 'refrigeracion']::text[], array['motor.humo', 'refrigeracion.temp_alta']::text[], '', 'nose') ->> 'color';
begin if v is distinct from 'rojo' then raise exception 'FALLA C8: esperado rojo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['frenos']::text[], array['frenos.pedal_blando']::text[], '', 'nose') ->> 'color';
begin if v is distinct from 'rojo' then raise exception 'FALLA C9: esperado rojo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['electrico']::text[], array['electrico.intermitente', 'electrico.luces', 'electrico.vidrios']::text[], 'Fallas intermitentes en luces y vidrios', 'si') ->> 'color';
begin if v is distinct from 'amarillo' then raise exception 'FALLA C10: esperado amarillo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['nose']::text[], array[]::text[], 'Está saliendo humo y se recalentó', 'si') ->> 'color';
begin if v is distinct from 'rojo' then raise exception 'FALLA X1: esperado rojo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['frenos']::text[], array[]::text[], 'El PEDAL BLANDO, se húnde', 'si') ->> 'color';
begin if v is distinct from 'rojo' then raise exception 'FALLA X2: esperado rojo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['direccion']::text[], array['direccion.se_va_lado']::text[], '', 'nose') ->> 'color';
begin if v is distinct from 'rojo' then raise exception 'FALLA X3: esperado rojo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['nose']::text[], array[]::text[], '', 'no') ->> 'color';
begin if v is distinct from 'rojo' then raise exception 'FALLA X4: esperado rojo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['carroceria', 'frenos']::text[], array['carroceria.rayon', 'frenos.testigo']::text[], '', 'si') ->> 'color';
begin if v is distinct from 'rojo' then raise exception 'FALLA X5: esperado rojo, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['nose']::text[], array[]::text[], 'Quiero que lo revisen', 'si') ->> 'color';
begin if v is distinct from 'verde' then raise exception 'FALLA X6: esperado verde, obtuvo %', v; end if; end $$;
do $$ declare v text := psr_privado.clasificar(array['motor']::text[], array['motor.check_engine']::text[], '', 'si') ->> 'color';
begin if v is distinct from 'amarillo' then raise exception 'FALLA X7: esperado amarillo, obtuvo %', v; end if; end $$;
-- Los semillas C1..C10 deben quedar con el color esperado en triage_interno (vía trigger)
do $$ declare r record; begin
  for r in select s.codigo_seguimiento, t.semaforo_auto from public.solicitudes s join public.triage_interno t on t.solicitud_id = s.id where s.codigo_seguimiento like 'PSR-DEMO%' loop
    if (r.codigo_seguimiento, r.semaforo_auto) not in (('PSR-DEMO01', 'verde'), ('PSR-DEMO02', 'verde'), ('PSR-DEMO03', 'verde'), ('PSR-DEMO04', 'amarillo'), ('PSR-DEMO05', 'amarillo'), ('PSR-DEMO06', 'amarillo'), ('PSR-DEMO07', 'rojo'), ('PSR-DEMO08', 'rojo'), ('PSR-DEMO09', 'rojo'), ('PSR-DEMO10', 'amarillo')) then
      raise exception 'FALLA semilla %: color %', r.codigo_seguimiento, r.semaforo_auto; end if;
  end loop;
  if (select count(*) from public.triage_interno) < 10 then raise exception 'FALLA: faltan triages de la semilla'; end if;
end $$;
