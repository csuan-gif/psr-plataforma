/**
 * API del panel del taller en MODO DEMO. Simula el tiempo real entre pestañas
 * del mismo navegador (evento "storage" y BroadcastChannel para la presencia).
 */
import { CLAVE_DB, db, cupoFranja, urlAdjuntoDemo, guardarArchivoDemo, type BaseDemo } from "./apiDemo";
import { codigoSeguimiento, nuevoId } from "../compartido/util/almacen";
import { clasificar, listaDesdeReglas, reglasDesdeLista } from "./motorSemaforo";
import type { Franja } from "../compartido/config";
import {
  ErrorTaller, type ApiTaller, type CitaAgenda, type Color, type DetalleSolicitud, type EstadoPresencia, type Plantillas, type SolicitudTaller, type Usuario,
} from "../taller/datos/tipos";
import { PLANTILLAS_BASE } from "../taller/util/plantillas";
import { sumarDias } from "../compartido/util/fechas";
import { ErrorOrden, cambiarEstadoDemo, crearRecepcionDemo, enviarPresupuestoDemo, ordenAbierta, responderPresupuestoDemo } from "./ordenesDemo";
import type { Acta, OrdenTaller, PrecargaRecepcion } from "../taller/datos/tipos";
import { anonimizarDemo, fichaDemo, importarDemo, indicadorDemo, marcarRecordatorioDemo, recordatoriosProximos, sincronizarVencimientos } from "./mantenimientoDemo";

const USUARIOS: Usuario[] = [
  { id: "u-javier", nombre: "Javier Montoya", rol: "admin", correo: "javier@demo" },
  { id: "u-mecanico", nombre: "Mecánico (demo)", rol: "tecnico", correo: "mecanico@demo" },
  { id: "u-electrico", nombre: "Eléctrico (demo)", rol: "tecnico", correo: "electrico@demo" },
];
// La sesión demo vive en sessionStorage: cada pestaña puede ser un usuario distinto (Javier y el mecánico).
const CLAVE_SESION = "psr-demo-sesion";
let sesionMemoria: string | null = null;
const sesion = {
  leer: () => { try { return sessionStorage.getItem(CLAVE_SESION); } catch { return sesionMemoria; } },
  guardar: (v: string | null) => { sesionMemoria = v; try { if (v) sessionStorage.setItem(CLAVE_SESION, v); else sessionStorage.removeItem(CLAVE_SESION); } catch { /* memoria */ } },
};
let actual: Usuario | null = null;
const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const yo = () => { if (!actual) throw new ErrorTaller("NO_AUTORIZADO", "Inicia sesión."); return actual; };

function mutar(fn: (b: BaseDemo) => void, evento: "cambio" = "cambio") {
  const b = db.cargar();
  fn(b);
  db.guardar(b);
  window.dispatchEvent(new CustomEvent("psr-demo-cambio", { detail: { tipo: evento } }));
}

function aSolicitud(b: BaseDemo, id: string): SolicitudTaller {
  const s = b.solicitudes.find((x) => x.id === id)!;
  const c = b.clientes.find((x) => x.id === s.clienteId)!;
  const v = b.vehiculos.find((x) => x.id === s.vehiculoId)!;
  const t = b.triage.find((x) => x.solicitudId === id)!;
  const cita = b.citas.filter((x) => x.solicitudId === id).at(-1);
  return {
    id, codigo: s.codigo, creadoEn: s.creadoEn, estado: s.estado as SolicitudTaller["estado"], canal: s.canal,
    cliente: { id: c.id, nombre: c.nombre, celular: c.celular, numeroDocumento: c.numeroDocumento },
    vehiculo: { id: v.id, placa: v.placa, marca: v.marca, linea: v.linea, anio: v.anio, color: v.color, km: v.km },
    zonas: s.zonas, sintomas: s.sintomas, descripcion: s.descripcion, movilidad: s.movilidad, desdeCuando: s.desdeCuando ?? null,
    adjuntos: s.adjuntos, presupuesto: s.presupuesto, pruebaRuta: s.pruebaRuta,
    semaforo: { auto: t.auto, final: t.final, razones: t.razones, motivo: t.motivoCambio ?? null },
    cita: cita ? { id: cita.id, fecha: cita.fecha, franja: cita.franja, estado: cita.estado, notas: cita.notas ?? null } : null,
  };
}

function precarga(b: BaseDemo, vehiculoId: string, solicitudId: string | null): PrecargaRecepcion {
  const v = b.vehiculos.find((x) => x.id === vehiculoId)!;
  const c = b.clientes.find((x) => x.id === v.clienteId)!;
  const s = solicitudId ? b.solicitudes.find((x) => x.id === solicitudId) : null;
  return {
    solicitudId: s?.id ?? null, codigo: s?.codigo ?? null, ordenAbierta: ordenAbierta(b, v.id),
    vehiculo: { id: v.id, placa: v.placa, marca: v.marca, linea: v.linea, anio: v.anio, color: v.color || null, vin: v.vin ?? null, combustible: v.combustible || null, km: v.km },
    cliente: { id: c.id, tipoDocumento: c.tipoDocumento, numeroDocumento: c.numeroDocumento, nombre: c.nombre, celular: c.celular, correo: c.correo ?? null, direccion: c.direccion ?? null },
    presupuesto: s ? (s.presupuesto as "previo" | "sin_presupuesto") : null, pruebaRuta: s ? s.pruebaRuta : null,
    reporte: s ? { zonas: s.zonas, sintomas: s.sintomas, descripcion: s.descripcion } : null,
  };
}
const inactivos = new Set<string>();
const soloAdmin = () => { if (yo().rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador puede cambiar esto."); };
const avisar = () => window.dispatchEvent(new CustomEvent("psr-demo-cambio", { detail: { tipo: "cambio" } }));
function demoOError<T>(fn: () => T): T {
  try { return fn(); } catch (e) {
    if (e instanceof ErrorOrden) throw new ErrorTaller((["ORDEN_ABIERTA", "FALTAN_FOTOS", "PRESUPUESTO_NO_APROBADO", "PRUEBA_RUTA_NO_AUTORIZADA", "DATOS_ENTREGA", "ORDEN_CERRADA"].includes(e.codigo) ? e.codigo : "OTRO") as ErrorTaller["codigo"], e.message);
    throw e;
  }
}

function revisarCupo(b: BaseDemo, fecha: string, franja: Franja, forzar?: boolean, excluir?: string) {
  if (!forzar && !cupoFranja(b, fecha, franja, excluir).libre) throw new ErrorTaller("CUPO_LLENO", "Esa franja está llena o cerrada.");
}

export const apiTallerDemo: ApiTaller = {
  usuariosDemo: USUARIOS,
  async sesionActual() {
    const id = sesion.leer();
    actual = USUARIOS.find((u) => u.id === id) ?? null;
    return actual;
  },
  async iniciarSesion(correo) {
    await espera(300);
    const u = USUARIOS.find((x) => x.id === correo || x.correo === correo.trim().toLowerCase());
    if (!u) throw new ErrorTaller("CREDENCIALES", "En la demo elige uno de los usuarios de ejemplo.");
    actual = u;
    sesion.guardar(u.id);
    return u;
  },
  async cerrarSesion() { actual = null; sesion.guardar(null); },

  async solicitudes() {
    await espera();
    const b = db.cargar();
    return b.solicitudes.map((s) => aSolicitud(b, s.id));
  },
  async detalle(id) {
    await espera();
    const b = db.cargar();
    const base = aSolicitud(b, id);
    const s = b.solicitudes.find((x) => x.id === id)!;
    const c = b.clientes.find((x) => x.id === s.clienteId)!;
    const v = b.vehiculos.find((x) => x.id === s.vehiculoId)!;
    mutar((bb) => bb.auditoria.push({ usuario: yo().id, accion: "ver", registro: c.id, fecha: new Date().toISOString() }));
    const d: DetalleSolicitud = {
      ...base,
      cliente: { id: c.id, tipoDocumento: c.tipoDocumento, numeroDocumento: c.numeroDocumento, digitoVerificacion: null, nombre: c.nombre, celular: c.celular, correo: c.correo ?? null, direccion: c.direccion ?? null, verificado: false },
      vehiculo: { ...base.vehiculo, vin: null, combustible: v.combustible || null, tarjeta: null },
      datosReportados: (s.datosReportados as DetalleSolicitud["datosReportados"]) ?? {},
      kmReportado: null,
      cambios: b.cambios.filter((x) => x.solicitudId === id).map((x) => ({ ...x, usuario: USUARIOS.find((u) => u.id === x.usuario)?.nombre ?? null })),
    };
    return d;
  },
  alCambiar(cb) {
    const local = (e: Event) => cb((e as CustomEvent).detail ?? { tipo: "cambio" });
    const otraPestana = (e: StorageEvent) => {
      if (e.key !== CLAVE_DB || !e.newValue || !e.oldValue) return;
      const nuevas = (JSON.parse(e.newValue) as BaseDemo).solicitudes.length - (JSON.parse(e.oldValue) as BaseDemo).solicitudes.length;
      cb(nuevas > 0 ? { tipo: "nueva", codigo: (JSON.parse(e.newValue) as BaseDemo).solicitudes.at(-1)?.codigo } : { tipo: "cambio" });
    };
    window.addEventListener("psr-demo-cambio", local);
    window.addEventListener("storage", otraPestana);
    return () => { window.removeEventListener("psr-demo-cambio", local); window.removeEventListener("storage", otraPestana); };
  },
  async urlArchivo(ruta) { return urlAdjuntoDemo(ruta); },
  async cambiarSemaforo(id, color: Color, motivo) {
    if (motivo.trim().length < 5) throw new ErrorTaller("MOTIVO_OBLIGATORIO", "Escribe el motivo del cambio (mínimo 5 letras).");
    const u = yo();
    mutar((b) => {
      const t = b.triage.find((x) => x.solicitudId === id)!;
      b.cambios.push({ solicitudId: id, de: t.final, a: color, motivo: motivo.trim(), usuario: u.id, fecha: new Date().toISOString() });
      t.final = color; t.motivoCambio = motivo.trim();
    });
  },
  async marcarSolicitud(id, estado) { yo(); mutar((b) => { b.solicitudes.find((x) => x.id === id)!.estado = estado; }); },

  async cupos(desde, hasta) {
    const b = db.cargar();
    const out = [];
    for (let f = desde; f <= hasta; f = sumarDias(f, 1))
      for (const franja of ["manana", "tarde"] as Franja[]) { const c = cupoFranja(b, f, franja); out.push({ fecha: f, franja, cupos: c.cupos, usados: c.usados, motivo: c.motivo }); }
    return out;
  },
  async citas(desde, hasta) {
    const b = db.cargar();
    return b.citas.filter((c) => c.fecha >= desde && c.fecha <= hasta).map((c): CitaAgenda => {
      const s = aSolicitud(b, c.solicitudId);
      return { id: c.id, fecha: c.fecha, franja: c.franja, estado: c.estado, notas: c.notas ?? null, solicitudId: s.id, codigo: s.codigo, nombre: s.cliente.nombre, celular: s.cliente.celular, placa: s.vehiculo.placa, vehiculo: [s.vehiculo.marca, s.vehiculo.linea].filter(Boolean).join(" "), color: s.semaforo.final };
    });
  },
  async estadoCita(citaId, estado, nota) {
    const u = yo();
    mutar((b) => {
      const c = b.citas.find((x) => x.id === citaId)!;
      c.estado = estado;
      if (estado === "confirmada") c.confirmadaPor = u.id;
      if (nota) c.notas = nota;
      const s = b.solicitudes.find((x) => x.id === c.solicitudId)!;
      if (s.estado === "nueva") s.estado = "en_revision";
    });
  },
  async reprogramarCita(citaId, fecha, franja, forzar) {
    yo();
    const b = db.cargar();
    revisarCupo(b, fecha, franja, forzar, citaId);
    mutar((bb) => { const c = bb.citas.find((x) => x.id === citaId)!; c.fecha = fecha; c.franja = franja; c.estado = "reprogramada"; });
  },
  async crearCita(solicitudId, fecha, franja, forzar) {
    const u = yo();
    revisarCupo(db.cargar(), fecha, franja, forzar);
    mutar((b) => {
      b.citas.filter((c) => c.solicitudId === solicitudId && ["pendiente", "confirmada", "reprogramada"].includes(c.estado)).forEach((c) => { c.estado = "cancelada"; c.notas = "Reemplazada por una cita nueva"; });
      b.citas.push({ id: nuevoId(), solicitudId, fecha, franja, estado: "confirmada", confirmadaPor: u.id });
      const s = b.solicitudes.find((x) => x.id === solicitudId)!;
      if (s.estado === "nueva") s.estado = "en_revision";
    });
  },

  async configAgenda() {
    const b = db.cargar();
    const y = new Date().getFullYear();
    const { festivosColombia } = await import("../compartido/util/festivos");
    return { disponibilidad: b.disponibilidad, bloqueados: b.bloqueados, festivos: [...festivosColombia(y), ...festivosColombia(y + 1)] };
  },
  async guardarDisponibilidad(filas) {
    if (yo().rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador cambia horarios y cupos.");
    mutar((b) => { b.disponibilidad = filas; });
  },
  async bloquear(fecha, franja, motivo) {
    if (yo().rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador bloquea días.");
    mutar((b) => { b.bloqueados.push({ id: nuevoId(), fecha, franja, motivo: motivo || null }); });
  },
  async desbloquear(id) {
    if (yo().rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador desbloquea días.");
    mutar((b) => { b.bloqueados = b.bloqueados.filter((x) => x.id !== id); });
  },
  async plantillas() { return { ...PLANTILLAS_BASE, ...(db.cargar().plantillas ?? {}) } as Plantillas; },
  async guardarPlantillas(p) {
    if (yo().rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador edita las plantillas.");
    mutar((b) => { b.plantillas = p; });
  },

  presencia(u, cb) {
    const estados = new Map<string, EstadoPresencia & { t: number }>();
    let viendo: string | null = null;
    const canal = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("psr-presencia") : null;
    const emitir = () => cb([...estados.values()].filter((e) => e.usuarioId !== u.id && Date.now() - e.t < 15000));
    const anunciar = () => canal?.postMessage({ usuarioId: u.id, nombre: u.nombre, viendo, t: Date.now() });
    if (canal) canal.onmessage = (e) => { estados.set(e.data.usuarioId, e.data); emitir(); };
    const latido = window.setInterval(() => { anunciar(); emitir(); }, 5000);
    anunciar();
    return {
      ver(id) { viendo = id; anunciar(); },
      salir() { viendo = null; anunciar(); window.clearInterval(latido); canal?.close(); },
    };
  },

  // ---------- Fase 3 ----------
  async precargaDesdeSolicitud(solicitudId) {
    const b = db.cargar();
    const s = b.solicitudes.find((x) => x.id === solicitudId)!;
    return precarga(b, s.vehiculoId, s.id);
  },
  async buscarVehiculo(placa) {
    const b = db.cargar();
    const v = b.vehiculos.find((x) => x.placa === placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    if (!v) return null;
    const s = [...b.solicitudes].reverse().find((x) => x.vehiculoId === v.id && (x.estado === "nueva" || x.estado === "en_revision"));
    return precarga(b, v.id, s?.id ?? null);
  },
  async subirArchivoActa(actaId, archivo, nombre) {
    await espera(250);
    const ruta = `actas/${actaId}/${nuevoId()}-${nombre}`;
    guardarArchivoDemo(ruta, archivo);
    return ruta;
  },
  async crearRecepcion(r) {
    const u = yo();
    const b = db.cargar();
    const res = demoOError(() => crearRecepcionDemo(b, { ...r, recibidoPor: u.id }, { vehiculo: r.vehiculo, cliente: r.cliente }));
    db.guardar(b); avisar();
    return res;
  },
  async acta(recepcionId) {
    const b = db.cargar();
    const a = b.recepciones.find((x) => x.id === recepcionId)!;
    const p = precarga(b, a.vehiculoId, a.solicitudId);
    const o = b.ordenes.find((x) => x.recepcionId === a.id);
    const acta: Acta = { ...a, ordenId: o?.id ?? null, recibidoPor: USUARIOS.find((x) => x.id === a.recibidoPor)?.nombre ?? null, codigo: p.codigo, vehiculo: p.vehiculo, cliente: p.cliente };
    return acta;
  },
  async ordenes() {
    await espera();
    const b = db.cargar();
    const limite = new Date(Date.now() - 14 * 86400000).toISOString();
    return b.ordenes.filter((o) => (o.estado !== "entregado" && o.estado !== "cancelado") || (o.fechaEntrega ?? o.creadoEn) > limite).map((o): OrdenTaller => {
      const r = b.recepciones.find((x) => x.id === o.recepcionId)!;
      const v = b.vehiculos.find((x) => x.id === r.vehiculoId)!;
      const c = b.clientes.find((x) => x.id === v.clienteId)!;
      const s = b.solicitudes.find((x) => x.id === r.solicitudId);
      const t = USUARIOS.find((x) => x.id === o.tecnicoId);
      return {
        id: o.id, estado: o.estado, creadoEn: o.creadoEn, codigo: s?.codigo ?? null, solicitudId: s?.id ?? null, recepcionId: r.id,
        vehiculo: { id: v.id, placa: v.placa, marca: v.marca, linea: v.linea }, cliente: { nombre: c.nombre, celular: c.celular },
        tecnico: t ? { id: t.id, nombre: t.nombre } : null, trabajos: o.trabajos,
        presupuesto: { total: o.presupuestoTotal, estado: o.presupuestoEstado, enviadoEn: o.presupuestoEnviadoEn, aprobadoPor: o.presupuestoAprobadoPor },
        autorizaPresupuestoPrevio: r.autorizaPresupuestoPrevio, autorizaPruebaRuta: r.autorizaPruebaRuta, kmIngreso: r.kmIngreso,
        kmSalida: o.kmSalida, garantiaHasta: o.garantiaHasta, fechaEntrega: o.fechaEntrega,
        nivelCombustibleIngreso: r.nivelCombustible, nivelCombustibleSalida: o.nivelCombustibleSalida ?? null,
        color: s ? b.triage.find((x) => x.solicitudId === s.id)?.final ?? null : null,
      };
    });
  },
  async historialOrden(ordenId) {
    const b = db.cargar();
    return b.historial.filter((h) => h.ordenId === ordenId).map((h) => ({ ...h, usuario: USUARIOS.find((u) => u.id === h.usuario)?.nombre ?? (h.usuario ? h.usuario : "Cliente (portal)") }));
  },
  async cambiarEstadoOrden(ordenId, estado, datos = {}) {
    const u = yo();
    const b = db.cargar();
    demoOError(() => cambiarEstadoDemo(b, ordenId, estado, datos, { id: u.id, esAdmin: u.rol === "admin" }));
    db.guardar(b); avisar();
  },
  async guardarTrabajos(ordenId, trabajos) { yo(); mutar((b) => { b.ordenes.find((o) => o.id === ordenId)!.trabajos = trabajos; }); },
  async asignarTecnico(ordenId, tecnicoId) { yo(); mutar((b) => { b.ordenes.find((o) => o.id === ordenId)!.tecnicoId = tecnicoId; }); },
  async enviarPresupuesto(ordenId, total, trabajos) {
    const u = yo();
    const b = db.cargar();
    demoOError(() => enviarPresupuestoDemo(b, ordenId, total, trabajos, u.id));
    db.guardar(b); avisar();
  },
  async registrarRespuestaPresupuesto(ordenId, decision, nota) {
    const u = yo();
    if (nota.trim().length < 5) throw new ErrorTaller("OTRO", "Escribe cómo te respondió el cliente (mínimo 5 letras).");
    const b = db.cargar();
    if (!responderPresupuestoDemo(b, ordenId, decision, "taller: " + nota.trim(), u.id)) throw new ErrorTaller("OTRO", "No hay un presupuesto pendiente en esta orden.");
    db.guardar(b); avisar();
  },
  async tecnicos() { return USUARIOS; },
  async planes() { return db.cargar().planes.filter((p) => p.activo !== false); },

  // ---------- Fase 4 ----------
  async clientes() {
    await espera();
    const b = db.cargar();
    return b.clientes.map((c) => ({
      id: c.id, nombre: c.nombre, tipoDocumento: c.tipoDocumento, numeroDocumento: c.numeroDocumento, celular: c.celular, correo: c.correo ?? null,
      origen: c.origen ?? "portal", autorizaDatos: c.autorizaDatos !== false, anonimizado: !!c.anonimizadoEn, creadoEn: c.creadoEn ?? "",
      placas: b.vehiculos.filter((v) => v.clienteId === c.id).map((v) => v.placa),
    })).sort((a, c) => a.nombre.localeCompare(c.nombre, "es"));
  },
  async fichaCliente(id) {
    const u = yo();
    mutar((b) => b.auditoria.push({ usuario: u.id, accion: "ver", registro: id, fecha: new Date().toISOString() }));
    return fichaDemo(db.cargar(), id);
  },
  async actualizarCliente(id, c) {
    yo();
    mutar((b) => {
      const x = b.clientes.find((y) => y.id === id)!;
      if (c.celular !== undefined) x.celular = c.celular.replace(/\D/g, "");
      if (c.correo !== undefined) x.correo = c.correo || undefined;
      if (c.direccion !== undefined) x.direccion = c.direccion || undefined;
      if (c.aceptaRecordatorios !== undefined) x.aceptaRecordatorios = c.aceptaRecordatorios;
    });
  },
  async actualizarVehiculo(id, v) {
    yo();
    mutar((b) => {
      const x = b.vehiculos.find((y) => y.id === id)!;
      if (v.fechaSoat !== undefined) x.fechaSoat = v.fechaSoat || null;
      if (v.fechaTecnomecanica !== undefined) x.fechaTecnomecanica = v.fechaTecnomecanica || null;
      sincronizarVencimientos(b, x);
    });
  },
  async anonimizarCliente(id, motivo) {
    const u = yo();
    if (u.rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador puede suprimir datos.");
    if (motivo.trim().length < 5) throw new ErrorTaller("MOTIVO_OBLIGATORIO", "Escribe el motivo (mínimo 5 letras).");
    mutar((b) => { anonimizarDemo(b, id); b.auditoria.push({ usuario: u.id, accion: "anonimizar", registro: id, fecha: new Date().toISOString() }); });
  },
  async registrarExportacion(filas, formato) {
    const u = yo();
    if (u.rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador exporta datos personales.");
    mutar((b) => b.auditoria.push({ usuario: u.id, accion: `exportar ${formato} (${filas})`, registro: "clientes", fecha: new Date().toISOString() }));
  },
  async importarClientes(filas) {
    const u = yo();
    if (u.rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador importa datos.");
    const b = db.cargar();
    const r = importarDemo(b, filas);
    b.auditoria.push({ usuario: u.id, accion: "importar", registro: String(r.filas), fecha: new Date().toISOString() });
    db.guardar(b); avisar();
    return r;
  },
  async recordatorios(dias) { yo(); await espera(); return recordatoriosProximos(db.cargar(), dias); },
  async marcarRecordatorio(id, estado) { yo(); mutar((b) => marcarRecordatorioDemo(b, id, estado)); },
  async indicadorRecordatorios(dias) { return indicadorDemo(db.cargar(), dias); },
  async guardarPlan(p) {
    if (yo().rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador edita los planes.");
    mutar((b) => { const i = b.planes.findIndex((x) => x.id === p.id); b.planes[i] = { ...b.planes[i], ...p }; });
  },
  async crearPlan(p) {
    if (yo().rol !== "admin") throw new ErrorTaller("NO_AUTORIZADO", "Solo el administrador edita los planes.");
    mutar((b) => { b.planes.push({ ...p, id: Math.max(0, ...b.planes.map((x) => x.id)) + 1, activo: true }); });
  },

  // ---------- Fase 5 ----------
  async guardarConfigPublica(d) { soloAdmin(); mutar((b) => { b.configPublica = { ...(b.configPublica ?? {}), ...d }; }); },
  async usuarios() { soloAdmin(); return USUARIOS.map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, especialidad: null, activo: !inactivos.has(u.id), correo: u.correo ?? null })); },
  async agregarUsuario() { soloAdmin(); throw new ErrorTaller("USUARIO_NO_EXISTE", "En la demo los usuarios son fijos. Con Supabase: crea la cuenta en Authentication y agrégala aquí con su correo."); },
  async actualizarUsuario(id, rol, activo) {
    soloAdmin();
    const otrosAdmin = USUARIOS.filter((u) => u.id !== id && u.rol === "admin" && !inactivos.has(u.id));
    if ((rol !== "admin" || !activo) && !otrosAdmin.length) throw new ErrorTaller("ULTIMO_ADMIN", "Debe quedar al menos un administrador activo.");
    const u = USUARIOS.find((x) => x.id === id)!; u.rol = rol;
    if (activo) inactivos.delete(id); else inactivos.add(id);
  },
  async reglas() { return db.cargar().reglas ?? listaDesdeReglas(); },
  async guardarRegla(r) { soloAdmin(); mutar((b) => { b.reglas = (b.reglas ?? listaDesdeReglas()).map((x) => (x.id === r.id ? r : x)); }); },
  async crearRegla(r) {
    soloAdmin();
    mutar((b) => { const l = b.reglas ?? listaDesdeReglas(); b.reglas = [...l, { ...r, valor: r.valor.trim().toLowerCase(), id: Math.max(0, ...l.map((x) => x.id)) + 1, activo: true }]; });
  },
  async probarSemaforo(e) { soloAdmin(); return clasificar(e, reglasDesdeLista(db.cargar().reglas ?? listaDesdeReglas())); },
  async catalogoAdmin() { const c = db.cargar().catalogo!; return { zonas: c.zonas.map((z) => ({ ...z })), sintomas: c.sintomas.map((s) => ({ ...s })) }; },
  async guardarSintoma(x) { soloAdmin(); mutar((b) => { b.catalogo!.sintomas = b.catalogo!.sintomas.map((s) => (s.id === x.id ? { ...s, ...x, etiqueta: x.etiqueta.trim() } : s)); }); },
  async crearSintoma(x, color) {
    soloAdmin();
    const id = `${x.zona}.${x.etiqueta.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30)}`;
    mutar((b) => {
      if (b.catalogo!.sintomas.some((s) => s.id === id)) throw new ErrorTaller("OTRO", "Ya existe un síntoma igual en esa zona.");
      b.catalogo!.sintomas.push({ id, zona: x.zona, etiqueta: x.etiqueta.trim(), orden: 900, activo: true });
      const l = b.reglas ?? listaDesdeReglas(); b.reglas = [...l, { id: Math.max(0, ...l.map((r) => r.id)) + 1, tipo: "sintoma", valor: id, zona: null, color, activo: true }];
    });
  },
  async altaRapida(d) {
    yo();
    if (!d.autorizaDatos) throw new ErrorTaller("OTRO", "Falta la autorización de datos del cliente.");
    const b = db.cargar();
    const doc = d.numeroDocumento.replace(/\D/g, ""), placa = d.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (doc.length < 4 || d.nombre.trim().length < 2 || d.celular.replace(/\D/g, "").length < 7 || placa.length < 3 || !d.marca.trim()) throw new ErrorTaller("OTRO", "Revisa los datos obligatorios.");
    let c = b.clientes.find((x) => x.tipoDocumento === d.tipoDocumento && x.numeroDocumento === doc);
    if (!c) { c = { id: nuevoId(), tipoDocumento: d.tipoDocumento, numeroDocumento: doc, nombre: d.nombre.trim(), celular: d.celular.replace(/\D/g, ""), correo: d.correo || undefined, origen: "taller", autorizaDatos: true, creadoEn: new Date().toISOString() }; b.clientes.push(c); }
    else c.autorizaDatos = true;
    let v = b.vehiculos.find((x) => x.placa === placa);
    if (v && v.clienteId !== c.id) throw new ErrorTaller("OTRO", "Esa placa está registrada a nombre de otro cliente. Búscala por placa.");
    if (!v) { v = { id: nuevoId(), clienteId: c.id, placa, marca: d.marca.trim(), linea: d.linea?.trim() || "", anio: d.anio ? Number(d.anio) || null : null, color: "", combustible: "", km: null }; b.vehiculos.push(v); }
    const s = { id: nuevoId(), codigo: codigoSeguimiento(), clienteId: c.id, vehiculoId: v.id, zonas: ["nose"], sintomas: [], descripcion: d.motivo?.trim() ?? "", movilidad: "si", adjuntos: [], presupuesto: "previo", pruebaRuta: false, estado: "en_revision", canal: "taller", creadoEn: new Date().toISOString() };
    b.solicitudes.push(s);
    b.triage.push({ solicitudId: s.id, auto: "verde", final: "verde", razones: ["Alta en el taller"] });
    db.guardar(b); avisar();
    return s.id;
  },
};
