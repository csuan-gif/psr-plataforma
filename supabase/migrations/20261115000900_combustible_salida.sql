-- =====================================================================
-- 0009 · Nivel de combustible a la entrega del vehículo.
-- Se marca con el mismo medidor del acta de ingreso (pasos de 1/8) y es
-- obligatorio para registrar la entrega.
-- =====================================================================

alter table public.ordenes_trabajo
  add column if not exists nivel_combustible_salida numeric(4, 3)
  check (nivel_combustible_salida between 0 and 1 and nivel_combustible_salida * 8 = round(nivel_combustible_salida * 8));

create or replace function public.cambiar_estado_orden(p_orden uuid, p_estado text, p_datos jsonb default '{}') returns void
language plpgsql volatile security definer set search_path = public, psr_privado as $$
declare
  o public.ordenes_trabajo;
  r public.recepciones;
  v_nota text := nullif(trim(coalesce(p_datos ->> 'nota', '')), '');
  v_km int; v_garantia date; v_trabajos jsonb; v_nivel numeric;
begin
  perform psr_privado.exigir_taller();
  select * into o from public.ordenes_trabajo where id = p_orden for update;
  if o.id is null then raise exception 'NO_ENCONTRADO'; end if;
  select * into r from public.recepciones where id = o.recepcion_id;
  if p_estado <> 'cancelado' and not (p_estado = any (psr_privado.orden_estados())) then raise exception 'DATOS_INVALIDOS'; end if;
  if o.estado in ('entregado', 'cancelado') and not psr_privado.es_admin() then raise exception 'ORDEN_CERRADA'; end if;
  if p_estado = o.estado then return; end if;

  -- Regla 1: con presupuesto previo, no se repara sin aprobación.
  --   Si el cliente lo RECHAZÓ, el vehículo puede pasar a "listo" para devolverlo sin reparar.
  if r.autoriza_presupuesto_previo and (
       (p_estado in ('en_reparacion', 'en_prueba') and o.presupuesto_estado <> 'aprobado')
    or (p_estado = 'listo' and o.presupuesto_estado = 'pendiente')) then
    raise exception 'PRESUPUESTO_NO_APROBADO' using errcode = 'P0412';
  end if;

  -- Regla 2: sin autorización de prueba de ruta, hay que registrar cómo se probó o la nueva autorización.
  if p_estado = 'en_prueba' and not r.autoriza_prueba_ruta then
    if length(coalesce(p_datos ->> 'autorizacionNueva', '')) >= 5 then
      v_nota := 'Nueva autorización de prueba de ruta: ' || trim(p_datos ->> 'autorizacionNueva');
    elsif length(coalesce(p_datos ->> 'pruebaSinConducir', '')) >= 5 then
      v_nota := 'Prueba sin conducir: ' || trim(p_datos ->> 'pruebaSinConducir');
    else
      raise exception 'PRUEBA_RUTA_NO_AUTORIZADA' using errcode = 'P0412';
    end if;
  end if;

  -- Regla 3: la entrega exige km de salida, nivel de combustible de salida, trabajos realizados y garantía.
  if p_estado = 'entregado' then
    v_km := nullif(p_datos ->> 'kmSalida', '')::int;
    v_garantia := nullif(p_datos ->> 'garantiaHasta', '')::date;
    v_trabajos := coalesce(p_datos -> 'trabajos', o.trabajos);
    v_nivel := nullif(p_datos ->> 'nivelCombustibleSalida', '')::numeric;
    if v_km is null or v_km < coalesce(r.km_ingreso, 0)
       or v_nivel is null or v_nivel < 0 or v_nivel > 1 or v_nivel * 8 <> round(v_nivel * 8) or v_garantia is null or v_garantia < psr_privado.hoy()
       or jsonb_typeof(v_trabajos) <> 'array' or jsonb_array_length(v_trabajos) = 0 then
      raise exception 'DATOS_ENTREGA' using errcode = 'P0412';
    end if;
    update public.ordenes_trabajo set km_salida = v_km, nivel_combustible_salida = v_nivel, garantia_hasta = v_garantia, trabajos = v_trabajos, fecha_entrega = now() where id = p_orden;
    update public.vehiculos set km_ultimo = v_km, km_ultimo_fecha = psr_privado.hoy() where id = r.vehiculo_id;
  end if;

  update public.ordenes_trabajo set estado = p_estado where id = p_orden;
  insert into public.historial_estados (orden_id, estado, usuario, nota) values (p_orden, p_estado, auth.uid(), v_nota);
  if p_estado = 'entregado' then
    perform psr_privado.generar_recordatorios(p_orden);
  end if;
end $$;
