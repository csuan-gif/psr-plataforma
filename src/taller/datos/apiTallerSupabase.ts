/**
 * API del panel del taller contra Supabase (sesión con correo y contraseña).
 * Las lecturas pasan por RLS: sin perfil del taller no se ve nada.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../compartido/datos/apiSupabase";
import type { Franja } from "../../compartido/config";
import { PLANTILLAS_BASE } from "../util/plantillas";
import { MENSAJE_BLOQUEO } from "../util/reglasOrden";
import {
  ErrorTaller, type Acta, type ApiTaller, type CitaAgenda, type Color, type DetalleSolicitud, type EstadoPresencia, type OrdenTaller, type Plantillas,
  type PrecargaRecepcion, type SolicitudTaller, type Usuario,
} from "./tipos";

function fallar(e: { message?: string } | null): never {
  const m = e?.message ?? "";
  if (m.includes("CUPO_LLENO")) throw new ErrorTaller("CUPO_LLENO", "Esa franja está llena o cerrada.");
  for (const c of ["ORDEN_ABIERTA", "PRESUPUESTO_NO_APROBADO", "PRUEBA_RUTA_NO_AUTORIZADA", "DATOS_ENTREGA", "ORDEN_CERRADA"] as const)
    if (m.includes(c)) throw new ErrorTaller(c, c === "ORDEN_ABIERTA" ? "Este vehículo ya tiene una orden abierta." : MENSAJE_BLOQUEO[c]);
  if (m.includes("FALTAN_FOTOS")) throw new ErrorTaller("FALTAN_FOTOS", "Faltan fotos obligatorias: " + m.split("FALTAN_FOTOS:")[1]?.trim());
  if (m.includes("ULTIMO_ADMIN")) throw new ErrorTaller("ULTIMO_ADMIN", "Debe quedar al menos un administrador activo.");
  if (m.includes("USUARIO_NO_EXISTE")) throw new ErrorTaller("USUARIO_NO_EXISTE", "Ese correo no tiene cuenta. Créala primero en Supabase → Authentication → Add user, y vuelve aquí.");
  if (m.includes("PLACA_DE_OTRO_CLIENTE")) throw new ErrorTaller("OTRO", "Esa placa está registrada a nombre de otro cliente. Búscala por placa.");
  if (m.includes("DATOS_INVALIDOS")) throw new ErrorTaller("OTRO", "Revisa los datos obligatorios.");
  if (m.includes("SIN_PRESUPUESTO_PENDIENTE")) throw new ErrorTaller("OTRO", "No hay un presupuesto pendiente en esta orden.");
  if (m.includes("MOTIVO_OBLIGATORIO")) throw new ErrorTaller("MOTIVO_OBLIGATORIO", "Escribe el motivo del cambio (mínimo 5 letras).");
  if (m.includes("NO_AUTORIZADO") || m.includes("row-level security") || m.includes("permission denied"))
    throw new ErrorTaller("NO_AUTORIZADO", "Tu usuario no tiene permiso para esta acción.");
  throw new ErrorTaller("OTRO", "No se pudo completar. Revisa la conexión e intenta de nuevo.");
}

async function perfil(id: string, correo?: string): Promise<Usuario | null> {
  const { data } = await supabase.from("perfiles").select("id,nombre,rol,activo").eq("id", id).maybeSingle();
  return data && data.activo ? { id: data.id, nombre: data.nombre, rol: data.rol, correo } : null;
}

// Columnas mínimas para la bandeja (los datos completos se piden con ver_solicitud, que queda auditado).
const SELECT_BANDEJA = `id, codigo_seguimiento, creado_en, estado, canal, zonas, sintomas, descripcion, puede_movilizarse, desde_cuando, adjuntos,
  autoriza_presupuesto, autoriza_prueba_ruta,
  cliente:clientes(id, nombre_razon_social, celular, numero_documento),
  vehiculo:vehiculos(id, placa, marca, linea_modelo, anio_modelo, color, km_ultimo),
  triage:triage_interno(semaforo_auto, semaforo_final, razones, motivo_cambio),
  citas(id, fecha, franja, estado, notas, creado_en)`;

type Fila = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

function aSolicitud(r: Fila): SolicitudTaller {
  const t = uno(r.triage) as Fila;
  const citas = ((r.citas as Fila[]) ?? []).sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)));
  const cita = citas.at(-1);
  const c = uno(r.cliente) as Fila, v = uno(r.vehiculo) as Fila;
  return {
    id: r.id, codigo: r.codigo_seguimiento, creadoEn: r.creado_en, estado: r.estado, canal: r.canal,
    cliente: { id: c.id, nombre: c.nombre_razon_social, celular: c.celular, numeroDocumento: c.numero_documento },
    vehiculo: { id: v.id, placa: v.placa, marca: v.marca, linea: v.linea_modelo, anio: v.anio_modelo, color: v.color, km: v.km_ultimo },
    zonas: r.zonas ?? [], sintomas: r.sintomas ?? [], descripcion: r.descripcion ?? "", movilidad: r.puede_movilizarse, desdeCuando: r.desde_cuando,
    adjuntos: r.adjuntos ?? [], presupuesto: r.autoriza_presupuesto, pruebaRuta: r.autoriza_prueba_ruta,
    semaforo: { auto: t?.semaforo_auto ?? "verde", final: t?.semaforo_final ?? "verde", razones: t?.razones ?? [], motivo: t?.motivo_cambio ?? null },
    cita: cita ? { id: cita.id, fecha: cita.fecha, franja: cita.franja, estado: cita.estado, notas: cita.notas } : null,
  };
}

async function ordenAbiertaDe(vehiculoId: string) {
  const { data } = await supabase.from("recepciones").select("ordenes_trabajo(estado)").eq("vehiculo_id", vehiculoId);
  return ((data as Fila[] | null) ?? []).some((r) => ((r.ordenes_trabajo as Fila[]) ?? []).some((o) => o.estado !== "entregado" && o.estado !== "cancelado"));
}

export const apiTallerSupabase: ApiTaller = {
  async sesionActual() {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    return u ? perfil(u.id, u.email) : null;
  },
  async iniciarSesion(correo, clave) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    if (error || !data.user) throw new ErrorTaller("CREDENCIALES", "Correo o contraseña incorrectos.");
    const p = await perfil(data.user.id, data.user.email);
    if (!p) { await supabase.auth.signOut(); throw new ErrorTaller("SIN_PERFIL", "Tu usuario no tiene acceso al panel del taller. Pídele al administrador que te habilite."); }
    return p;
  },
  async cerrarSesion() { await supabase.auth.signOut(); },

  async solicitudes() {
    const desde = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data, error } = await supabase.from("solicitudes").select(SELECT_BANDEJA).gte("creado_en", desde).order("creado_en", { ascending: false }).limit(300);
    if (error) fallar(error);
    return (data as Fila[]).map(aSolicitud);
  },
  async detalle(id) {
    const { data, error } = await supabase.rpc("ver_solicitud", { p_id: id });
    if (error) fallar(error);
    const d = data as Fila;
    return { ...d, cliente: d.cliente, cita: d.cita ?? null, cambios: d.cambios ?? [] } as DetalleSolicitud;
  },
  alCambiar(cb) {
    const canal = supabase.channel("bandeja-taller")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "solicitudes" }, (p) => cb({ tipo: "nueva", codigo: (p.new as Fila).codigo_seguimiento }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "solicitudes" }, () => cb({ tipo: "cambio" }))
      .on("postgres_changes", { event: "*", schema: "public", table: "triage_interno" }, () => cb({ tipo: "cambio" }))
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, () => cb({ tipo: "cambio" }))
      .on("postgres_changes", { event: "*", schema: "public", table: "ordenes_trabajo" }, () => cb({ tipo: "cambio" }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "historial_estados" }, () => cb({ tipo: "cambio" }))
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  },
  async urlArchivo(ruta) {
    const { data } = await supabase.storage.from("solicitudes").createSignedUrl(ruta, 600); // 10 minutos
    return data?.signedUrl ?? null;
  },
  async cambiarSemaforo(id, color: Color, motivo) {
    const { error } = await supabase.rpc("cambiar_semaforo", { p_solicitud: id, p_color: color, p_motivo: motivo });
    if (error) fallar(error);
  },
  async marcarSolicitud(id, estado) {
    const { error } = await supabase.rpc("marcar_solicitud", { p_id: id, p_estado: estado });
    if (error) fallar(error);
  },

  async cupos(desde, hasta) {
    const { data, error } = await supabase.rpc("cupos_taller", { p_desde: desde, p_hasta: hasta });
    if (error) fallar(error);
    return data as { fecha: string; franja: Franja; cupos: number; usados: number; motivo: string | null }[];
  },
  async citas(desde, hasta) {
    const { data, error } = await supabase.from("citas")
      .select("id, fecha, franja, estado, notas, solicitud:solicitudes(id, codigo_seguimiento, cliente:clientes(nombre_razon_social, celular), vehiculo:vehiculos(placa, marca, linea_modelo), triage:triage_interno(semaforo_final))")
      .gte("fecha", desde).lte("fecha", hasta);
    if (error) fallar(error);
    return (data as Fila[]).map((c): CitaAgenda => {
      const s = uno(c.solicitud) as Fila, cl = uno(s.cliente) as Fila, v = uno(s.vehiculo) as Fila, t = uno(s.triage) as Fila;
      return { id: c.id, fecha: c.fecha, franja: c.franja, estado: c.estado, notas: c.notas, solicitudId: s.id, codigo: s.codigo_seguimiento,
        nombre: cl.nombre_razon_social, celular: cl.celular, placa: v.placa, vehiculo: [v.marca, v.linea_modelo].filter(Boolean).join(" "), color: t?.semaforo_final ?? "verde" };
    });
  },
  async estadoCita(citaId, estado, nota) {
    const { error } = await supabase.rpc("cambiar_estado_cita", { p_cita: citaId, p_estado: estado, p_nota: nota ?? null });
    if (error) fallar(error);
  },
  async reprogramarCita(citaId, fecha, franja, forzar) {
    const { error } = await supabase.rpc("reprogramar_cita", { p_cita: citaId, p_fecha: fecha, p_franja: franja, p_forzar: !!forzar });
    if (error) fallar(error);
  },
  async crearCita(solicitudId, fecha, franja, forzar) {
    const { error } = await supabase.rpc("crear_cita_taller", { p_solicitud: solicitudId, p_fecha: fecha, p_franja: franja, p_forzar: !!forzar });
    if (error) fallar(error);
  },

  async configAgenda() {
    const [d, b, f] = await Promise.all([
      supabase.from("disponibilidad").select("*").order("dia_semana"),
      supabase.from("dias_bloqueados").select("*").gte("fecha", new Date().toISOString().slice(0, 10)).order("fecha"),
      supabase.from("festivos").select("*").order("fecha"),
    ]);
    if (d.error || b.error || f.error) fallar(d.error ?? b.error ?? f.error);
    return {
      disponibilidad: (d.data as Fila[]).map((x) => ({ diaSemana: x.dia_semana, franja: x.franja, horaInicio: String(x.hora_inicio).slice(0, 5), horaFin: String(x.hora_fin).slice(0, 5), cupos: x.cupos, activo: x.activo })),
      bloqueados: (b.data as Fila[]).map((x) => ({ id: String(x.id), fecha: x.fecha, franja: x.franja, motivo: x.motivo })),
      festivos: f.data as { fecha: string; nombre: string }[],
    };
  },
  async guardarDisponibilidad(filas) {
    const { error } = await supabase.from("disponibilidad").upsert(filas.map((x) => ({
      dia_semana: x.diaSemana, franja: x.franja, hora_inicio: x.horaInicio, hora_fin: x.horaFin, cupos: x.cupos, activo: x.activo,
    })));
    if (error) fallar(error);
  },
  async bloquear(fecha, franja, motivo) {
    const { error } = await supabase.from("dias_bloqueados").insert({ fecha, franja, motivo: motivo || null });
    if (error) fallar(error);
  },
  async desbloquear(id) {
    const { error } = await supabase.from("dias_bloqueados").delete().eq("id", Number(id));
    if (error) fallar(error);
  },
  async plantillas() {
    const { data } = await supabase.from("config_taller").select("valor").eq("clave", "plantillas_whatsapp").maybeSingle();
    return { ...PLANTILLAS_BASE, ...((data?.valor as Partial<Plantillas>) ?? {}) };
  },
  async guardarPlantillas(p) {
    const { error } = await supabase.from("config_taller").upsert({ clave: "plantillas_whatsapp", valor: p });
    if (error) fallar(error);
  },

  presencia(u, cb) {
    let viendo: string | null = null;
    const canal: RealtimeChannel = supabase.channel("taller-presencia", { config: { private: true, presence: { key: u.id } } });
    canal.on("presence", { event: "sync" }, () => {
      const estado = canal.presenceState<{ nombre: string; viendo: string | null }>();
      const otros: EstadoPresencia[] = Object.entries(estado).filter(([k]) => k !== u.id).map(([k, v]) => ({ usuarioId: k, nombre: v[0]?.nombre ?? "", viendo: v[0]?.viendo ?? null }));
      cb(otros);
    }).subscribe((s) => { if (s === "SUBSCRIBED") void canal.track({ nombre: u.nombre, viendo }); });
    return {
      ver(id) { viendo = id; void canal.track({ nombre: u.nombre, viendo }); },
      salir() { void canal.untrack(); void supabase.removeChannel(canal); },
    };
  },

  // ---------- Fase 3 ----------
  async precargaDesdeSolicitud(solicitudId) {
    const d = await this.detalle(solicitudId); // queda auditado
    return {
      solicitudId: d.id, codigo: d.codigo, ordenAbierta: await ordenAbiertaDe(d.vehiculo.id),
      vehiculo: { id: d.vehiculo.id, placa: d.vehiculo.placa, marca: d.vehiculo.marca, linea: d.vehiculo.linea, anio: d.vehiculo.anio, color: d.vehiculo.color, vin: d.vehiculo.vin, combustible: d.vehiculo.combustible, km: d.vehiculo.km },
      cliente: { id: d.cliente.id, tipoDocumento: d.cliente.tipoDocumento, numeroDocumento: d.cliente.numeroDocumento, nombre: d.cliente.nombre, celular: d.cliente.celular, correo: d.cliente.correo, direccion: d.cliente.direccion },
      presupuesto: d.presupuesto as "previo" | "sin_presupuesto", pruebaRuta: d.pruebaRuta,
      reporte: { zonas: d.zonas, sintomas: d.sintomas, descripcion: d.descripcion },
    };
  },
  async buscarVehiculo(placa) {
    const { data, error } = await supabase.rpc("ver_vehiculo", { p_placa: placa });
    if (error) fallar(error);
    if (!data) return null;
    const r = data as Fila;
    let sol: Fila | null = null;
    if (r.solicitudId) sol = (await supabase.from("solicitudes").select("codigo_seguimiento, zonas, sintomas, descripcion, autoriza_presupuesto, autoriza_prueba_ruta").eq("id", r.solicitudId).maybeSingle()).data;
    const p: PrecargaRecepcion = {
      solicitudId: r.solicitudId ?? null, codigo: sol?.codigo_seguimiento ?? null, ordenAbierta: !!r.ordenAbierta, vehiculo: r.vehiculo, cliente: r.cliente,
      presupuesto: sol?.autoriza_presupuesto ?? null, pruebaRuta: sol ? sol.autoriza_prueba_ruta : null,
      reporte: sol ? { zonas: sol.zonas, sintomas: sol.sintomas, descripcion: sol.descripcion } : null,
    };
    return p;
  },
  async subirArchivoActa(actaId, archivo, nombre) {
    const limpio = nombre.normalize("NFD").replace(/[^\w.-]/g, "_").slice(-60);
    const ruta = `actas/${actaId}/${crypto.randomUUID()}-${limpio}`;
    const { error } = await supabase.storage.from("recepciones").upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });
    if (error) fallar(error);
    return ruta;
  },
  async crearRecepcion(r) {
    const { data, error } = await supabase.rpc("crear_recepcion", { p: r });
    if (error) fallar(error);
    return data as { recepcionId: string; ordenId: string; codigo: string | null };
  },
  async acta(recepcionId) {
    const { data, error } = await supabase.from("recepciones")
      .select("*, receptor:perfiles(nombre), solicitud:solicitudes(codigo_seguimiento), orden:ordenes_trabajo(id), vehiculo:vehiculos(id, placa, marca, linea_modelo, anio_modelo, color, vin, combustible_tipo, km_ultimo, cliente:clientes(id, tipo_documento, numero_documento, nombre_razon_social, celular, correo, direccion))")
      .eq("id", recepcionId).single();
    if (error) fallar(error);
    const a = data as Fila, v = uno(a.vehiculo) as Fila, c = uno(v.cliente) as Fila;
    const acta: Acta = {
      id: a.id, ordenId: (uno(a.orden) as Fila)?.id ?? null, fechaHora: a.fecha_hora, recibidoPor: (uno(a.receptor) as Fila)?.nombre ?? null,
      codigo: (uno(a.solicitud) as Fila)?.codigo_seguimiento ?? null, solicitudId: a.solicitud_id, vehiculoId: v.id,
      kmIngreso: a.km_ingreso, nivelCombustible: Number(a.nivel_combustible), checklist: a.checklist, mapaDanos: a.mapa_danos,
      objetosPersonales: a.objetos_personales ?? "", accesorios: a.accesorios ?? "", fotos: a.fotos, videoInspeccion: a.video_inspeccion_url,
      autorizaPresupuestoPrevio: a.autoriza_presupuesto_previo, autorizaPruebaRuta: a.autoriza_prueba_ruta, observaciones: a.observaciones ?? "",
      firmaCliente: a.firma_cliente_url, firmadoPor: a.firmado_por ?? "",
      vehiculo: { id: v.id, placa: v.placa, marca: v.marca, linea: v.linea_modelo, anio: v.anio_modelo, color: v.color, vin: v.vin, combustible: v.combustible_tipo, km: v.km_ultimo },
      cliente: { id: c.id, tipoDocumento: c.tipo_documento, numeroDocumento: c.numero_documento, nombre: c.nombre_razon_social, celular: c.celular, correo: c.correo, direccion: c.direccion },
    };
    return acta;
  },
  async ordenes() {
    const limite = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data, error } = await supabase.from("ordenes_trabajo")
      .select("*, tecnico:perfiles(id, nombre), recepcion:recepciones(id, solicitud_id, km_ingreso, nivel_combustible, autoriza_presupuesto_previo, autoriza_prueba_ruta, solicitud:solicitudes(codigo_seguimiento, triage:triage_interno(semaforo_final)), vehiculo:vehiculos(id, placa, marca, linea_modelo, cliente:clientes(nombre_razon_social, celular)))")
      .or(`estado.not.in.(entregado,cancelado),fecha_entrega.gte.${limite}`)
      .order("creado_en");
    if (error) fallar(error);
    return (data as Fila[]).map((o): OrdenTaller => {
      const r = uno(o.recepcion) as Fila, v = uno(r.vehiculo) as Fila, c = uno(v.cliente) as Fila, s = uno(r.solicitud) as Fila | null, t = uno(o.tecnico) as Fila | null;
      return {
        id: o.id, estado: o.estado, creadoEn: o.creado_en, codigo: s?.codigo_seguimiento ?? null, solicitudId: r.solicitud_id, recepcionId: r.id,
        vehiculo: { id: v.id, placa: v.placa, marca: v.marca, linea: v.linea_modelo }, cliente: { nombre: c.nombre_razon_social, celular: c.celular },
        tecnico: t ? { id: t.id, nombre: t.nombre } : null, trabajos: o.trabajos ?? [],
        presupuesto: { total: o.presupuesto_total, estado: o.presupuesto_estado, enviadoEn: o.presupuesto_enviado_en, aprobadoPor: o.presupuesto_aprobado_por },
        autorizaPresupuestoPrevio: r.autoriza_presupuesto_previo, autorizaPruebaRuta: r.autoriza_prueba_ruta, kmIngreso: r.km_ingreso,
        kmSalida: o.km_salida, garantiaHasta: o.garantia_hasta, fechaEntrega: o.fecha_entrega,
        nivelCombustibleIngreso: r.nivel_combustible == null ? null : Number(r.nivel_combustible),
        nivelCombustibleSalida: o.nivel_combustible_salida == null ? null : Number(o.nivel_combustible_salida),
        color: (uno(s?.triage) as Fila | null)?.semaforo_final ?? null,
      };
    });
  },
  async historialOrden(ordenId) {
    const { data, error } = await supabase.from("historial_estados").select("estado, fecha, nota, quien:perfiles(nombre)").eq("orden_id", ordenId).order("fecha");
    if (error) fallar(error);
    return (data as Fila[]).map((h) => ({ estado: h.estado, fecha: h.fecha, nota: h.nota, usuario: (uno(h.quien) as Fila | null)?.nombre ?? "Cliente (portal)" }));
  },
  async cambiarEstadoOrden(ordenId, estado, datos = {}) {
    const { error } = await supabase.rpc("cambiar_estado_orden", { p_orden: ordenId, p_estado: estado, p_datos: datos });
    if (error) fallar(error);
  },
  async guardarTrabajos(ordenId, trabajos) {
    const { error } = await supabase.from("ordenes_trabajo").update({ trabajos }).eq("id", ordenId);
    if (error) fallar(error);
  },
  async asignarTecnico(ordenId, tecnicoId) {
    const { error } = await supabase.from("ordenes_trabajo").update({ tecnico_asignado: tecnicoId }).eq("id", ordenId);
    if (error) fallar(error);
  },
  async enviarPresupuesto(ordenId, total, trabajos) {
    const { error } = await supabase.rpc("enviar_presupuesto", { p_orden: ordenId, p_total: total, p_trabajos: trabajos });
    if (error) fallar(error);
  },
  async registrarRespuestaPresupuesto(ordenId, decision, nota) {
    const { error } = await supabase.rpc("registrar_respuesta_presupuesto", { p_orden: ordenId, p_decision: decision, p_nota: nota });
    if (error) fallar(error);
  },
  async tecnicos() {
    const { data, error } = await supabase.from("perfiles").select("id, nombre, rol").eq("activo", true).order("nombre");
    if (error) fallar(error);
    return data as Usuario[];
  },
  async planes() {
    const { data, error } = await supabase.from("planes_mantenimiento").select("id, servicio, intervalo_km, intervalo_meses, aplica_a").eq("activo", true).order("id");
    if (error) fallar(error);
    return (data as Fila[]).map((p) => ({ id: p.id, servicio: p.servicio, intervaloKm: p.intervalo_km, intervaloMeses: p.intervalo_meses, aplicaA: p.aplica_a }));
  },

  // ---------- Fase 4 ----------
  async clientes() {
    const { data, error } = await supabase.from("clientes")
      .select("id, tipo_documento, numero_documento, nombre_razon_social, celular, correo, origen, autoriza_datos, anonimizado_en, creado_en, vehiculos(placa)")
      .order("nombre_razon_social").limit(5000);
    if (error) fallar(error);
    return (data as Fila[]).map((c) => ({
      id: c.id, nombre: c.nombre_razon_social, tipoDocumento: c.tipo_documento, numeroDocumento: c.numero_documento, celular: c.celular, correo: c.correo,
      origen: c.origen, autorizaDatos: c.autoriza_datos, anonimizado: !!c.anonimizado_en, creadoEn: c.creado_en, placas: ((c.vehiculos as Fila[]) ?? []).map((v) => v.placa),
    }));
  },
  async fichaCliente(id) {
    const { data, error } = await supabase.rpc("ver_cliente", { p_id: id });
    if (error) fallar(error);
    return data as never;
  },
  async actualizarCliente(id, c) {
    const fila: Fila = {};
    if (c.celular !== undefined) fila.celular = c.celular.replace(/\D/g, "");
    if (c.correo !== undefined) fila.correo = c.correo || null;
    if (c.direccion !== undefined) fila.direccion = c.direccion || null;
    if (c.aceptaRecordatorios !== undefined) fila.acepta_recordatorios = c.aceptaRecordatorios;
    const { error } = await supabase.from("clientes").update({ ...fila, actualizado_en: new Date().toISOString() }).eq("id", id);
    if (error) fallar(error);
  },
  async actualizarVehiculo(id, v) {
    const fila: Fila = {};
    if (v.fechaSoat !== undefined) fila.fecha_soat = v.fechaSoat || null;
    if (v.fechaTecnomecanica !== undefined) fila.fecha_tecnomecanica = v.fechaTecnomecanica || null;
    const { error } = await supabase.from("vehiculos").update(fila).eq("id", id);
    if (error) fallar(error);
  },
  async anonimizarCliente(id, motivo) {
    const { error } = await supabase.rpc("anonimizar_cliente", { p_id: id, p_motivo: motivo });
    if (error) fallar(error);
  },
  async registrarExportacion(filas, formato) {
    const { error } = await supabase.rpc("registrar_exportacion", { p_filas: filas, p_formato: formato });
    if (error) fallar(error);
  },
  async importarClientes(filas) {
    const total = { filas: 0, clientesNuevos: 0, clientesActualizados: 0, vehiculosNuevos: 0, vehiculosActualizados: 0, recordatorios: 0, errores: [] as { fila: number; motivo: string }[] };
    for (let i = 0; i < filas.length; i += 500) { // por bloques para no exceder el tiempo de la función
      const { data, error } = await supabase.rpc("importar_clientes", { p_filas: filas.slice(i, i + 500) });
      if (error) fallar(error);
      const r = data as typeof total;
      total.filas += r.filas; total.clientesNuevos += r.clientesNuevos; total.clientesActualizados += r.clientesActualizados;
      total.vehiculosNuevos += r.vehiculosNuevos; total.vehiculosActualizados += r.vehiculosActualizados; total.recordatorios += r.recordatorios;
      total.errores.push(...r.errores.map((e) => ({ ...e, fila: e.fila + i })));
    }
    return total;
  },
  async recordatorios(dias) {
    const { data, error } = await supabase.rpc("recordatorios_proximos", { p_dias: dias });
    if (error) fallar(error);
    return data as never;
  },
  async marcarRecordatorio(id, estado) {
    const { error } = await supabase.rpc("marcar_recordatorio", { p_id: id, p_estado: estado });
    if (error) fallar(error);
  },
  async indicadorRecordatorios(dias) {
    const { data, error } = await supabase.rpc("indicador_recordatorios", { p_dias: dias });
    if (error) fallar(error);
    return data as never;
  },
  async guardarPlan(p) {
    const { error } = await supabase.from("planes_mantenimiento").update({ servicio: p.servicio, intervalo_km: p.intervaloKm, intervalo_meses: p.intervaloMeses, aplica_a: p.aplicaA, activo: p.activo ?? true }).eq("id", p.id);
    if (error) fallar(error);
  },
  async crearPlan(p) {
    const { error } = await supabase.from("planes_mantenimiento").insert({ servicio: p.servicio, intervalo_km: p.intervaloKm, intervalo_meses: p.intervaloMeses, aplica_a: p.aplicaA });
    if (error) fallar(error);
  },

  // ---------- Fase 5 ----------
  async guardarConfigPublica(d) {
    const { data } = await supabase.from("config_taller").select("valor").eq("clave", "publico").maybeSingle();
    const { error } = await supabase.from("config_taller").upsert({ clave: "publico", valor: { ...((data?.valor as Fila) ?? {}), ...d } });
    if (error) fallar(error);
  },
  async usuarios() {
    const { data, error } = await supabase.rpc("usuarios_taller");
    if (error) fallar(error);
    return data as never;
  },
  async agregarUsuario(correo, nombre, rol) {
    const { error } = await supabase.rpc("agregar_usuario", { p_correo: correo, p_nombre: nombre, p_rol: rol });
    if (error) fallar(error);
  },
  async actualizarUsuario(id, rol, activo) {
    const { error } = await supabase.rpc("actualizar_usuario", { p_id: id, p_rol: rol, p_activo: activo });
    if (error) fallar(error);
  },
  async reglas() {
    const { data, error } = await supabase.from("reglas_semaforo").select("id, tipo, valor, zona, color, activo").order("id");
    if (error) fallar(error);
    return data as never;
  },
  async guardarRegla(r) {
    const { error } = await supabase.from("reglas_semaforo").update({ color: r.color, activo: r.activo, valor: r.valor }).eq("id", r.id);
    if (error) fallar(error);
  },
  async crearRegla(r) {
    const { error } = await supabase.from("reglas_semaforo").insert({ tipo: r.tipo, valor: r.valor.trim().toLowerCase(), zona: r.zona, color: r.color });
    if (error) fallar(error);
  },
  async probarSemaforo(e) {
    const { data, error } = await supabase.rpc("probar_semaforo", { p: e });
    if (error) fallar(error);
    return data as never;
  },
  async catalogoAdmin() {
    const [z, s2] = await Promise.all([supabase.from("zonas").select("*").order("orden"), supabase.from("sintomas").select("*").order("orden")]);
    if (z.error || s2.error) fallar(z.error ?? s2.error);
    return { zonas: z.data as never, sintomas: s2.data as never };
  },
  async guardarSintoma(x) {
    const { error } = await supabase.from("sintomas").update({ etiqueta: x.etiqueta.trim(), activo: x.activo, orden: x.orden }).eq("id", x.id);
    if (error) fallar(error);
  },
  async crearSintoma(x, color) {
    const id = `${x.zona}.${x.etiqueta.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30)}`;
    const { error } = await supabase.from("sintomas").insert({ id, zona: x.zona, etiqueta: x.etiqueta.trim(), orden: 900 });
    if (error) fallar(error);
    const r = await supabase.from("reglas_semaforo").insert({ tipo: "sintoma", valor: id, color });
    if (r.error) fallar(r.error);
  },
  async altaRapida(d) {
    const { data, error } = await supabase.rpc("alta_rapida", { p: d });
    if (error) fallar(error);
    return data as string;
  },
};
