-- OPCIONAL · Programa la limpieza semanal (domingos 3 a. m. hora Colombia = 8 a. m. UTC).
-- Antes: 1) despliega la función:  supabase functions deploy limpieza --no-verify-jwt
--        2) define el secreto:     supabase secrets set LIMPIEZA_SECRETO=<una-clave-larga-al-azar>
--        3) en Database → Extensions activa pg_cron y pg_net.
-- Luego reemplaza TU-PROYECTO y TU-SECRETO y ejecuta esto en el SQL Editor.
select cron.schedule('psr-limpieza-semanal', '0 8 * * 0', $$
  select net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/limpieza',
    headers := jsonb_build_object('Authorization', 'Bearer TU-SECRETO')
  );
$$);
