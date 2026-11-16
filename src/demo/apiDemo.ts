/**
 * API del MODO DEMO: sin Supabase, datos en memoria + localStorage, con los
 * casos C1 a C10 y 5 clientes ficticios precargados. Solo para presentaciones.
 */
import catalogoJson from "../compartido/catalogo/sintomas.json";
import casos from "../../tests/casos.json";
import { clasificar, listaDesdeReglas, reglasDesdeLista, type Color } from "./motorSemaforo";
import { PLANES_DEMO, ordenDeSolicitud, pasosOrden, responderPresupuestoDemo, sembrarOrdenes, type ActaDemo, type HistorialDemo, type OrdenDemo, type RecordatorioDemo } from "./ordenesDemo";
import { miMantenimientoDemo, nuevoRecordatorio, sincronizarVencimientos, vehiculoDeCliente } from "./mantenimientoDemo";
import type { PlanMantenimiento } from "../taller/datos/tipos";
import { almacen, codigoSeguimiento, nuevoId } from "../compartido/util/almacen";
import { festivosColombia } from "../compartido/util/festivos";
import { diaSemana, hoyBogota, sumarDias } from "../compartido/util/fechas";
import { limpiarPlaca, ultimos4 } from "../compartido/util/validaciones";
import type { DatosTaller, Franja } from "../compartido/config";
import {
  ErrorApi, type ApiCliente, type CupoDia, type ZonaCat, type SintomaCat, type EstadoPublico, type SolicitudNueva, type VehiculoPrecargado,
} from "../compartido/datos/tipos";

export const CLAVE_DB = "psr-demo-db-v5";
const CLAVE = CLAVE_DB;

export interface ClienteDemo {
  id: string; tipoDocumento: string; numeroDocumento: string; nombre: string; celular: string; correo?: string; direccion?: string;
  origen?: "portal" | "importado" | "taller"; autorizaDatos?: boolean; aceptaRecordatorios?: boolean; anonimizadoEn?: string | null; creadoEn?: string;
}
export interface VehiculoDemo { id: string; clienteId: string; placa: string; marca: string; linea: string; anio: number | null; color: string; combustible: string; km: number | null; vin?: string | null; kmFecha?: string | null; fechaSoat?: string | null; fechaTecnomecanica?: string | null }
export interface SolicitudDemo {
  id: string; codigo: string; clienteId: string; vehiculoId: string; zonas: string[]; sintomas: string[];
  descripcion: string; movilidad: string; desdeCuando?: string; adjuntos: SolicitudNueva["adjuntos"];
  presupuesto: string; pruebaRuta: boolean; estado: string; canal: string; creadoEn: string; datosReportados?: unknown;
}
/** Tabla separada, como en el servidor (triage_interno). */
export interface TriageDemo { solicitudId: string; auto: Color; final: Color; razones: string[]; motivoCambio?: string }
export interface CitaDemo { id: string; solicitudId: string; fecha: string; franja: Franja; estado: string; notas?: string | null; confirmadaPor?: string | null }
export interface FilaDispDemo { diaSemana: number; franja: Franja; horaInicio: string; horaFin: string; cupos: number; activo: boolean }
export interface CambioDemo { solicitudId: string; de: Color; a: Color; motivo: string; usuario: string; fecha: string }
export interface AuditoriaDemo { usuario: string | null; accion: string; registro: string; fecha: string }

export interface BaseDemo {
  clientes: ClienteDemo[]; vehiculos: VehiculoDemo[]; solicitudes: SolicitudDemo[];
  triage: TriageDemo[]; citas: CitaDemo[];
  disponibilidad: FilaDispDemo[]; // por día de la semana (0 = domingo) y franja
  bloqueados: { id: string; fecha: string; franja: Franja | null; motivo: string | null }[];
  cambios: CambioDemo[];
  auditoria: AuditoriaDemo[];
  plantillas: Record<string, string> | null;
  recepciones: ActaDemo[];
  ordenes: OrdenDemo[];
  historial: HistorialDemo[];
  recordatorios: RecordatorioDemo[];
  lecturas: { vehiculoId: string; km: number; fecha: string }[]; // historial de km previo (p. ej. importado de Excel)
  planes: (PlanMantenimiento & { activo?: boolean })[];
  configPublica?: Partial<DatosTaller> | null;
  reglas?: ReglaDemo[];
  catalogo?: { zonas: (ZonaCat & { orden: number; activo: boolean })[]; sintomas: (SintomaCat & { orden: number; activo: boolean })[] };
}
export type { FilaRegla as ReglaDemo } from "./motorSemaforo";
import type { FilaRegla as ReglaDemo } from "./motorSemaforo";

const CLIENTES_FICTICIOS: [string, string, string, string, string, string, number, string, string, number][] = [
  // nombre, cédula, celular, placa, marca, línea, año, color, combustible, km
  ["Andrés Camacho (ficticio)", "80123456", "3001112233", "JKL123", "Renault", "Sandero", 2018, "Gris", "gasolina", 68000],
  ["Luisa Pardo (ficticia)", "52987654", "3104445566", "MNP456", "Chevrolet", "Onix", 2021, "Blanco", "gasolina", 32000],
  ["Carlos Rincón (ficticio)", "79555111", "3157778899", "QRS789", "Mazda", "Mazda 3", 2016, "Rojo", "gasolina", 98000],
  ["Diana Torres (ficticia)", "1020304050", "3201234567", "TUV234", "Kia", "Picanto", 2019, "Plata", "gasolina", 54000],
  ["Transportes Ejemplo S.A.S. (ficticia)", "900373913", "3009876543", "WXY567", "Renault", "Duster", 2020, "Negro", "diesel", 120000],
];

function semilla(): BaseDemo {
  const clientes: ClienteDemo[] = [], vehiculos: VehiculoDemo[] = [];
  CLIENTES_FICTICIOS.forEach(([nombre, doc, cel, placa, marca, linea, anio, color, comb, km], i) => {
    const id = "cli-" + (i + 1);
    clientes.push({ id, tipoDocumento: i === 4 ? "NIT" : "CC", numeroDocumento: doc, nombre, celular: cel, correo: `cliente${i + 1}@ejemplo.com`, origen: "portal", autorizaDatos: true, creadoEn: new Date(Date.now() - 200 * 86400000).toISOString() });
    vehiculos.push({ id: "veh-" + (i + 1), clienteId: id, placa, marca, linea, anio, color, combustible: comb, km, kmFecha: sumarDias(hoyBogota(), -90) });
  });
  const hoy = hoyBogota();
  const solicitudes: SolicitudDemo[] = [], triage: TriageDemo[] = [], citas: CitaDemo[] = [];
  casos.casos.forEach((c, i) => {
    const v = vehiculos[i % 5];
    const id = "sol-" + c.id;
    solicitudes.push({
      id, codigo: "PSR-DEMO" + String(i + 1).padStart(2, "0"), clienteId: v.clienteId, vehiculoId: v.id,
      zonas: c.entrada.zonas, sintomas: c.entrada.sintomas, descripcion: c.texto, movilidad: c.entrada.movilidad,
      adjuntos: [], presupuesto: "previo", pruebaRuta: true, estado: "nueva", canal: "portal",
      creadoEn: new Date(Date.now() - (10 - i) * 37 * 60000).toISOString(),
    });
    const r = clasificar({ ...c.entrada, descripcion: c.texto });
    triage.push({ solicitudId: id, auto: r.color, final: r.color, razones: r.razones });
  });
  // Llena algunas franjas para que el calendario muestre días sin cupo.
  const manana = sumarDias(hoy, 2);
  for (let k = 0; k < 3; k++) citas.push({ id: nuevoId(), solicitudId: "sol-C" + (k + 1), fecha: manana, franja: "manana", estado: "confirmada" });
  const b: BaseDemo = {
    clientes, vehiculos, solicitudes, triage, citas, recepciones: [], ordenes: [], historial: [], recordatorios: [],
    // Lecturas de km de hace ~8 meses para que el promedio diario funcione en la demo.
    lecturas: vehiculos.map((v, i) => ({ vehiculoId: v.id, km: (v.km ?? 0) - [7200, 5400, 9600, 6000, 14400][i], fecha: sumarDias(hoyBogota(), -330) })),
    planes: PLANES_DEMO.map((p) => ({ ...p, activo: true })),
    disponibilidad: [1, 2, 3, 4, 5, 6].flatMap((d) => [
      { diaSemana: d, franja: "manana" as Franja, horaInicio: d === 6 ? "08:00" : "07:30", horaFin: d === 6 ? "13:00" : "12:00", cupos: d === 6 ? 2 : 3, activo: true },
      { diaSemana: d, franja: "tarde" as Franja, horaInicio: "13:00", horaFin: "17:00", cupos: d === 6 ? 0 : 3, activo: d !== 6 },
    ]),
    bloqueados: [{ id: "bloq-1", fecha: sumarDias(hoy, 9), franja: null, motivo: "Capacitación (ejemplo)" }],
    cambios: [], auditoria: [], plantillas: null,
  };
  b.reglas = listaDesdeReglas();
  b.catalogo = { zonas: catalogoJson.zonas.map((z, i) => ({ ...z, orden: i, activo: true })), sintomas: catalogoJson.sintomas.map((s, i) => ({ ...s, orden: i, activo: true })) };
  sembrarOrdenes(b);
  // Mantenimiento de ejemplo (igual que supabase/seed.sql)
  const v = (p: string) => b.vehiculos.find((x) => x.placa === p)!;
  v("JKL123").fechaSoat = sumarDias(hoy, 20); sincronizarVencimientos(b, v("JKL123"));
  v("MNP456").fechaTecnomecanica = sumarDias(hoy, 45); sincronizarVencimientos(b, v("MNP456"));
  b.recordatorios.push(nuevoRecordatorio(v("QRS789").id, "Cambio de aceite y filtro (aceite sintético)", "mantenimiento", sumarDias(hoy, 5), 100000));
  b.recordatorios.push(nuevoRecordatorio(v("TUV234").id, "Alineación y balanceo", "mantenimiento", sumarDias(hoy, 40), 62000));
  return b;
}

export const db = {
  cargar: (): BaseDemo => almacen.leer<BaseDemo | null>(CLAVE, null) ?? db.guardar(semilla()),
  guardar: (b: BaseDemo) => (almacen.guardar(CLAVE, b), b),
  reiniciar: () => db.guardar(semilla()),
};

export const OCUPAN = ["pendiente", "confirmada", "reprogramada"];
const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const archivosLocales = new Map<string, string>(); // ruta -> objectURL (no persiste)
export const urlAdjuntoDemo = (ruta: string) => archivosLocales.get(ruta) ?? null;
export const guardarArchivoDemo = (ruta: string, archivo: Blob) => { if (typeof URL !== "undefined" && URL.createObjectURL) archivosLocales.set(ruta, URL.createObjectURL(archivo)); };

export const festivoDe = (f: string) => festivosColombia(Number(f.slice(0, 4))).find((x) => x.fecha === f)?.nombre ?? null;
/** Cupo de una franja (misma regla que psr_privado.hay_cupo y cupos_taller). */
export function cupoFranja(b: BaseDemo, f: string, franja: Franja, excluir?: string) {
  const fila = b.disponibilidad.find((x) => x.diaSemana === diaSemana(f) && x.franja === franja);
  const cupos = fila?.activo ? fila.cupos : 0;
  const usados = b.citas.filter((c) => c.fecha === f && c.franja === franja && OCUPAN.includes(c.estado) && c.id !== excluir).length;
  const fes = festivoDe(f);
  const bl = b.bloqueados.find((x) => x.fecha === f && (x.franja === null || x.franja === franja));
  const motivo = fes ? "Festivo: " + fes : bl ? "Cerrado" + (bl.motivo ? ": " + bl.motivo : "") : null;
  return { cupos, usados, motivo, libre: !motivo && usados < cupos };
}

function cuposDe(b: BaseDemo, desde: string, hasta: string): CupoDia[] {
  const hoy = hoyBogota();
  const out: CupoDia[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const franjas = (["manana", "tarde"] as Franja[]).map((franja) => ({ franja, disponible: f > hoy && cupoFranja(b, f, franja).libre }));
    const m = cupoFranja(b, f, "manana").motivo;
    const motivo = f <= hoy ? "Desde mañana" : m?.startsWith("Festivo") ? "Festivo" : m ? "Cerrado" : franjas.every((x) => !x.disponible) ? "Sin cupo" : undefined;
    out.push({ fecha: f, franjas, motivo });
  }
  return out;
}

export const apiDemo: ApiCliente = {
  async catalogo() {
    const c = db.cargar().catalogo;
    if (!c) return { zonas: catalogoJson.zonas, sintomas: catalogoJson.sintomas };
    const orden = <T extends { orden: number }>(l: T[]) => [...l].sort((a, b) => a.orden - b.orden);
    return { zonas: orden(c.zonas.filter((z) => z.activo)).map(({ id, nombre, ayuda }) => ({ id, nombre, ayuda })), sintomas: orden(c.sintomas.filter((s) => s.activo)).map(({ id, zona, etiqueta }) => ({ id, zona, etiqueta })) };
  },
  async disponibilidad(desde, hasta) {
    await espera(150);
    return cuposDe(db.cargar(), desde, hasta);
  },
  async subirAdjunto(borradorId, archivo, nombre, onProgreso) {
    const ruta = `pendientes/${borradorId}/${nuevoId()}-${nombre}`;
    for (let p = 0; p <= 100; p += 20) { onProgreso?.(p); await espera(60); }
    if (typeof URL !== "undefined" && URL.createObjectURL) archivosLocales.set(ruta, URL.createObjectURL(archivo));
    return ruta;
  },
  async crearSolicitud(s) {
    await espera(400);
    if (s.website) return { codigo: codigoSeguimiento(), cita: null }; // honeypot: se descarta en silencio
    if (!s.autorizaciones.datos) throw new ErrorApi("DATOS_INVALIDOS", "Falta la autorización de datos.");
    const b = db.cargar();
    // Cliente existente: se vincula, pero NO se sobrescriben sus datos desde el portal.
    let cli = b.clientes.find((c) => c.tipoDocumento === s.cliente.tipoDocumento && c.numeroDocumento === s.cliente.numeroDocumento.replace(/\D/g, ""));
    if (!cli) {
      cli = { id: nuevoId(), tipoDocumento: s.cliente.tipoDocumento, numeroDocumento: s.cliente.numeroDocumento.replace(/\D/g, ""), nombre: s.cliente.nombre, celular: s.cliente.celular, correo: s.cliente.correo, direccion: s.cliente.direccion, origen: "portal", autorizaDatos: true, creadoEn: new Date().toISOString() };
      b.clientes.push(cli);
    }
    const placa = limpiarPlaca(s.vehiculo.placa);
    let veh = b.vehiculos.find((v) => v.placa === placa);
    if (!veh) {
      veh = { id: nuevoId(), clienteId: cli.id, placa, marca: s.vehiculo.marca, linea: s.vehiculo.linea, anio: s.vehiculo.anio ?? null, color: s.vehiculo.color ?? "", combustible: s.vehiculo.combustible ?? "", km: s.vehiculo.km ?? null };
      b.vehiculos.push(veh);
    }
    if (s.cita) {
      const dia = cuposDe(b, s.cita.fecha, s.cita.fecha)[0];
      if (!dia.franjas.find((f) => f.franja === s.cita!.franja)?.disponible)
        throw new ErrorApi("CUPO_LLENO", "Esa franja se acaba de llenar. Elige otra, por favor.");
    }
    const sol: SolicitudDemo = {
      id: nuevoId(), codigo: codigoSeguimiento(), clienteId: cli.id, vehiculoId: veh.id, zonas: s.zonas, sintomas: s.sintomas,
      descripcion: s.descripcion, movilidad: s.movilidad, desdeCuando: s.desdeCuando, adjuntos: s.adjuntos,
      presupuesto: s.autorizaciones.presupuesto, pruebaRuta: s.autorizaciones.pruebaRuta, estado: "nueva", canal: s.canal,
      creadoEn: new Date().toISOString(), datosReportados: { cliente: s.cliente, vehiculo: s.vehiculo },
    };
    b.solicitudes.push(sol);
    const r = clasificar({ zonas: s.zonas, sintomas: s.sintomas, descripcion: s.descripcion, movilidad: s.movilidad }, b.reglas ? reglasDesdeLista(b.reglas) : undefined);
    b.triage.push({ solicitudId: sol.id, auto: r.color, final: r.color, razones: r.razones });
    if (s.cita) b.citas.push({ id: nuevoId(), solicitudId: sol.id, fecha: s.cita.fecha, franja: s.cita.franja, estado: "pendiente" });
    db.guardar(b);
    window.dispatchEvent(new CustomEvent("psr-demo-cambio", { detail: { tipo: "nueva", codigo: sol.codigo } }));
    return { codigo: sol.codigo, cita: s.cita ? { ...s.cita, estado: "pendiente" } : null };
  },
  async precargarVehiculo(placa, doc4, cel4): Promise<VehiculoPrecargado | null> {
    await espera(300);
    const b = db.cargar();
    const v = b.vehiculos.find((x) => x.placa === limpiarPlaca(placa));
    const c = v && b.clientes.find((x) => x.id === v.clienteId);
    if (!v || !c || c.anonimizadoEn || ultimos4(c.numeroDocumento) !== doc4 || ultimos4(c.celular) !== cel4) return null;
    return { placa: v.placa, marca: v.marca, linea: v.linea, anio: v.anio, color: v.color, combustible: v.combustible, km: v.km };
  },
  async responderPresupuesto(codigo, doc4, decision) {
    await espera(300);
    const b = db.cargar();
    const s = b.solicitudes.find((x) => x.codigo === codigo.toUpperCase().trim());
    const c = s && b.clientes.find((x) => x.id === s.clienteId);
    if (!s || !c || ultimos4(c.numeroDocumento) !== doc4) return false;
    const o = ordenDeSolicitud(b, s.id);
    if (!o || !responderPresupuestoDemo(b, o.id, decision, "cliente_portal", null)) return false;
    db.guardar(b);
    window.dispatchEvent(new CustomEvent("psr-demo-cambio", { detail: { tipo: "cambio" } }));
    return true;
  },
  async precargaRecordatorio(token) {
    await espera(250);
    const b = db.cargar();
    const r = b.recordatorios.find((x) => x.token === token && (x.estado === "pendiente" || x.estado === "enviado"));
    const v = r && b.vehiculos.find((x) => x.id === r.vehiculoId);
    if (!r || !v || b.clientes.find((c) => c.id === v.clienteId)?.anonimizadoEn) return null;
    return { servicio: r.servicio, tipo: r.tipo, placa: v.placa, marca: v.marca, linea: v.linea, anio: v.anio, color: v.color, combustible: v.combustible, km: v.km };
  },
  async vincularRecordatorio(token, codigo) {
    const b = db.cargar();
    const s = b.solicitudes.find((x) => x.codigo === codigo.toUpperCase());
    const r = b.recordatorios.find((x) => x.token === token && (x.estado === "pendiente" || x.estado === "enviado"));
    if (!s || !r || r.vehiculoId !== s.vehiculoId) return false;
    r.estado = "agendado"; r.agendadoEn = new Date().toISOString(); r.solicitudId = s.id; s.canal = "recordatorio";
    db.guardar(b);
    return true;
  },
  async miMantenimiento(placa, doc4, cel4) {
    await espera(300);
    const b = db.cargar();
    const v = vehiculoDeCliente(b, placa, doc4, cel4);
    return v ? miMantenimientoDemo(b, v) : null;
  },
  async registrarVencimientos(placa, doc4, cel4, soat, rtm) {
    const b = db.cargar();
    const v = vehiculoDeCliente(b, placa, doc4, cel4);
    if (!v) return false;
    v.fechaSoat = soat; v.fechaTecnomecanica = rtm;
    sincronizarVencimientos(b, v);
    db.guardar(b);
    return true;
  },
  async configPublica() { return db.cargar().configPublica ?? null; },
  async consultarEstado(codigo, doc4): Promise<EstadoPublico | null> {
    await espera(300);
    const b = db.cargar();
    const s = b.solicitudes.find((x) => x.codigo === codigo.toUpperCase().trim());
    const c = s && b.clientes.find((x) => x.id === s.clienteId);
    if (!s || !c || c.anonimizadoEn || ultimos4(c.numeroDocumento) !== doc4) return null;
    const v = b.vehiculos.find((x) => x.id === s.vehiculoId)!;
    const cita = b.citas.filter((x) => x.solicitudId === s.id).at(-1) ?? null;
    const o = ordenDeSolicitud(b, s.id);
    return {
      codigo: s.codigo, placa: v.placa, linea: `${v.marca} ${v.linea}`,
      cita: cita && { fecha: cita.fecha, franja: cita.franja, estado: cita.estado },
      pasos: [
        { clave: "recibida", nombre: "Solicitud recibida", fecha: s.creadoEn, hecho: true },
        { clave: "cita", nombre: "Cita confirmada", fecha: null, hecho: cita?.estado === "confirmada" || !!o },
        ...pasosOrden(b, o),
      ],
      cancelada: o?.estado === "cancelado",
      presupuesto: o?.presupuestoEnviadoEn ? { total: o.presupuestoTotal!, estado: o.presupuestoEstado, enviadoEn: o.presupuestoEnviadoEn, trabajos: o.trabajos.map((t) => ({ descripcion: t.descripcion, repuestos: t.repuestos ?? null })) } : null,
      entrega: o?.estado === "entregado" ? { fecha: o.fechaEntrega!, garantiaHasta: o.garantiaHasta! } : null,
    };
  },
};
