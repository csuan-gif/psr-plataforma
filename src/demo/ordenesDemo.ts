/**
 * Recepción, órdenes y presupuestos del MODO DEMO. Replica las reglas de
 * supabase/migrations/..._recepcion_ordenes.sql usando src/taller/util/reglasOrden.ts.
 */
import type { BaseDemo } from "./apiDemo";
import { nuevoId } from "../compartido/util/almacen";
import { hoyBogota } from "../compartido/util/fechas";
import { ESTADOS_ORDEN, revisarTransicion, notaPrueba, type DatosTransicion, type EstadoOrden, type EstadoPresupuesto, type Trabajo } from "../taller/util/reglasOrden";
import type { Dano, FotoActa, ItemChecklist, PlanMantenimiento } from "../taller/datos/tipos";
import type { EstadoPublico } from "../compartido/datos/tipos";
import { nuevoRecordatorio } from "./mantenimientoDemo";

export interface ActaDemo {
  id: string; solicitudId: string | null; vehiculoId: string; fechaHora: string; kmIngreso: number; nivelCombustible: number;
  checklist: Record<string, ItemChecklist>; mapaDanos: Dano[]; objetosPersonales: string; accesorios: string; fotos: FotoActa[];
  videoInspeccion: string | null; autorizaPresupuestoPrevio: boolean; autorizaPruebaRuta: boolean; observaciones: string;
  firmaCliente: string; firmadoPor: string; recibidoPor: string | null;
}
export interface OrdenDemo {
  id: string; recepcionId: string; estado: EstadoOrden; tecnicoId: string | null; trabajos: Trabajo[];
  presupuestoTotal: number | null; presupuestoEstado: EstadoPresupuesto; presupuestoEnviadoEn: string | null; presupuestoAprobadoPor: string | null;
  fechaEntrega: string | null; kmSalida: number | null; nivelCombustibleSalida?: number | null; garantiaHasta: string | null; creadoEn: string;
}
export interface HistorialDemo { ordenId: string; estado: string; fecha: string; usuario: string | null; nota: string | null }
export interface RecordatorioDemo {
  id: string; token: string; vehiculoId: string; servicio: string; tipo: "mantenimiento" | "soat" | "tecnomecanica";
  fechaEstimada: string | null; kmEstimado: number | null; estado: "pendiente" | "enviado" | "agendado" | "descartado"; creadoEn: string;
  enviadoEn: string | null; agendadoEn: string | null; solicitudId: string | null;
}

export class ErrorOrden extends Error { constructor(public codigo: string, m?: string) { super(m ?? codigo); } }

// Mismos planes de referencia que supabase/seed.sql (EDITAR según el taller).
export const PLANES_DEMO: PlanMantenimiento[] = [
  ["Cambio de aceite y filtro (aceite mineral)", 5000, 6, "todos"], ["Cambio de aceite y filtro (aceite sintético)", 10000, 12, "todos"],
  ["Filtro de aire", 10000, 12, "todos"], ["Filtro de combustible", 20000, 24, "gasolina"], ["Filtro de combustible (diésel)", 10000, 12, "diesel"],
  ["Filtro de cabina (polen)", 15000, 12, "todos"], ["Revisión de frenos", 10000, 12, "todos"], ["Cambio de líquido de frenos", 40000, 24, "todos"],
  ["Cambio de refrigerante", 40000, 24, "todos"], ["Alineación y balanceo", 10000, 12, "todos"], ["Rotación de llantas", 10000, 12, "todos"],
  ["Bujías", 30000, 36, "gasolina"], ["Correa de accesorios", 40000, 48, "todos"], ["Correa de repartición (distribución)", 60000, 60, "todos"],
  ["Revisión de batería", null, 24, "todos"], ["Sincronización", 20000, 12, "gasolina"], ["Escáner preventivo", 10000, 12, "todos"],
].map(([servicio, km, meses, aplica], i) => ({ id: i + 1, servicio: servicio as string, intervaloKm: km as number | null, intervaloMeses: meses as number, aplicaA: aplica as string }));

const ABIERTA = (o: OrdenDemo) => o.estado !== "entregado" && o.estado !== "cancelado";
export const vehiculoDeOrden = (b: BaseDemo, o: OrdenDemo) => b.recepciones.find((r) => r.id === o.recepcionId)!.vehiculoId;
export const ordenAbierta = (b: BaseDemo, vehiculoId: string) => b.ordenes.some((o) => ABIERTA(o) && vehiculoDeOrden(b, o) === vehiculoId);

export function crearRecepcionDemo(b: BaseDemo, a: Omit<ActaDemo, "id" | "fechaHora">, ext: { vehiculo: { color?: string; vin?: string; combustible?: string }; cliente: { correo?: string; direccion?: string } }) {
  if (ordenAbierta(b, a.vehiculoId)) throw new ErrorOrden("ORDEN_ABIERTA", "Este vehículo ya tiene una orden abierta.");
  const faltan = ["frente", "lateral_izq", "lateral_der", "tablero"].filter((t) => !a.fotos.some((f) => f.tipo === t && f.ruta));
  if (faltan.length) throw new ErrorOrden("FALTAN_FOTOS", "Faltan fotos obligatorias: " + faltan.join(", "));
  if (a.kmIngreso < 0 || a.nivelCombustible < 0 || a.nivelCombustible > 1 || Math.round(a.nivelCombustible * 8) !== a.nivelCombustible * 8 || !a.firmaCliente || a.firmadoPor.trim().length < 3)
    throw new ErrorOrden("DATOS_INVALIDOS", "Revisa el kilometraje, el combustible y la firma.");
  const acta: ActaDemo = { ...a, id: nuevoId(), fechaHora: new Date().toISOString() };
  b.recepciones.push(acta);
  const v = b.vehiculos.find((x) => x.id === a.vehiculoId)!;
  v.km = a.kmIngreso; if (ext.vehiculo.color) v.color = ext.vehiculo.color;
  if (ext.vehiculo.combustible) v.combustible = ext.vehiculo.combustible;
  if (ext.vehiculo.vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(ext.vehiculo.vin)) v.vin = ext.vehiculo.vin;
  const c = b.clientes.find((x) => x.id === v.clienteId)!;
  if (ext.cliente.correo) c.correo = ext.cliente.correo;
  if (ext.cliente.direccion) c.direccion = ext.cliente.direccion;
  const o: OrdenDemo = {
    id: nuevoId(), recepcionId: acta.id, estado: "recibido", tecnicoId: null, trabajos: [], presupuestoTotal: null,
    presupuestoEstado: a.autorizaPresupuestoPrevio ? "pendiente" : "no_requerido", presupuestoEnviadoEn: null, presupuestoAprobadoPor: null,
    fechaEntrega: null, kmSalida: null, garantiaHasta: null, creadoEn: acta.fechaHora,
  };
  b.ordenes.push(o);
  b.historial.push({ ordenId: o.id, estado: "recibido", fecha: acta.fechaHora, usuario: a.recibidoPor, nota: "Vehículo recibido con acta firmada" });
  if (a.solicitudId) b.solicitudes.find((s) => s.id === a.solicitudId)!.estado = "convertida";
  return { recepcionId: acta.id, ordenId: o.id, codigo: b.solicitudes.find((s) => s.id === a.solicitudId)?.codigo ?? null };
}

export function cambiarEstadoDemo(b: BaseDemo, ordenId: string, destino: EstadoOrden, d: DatosTransicion, u: { id: string; esAdmin: boolean }) {
  const o = b.ordenes.find((x) => x.id === ordenId)!;
  const r = b.recepciones.find((x) => x.id === o.recepcionId)!;
  if (destino === o.estado) return;
  const bloqueo = revisarTransicion({ estado: o.estado, presupuestoEstado: o.presupuestoEstado, autorizaPresupuestoPrevio: r.autorizaPresupuestoPrevio, autorizaPruebaRuta: r.autorizaPruebaRuta, kmIngreso: r.kmIngreso, trabajos: o.trabajos }, destino, d, { esAdmin: u.esAdmin, hoy: hoyBogota() });
  if (bloqueo) throw new ErrorOrden(bloqueo.codigo, bloqueo.mensaje);
  let nota = d.nota ?? null;
  if (destino === "en_prueba" && !r.autorizaPruebaRuta) nota = notaPrueba(d) ?? null;
  const ahora = new Date().toISOString();
  if (destino === "entregado") {
    o.kmSalida = d.kmSalida!; o.nivelCombustibleSalida = d.nivelCombustibleSalida!; o.garantiaHasta = d.garantiaHasta!; o.trabajos = d.trabajos ?? o.trabajos; o.fechaEntrega = ahora;
    b.vehiculos.find((v) => v.id === r.vehiculoId)!.km = d.kmSalida!;
  }
  o.estado = destino;
  b.historial.push({ ordenId, estado: destino, fecha: ahora, usuario: u.id, nota });
  if (destino === "entregado") generarRecordatoriosDemo(b, o, r.vehiculoId);
}

export function generarRecordatoriosDemo(b: BaseDemo, o: OrdenDemo, vehiculoId: string) {
  for (const t of o.trabajos) {
    const pl = b.planes.find((p) => p.id === t.planId && p.activo !== false);
    if (!pl) continue;
    b.recordatorios.filter((x) => x.vehiculoId === vehiculoId && x.servicio === pl.servicio && x.estado === "pendiente").forEach((x) => (x.estado = "descartado"));
    const f = new Date(o.fechaEntrega!);
    if (pl.intervaloMeses) f.setMonth(f.getMonth() + pl.intervaloMeses);
    b.recordatorios.push(nuevoRecordatorio(vehiculoId, pl.servicio, "mantenimiento", pl.intervaloMeses ? f.toISOString().slice(0, 10) : null, pl.intervaloKm ? (o.kmSalida ?? 0) + pl.intervaloKm : null));
  }
}

export function enviarPresupuestoDemo(b: BaseDemo, ordenId: string, total: number, trabajos: Trabajo[], usuario: string) {
  const o = b.ordenes.find((x) => x.id === ordenId)!;
  if (!ABIERTA(o)) throw new ErrorOrden("ORDEN_CERRADA");
  if (!(total > 0) || !trabajos.length) throw new ErrorOrden("DATOS_INVALIDOS", "Escribe el total y al menos un trabajo.");
  Object.assign(o, { presupuestoTotal: total, trabajos, presupuestoEstado: "pendiente", presupuestoEnviadoEn: new Date().toISOString(), presupuestoAprobadoPor: null, estado: "esperando_aprobacion" });
  b.historial.push({ ordenId, estado: "esperando_aprobacion", fecha: new Date().toISOString(), usuario, nota: "Presupuesto enviado al cliente" });
}

export function responderPresupuestoDemo(b: BaseDemo, ordenId: string, decision: "aprobado" | "rechazado", por: string, usuario: string | null) {
  const o = b.ordenes.find((x) => x.id === ordenId);
  if (!o || o.presupuestoEstado !== "pendiente" || !o.presupuestoEnviadoEn) return false;
  o.presupuestoEstado = decision; o.presupuestoAprobadoPor = por;
  b.historial.push({ ordenId, estado: o.estado, fecha: new Date().toISOString(), usuario,
    nota: por === "cliente_portal" ? `El cliente ${decision === "aprobado" ? "APROBÓ" : "RECHAZÓ"} el presupuesto desde el portal` : `Presupuesto ${decision} (${por.replace(/^taller: /, "")})` });
  return true;
}

export const ordenDeSolicitud = (b: BaseDemo, solicitudId: string) => {
  const actas = b.recepciones.filter((r) => r.solicitudId === solicitudId).map((r) => r.id);
  return b.ordenes.filter((o) => actas.includes(o.recepcionId)).at(-1) ?? null;
};

const NOMBRES = ["Vehículo recibido", "En diagnóstico", "Esperando tu aprobación", "En reparación", "En prueba", "Listo para entregar", "Entregado"];
/** Pasos de la orden para la consulta del cliente (igual que public.consultar_estado). */
export function pasosOrden(b: BaseDemo, o: OrdenDemo | null): EstadoPublico["pasos"] {
  const idx = o ? ESTADOS_ORDEN.indexOf(o.estado as (typeof ESTADOS_ORDEN)[number]) + 1 : 0;
  return ESTADOS_ORDEN.map((e, i) => ({
    clave: e, nombre: NOMBRES[i],
    fecha: o ? b.historial.filter((h) => h.ordenId === o.id && h.estado === e).map((h) => h.fecha).sort()[0] ?? null : null,
    hecho: !!o && o.estado !== "cancelado" && idx >= i + 1,
    nota: e === "esperando_aprobacion" && o?.presupuestoEstado === "no_requerido" ? "No requerida: autorizaste reparar sin presupuesto previo" : null,
  }));
}

/** Órdenes de ejemplo para que el tablero no arranque vacío. */
export function sembrarOrdenes(b: BaseDemo) {
  const fotos: FotoActa[] = ["frente", "lateral_izq", "lateral_der", "tablero"].map((t) => ({ tipo: t as FotoActa["tipo"], ruta: `actas/demo/${t}.jpg` }));
  const base = { checklist: {}, mapaDanos: [], objetosPersonales: "", accesorios: "Gato y cruceta", fotos, videoInspeccion: null, observaciones: "", firmaCliente: "actas/demo/firma.png", recibidoPor: "u-javier" };
  const s1 = b.solicitudes.find((s) => s.codigo === "PSR-DEMO01")!, s5 = b.solicitudes.find((s) => s.codigo === "PSR-DEMO05")!;
  const r1 = crearRecepcionDemo(b, { ...base, solicitudId: s1.id, vehiculoId: s1.vehiculoId, kmIngreso: 68350, nivelCombustible: 0.5, autorizaPresupuestoPrevio: false, autorizaPruebaRuta: true, firmadoPor: "Andrés Camacho" }, { vehiculo: {}, cliente: {} });
  cambiarEstadoDemo(b, r1.ordenId, "en_diagnostico", {}, { id: "u-mecanico", esAdmin: false });
  cambiarEstadoDemo(b, r1.ordenId, "en_reparacion", {}, { id: "u-mecanico", esAdmin: false });
  const o1 = b.ordenes.find((o) => o.id === r1.ordenId)!;
  o1.tecnicoId = "u-mecanico";
  o1.trabajos = [{ descripcion: "Cambio de aceite y filtro", tipo: "preventivo", planId: 2 }, { descripcion: "Cambio de filtro de aire", tipo: "preventivo", planId: 3 }];
  const r5 = crearRecepcionDemo(b, { ...base, solicitudId: s5.id, vehiculoId: s5.vehiculoId, kmIngreso: 120400, nivelCombustible: 0.25, autorizaPresupuestoPrevio: true, autorizaPruebaRuta: false, firmadoPor: "Transportes Ejemplo" }, { vehiculo: {}, cliente: {} });
  cambiarEstadoDemo(b, r5.ordenId, "en_diagnostico", {}, { id: "u-electrico", esAdmin: false });
  b.ordenes.find((o) => o.id === r5.ordenId)!.tecnicoId = "u-electrico";
  enviarPresupuestoDemo(b, r5.ordenId, 350000, [{ descripcion: "Diagnóstico con escáner del testigo del tablero", tipo: "diagnostico" }, { descripcion: "Cambio de sensor de oxígeno", tipo: "electrico", repuestos: "Sensor de oxígeno" }], "u-electrico");
}
