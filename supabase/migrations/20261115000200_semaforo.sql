-- =====================================================================
-- 0002 · Semáforo calculado en el servidor
-- Misma lógica que src/demo/motorSemaforo.ts; ambas se prueban con
-- tests/casos.json (C1 a C10). Gana el color más grave encontrado.
-- =====================================================================

create or replace function psr_privado.normalizar(t text) returns text
language sql immutable as $$
  select regexp_replace(
           trim(translate(lower(coalesce(t, '')), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio')),
           '\s+', ' ', 'g')
$$;

create or replace function psr_privado.clasificar(
  p_zonas text[], p_sintomas text[], p_descripcion text, p_movilidad text
) returns jsonb
language plpgsql stable security definer set search_path = public, psr_privado as $$
declare
  v_rojo  text[] := '{}';
  v_amar  text[] := '{}';
  v_txt   text   := psr_privado.normalizar(p_descripcion);
  v_razon text;
  v_color text;
  r       record;
begin
  for r in select * from public.reglas_semaforo where activo order by id loop
    v_razon := null;
    if r.tipo = 'movilidad' and p_movilidad = r.valor then
      v_razon := 'El cliente indica que el vehículo no puede movilizarse';
    elsif r.tipo = 'movilidad_zona' and p_movilidad = r.valor and r.zona = any (coalesce(p_zonas, '{}')) then
      v_razon := 'No está seguro de poder movilizarse y marcó la zona ' || r.zona;
    elsif r.tipo = 'sintoma' and r.valor = any (coalesce(p_sintomas, '{}')) then
      v_razon := 'Síntoma marcado: ' || r.valor;
    elsif r.tipo = 'palabra' and v_txt <> '' and position(psr_privado.normalizar(r.valor) in v_txt) > 0 then
      v_razon := 'La descripción menciona «' || r.valor || '»';
    end if;
    if v_razon is not null then
      if r.color = 'rojo' then v_rojo := v_rojo || v_razon;
      elsif r.color = 'amarillo' then v_amar := v_amar || v_razon;
      end if;
    end if;
  end loop;

  v_color := case when cardinality(v_rojo) > 0 then 'rojo'
                  when cardinality(v_amar) > 0 then 'amarillo'
                  else 'verde' end;
  return jsonb_build_object(
    'color', v_color,
    'razones', to_jsonb(case v_color
                          when 'rojo' then v_rojo
                          when 'amarillo' then v_amar
                          else array['Mantenimiento, cotización, latonería sin compromiso mecánico o duda general'] end));
end $$;

-- Calcula (o recalcula) el semáforo al crear o cambiar la solicitud.
create or replace function psr_privado.tg_solicitud_semaforo() returns trigger
language plpgsql security definer set search_path = public, psr_privado as $$
declare v jsonb;
begin
  v := psr_privado.clasificar(new.zonas, new.sintomas, new.descripcion, new.puede_movilizarse);
  if tg_op = 'INSERT' then
    insert into public.triage_interno (solicitud_id, semaforo_auto, semaforo_final, razones)
    values (new.id, v ->> 'color', v ->> 'color', v -> 'razones');
  else
    update public.triage_interno t
       set semaforo_auto  = v ->> 'color',
           -- si nadie lo cambió a mano, el color final sigue al automático
           semaforo_final = case when t.motivo_cambio is null then v ->> 'color' else t.semaforo_final end,
           razones        = v -> 'razones',
           calculado_en   = now()
     where t.solicitud_id = new.id;
  end if;
  return new;
end $$;

create trigger solicitud_semaforo_ins after insert on public.solicitudes
  for each row execute function psr_privado.tg_solicitud_semaforo();
create trigger solicitud_semaforo_upd after update of zonas, sintomas, descripcion, puede_movilizarse on public.solicitudes
  for each row execute function psr_privado.tg_solicitud_semaforo();
