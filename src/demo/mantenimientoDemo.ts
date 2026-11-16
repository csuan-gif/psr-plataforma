/**
 * Clientes, historial y mantenimiento preventivo del MODO DEMO.
 * Replica supabase/migrations/..._clientes_mantenimiento.sql.
 */
import type { BaseDemo, ClienteDemo, VehiculoDemo } from "./apiDemo";
import type { RecordatorioDemo } from "./ordenesDemo";
import { nuevoId } from "../compartido/util/almacen";
import { hoyBogota, sumarDias } from "../compartido/util/fechas";
import { fechaObjetivo, fechaPorKm, kmHoy, kmPorDia, type Lectura } from "../compartido/util/mantenimiento";
import { limpiarPlaca, ultimos4 } from "../compartido/util/validaciones";
import type { FichaCliente, FilaImportacion, RecordatorioTaller, ResultadoImportacion } from "../taller/datos/tipos";
import type { MiMantenimiento } from "../compartido/datos/tipos";

export const DIAS_AVISO_VENCIMIENTO = 30; // EDITAR

export function lecturasDe(b: BaseDemo, vehiculoId: string): Lectura[] {
  const l: Lectura[] = b.lecturas.filter((x) => x.vehiculoId === vehiculoId).map(({ km, fecha }) => ({ km, fecha }));
  for (const r of b.recepciones.filter((x) => x.vehiculoId === vehiculoId)) l.push({ km: r.kmIngreso, fecha: r.fechaHora.slice(0, 10) });
  for (const o of b.ordenes) {
    const r = b.recepciones.find((x) => x.id === o.recepcionId);
    if (r?.vehiculoId === vehiculoId && o.kmSalida != null && o.fechaEntrega) l.push({ km: o.kmSalida, fecha: o.fechaEntrega.slice(0, 10) });
  }
  const v = b.vehiculos.find((x) => x.id === vehiculoId);
  if (v?.km != null && v.kmFecha) l.push({ km: v.km, fecha: v.kmFecha });
  return l;
}

function ultimaLectura(v: VehiculoDemo): Lectura | null { return v.km != null && v.kmFecha ? { km: v.km, fecha: v.kmFecha } : null; }

export function calcular(b: BaseDemo, r: RecordatorioDemo) {
  const v = b.vehiculos.find((x) => x.id === r.vehiculoId)!;
  const kd = kmPorDia(lecturasDe(b, v.id));
  const porKm = fechaPorKm(r.kmEstimado, ultimaLectura(v), kd);
  return { v, kd, porKm, objetivo: fechaObjetivo(r.fechaEstimada, porKm) };
}

export function recordatoriosProximos(b: BaseDemo, dias: number): RecordatorioTaller[] {
  const hoy = hoyBogota();
  return b.recordatorios
    .filter((r) => r.estado === "pendiente" || r.estado === "enviado")
    .map((r) => {
      const { v, kd, porKm, objetivo } = calcular(b, r);
      const c = b.clientes.find((x) => x.id === v.clienteId)!;
      return { r, v, c, kd, porKm, objetivo };
    })
    .filter(({ c, r, objetivo }) => !c.anonimizadoEn && objetivo && objetivo <= sumarDias(hoy, dias + (r.tipo === "mantenimiento" ? 0 : DIAS_AVISO_VENCIMIENTO)))
    .sort((a, b2) => (a.objetivo ?? "").localeCompare(b2.objetivo ?? ""))
    .map(({ r, v, c, kd, porKm, objetivo }) => ({
      id: r.id, token: r.token, tipo: r.tipo, servicio: r.servicio, estado: r.estado as RecordatorioTaller["estado"], fechaEstimada: r.fechaEstimada, kmEstimado: r.kmEstimado,
      fechaPorKm: porKm, fechaObjetivo: objetivo, kmDia: kd, kmHoy: kmHoy(ultimaLectura(v), kd, hoy), enviadoEn: r.enviadoEn,
      vehiculo: { id: v.id, placa: v.placa, marca: v.marca, linea: v.linea },
      cliente: { id: c.id, nombre: c.nombre, celular: c.celular, autorizaDatos: c.autorizaDatos !== false, aceptaRecordatorios: c.aceptaRecordatorios !== false, origen: c.origen ?? "portal" },
    }));
}

/** Un recordatorio vivo por vehículo para SOAT y RTM (igual que el trigger tg_vencimientos). */
export function sincronizarVencimientos(b: BaseDemo, v: VehiculoDemo) {
  for (const [tipo, fecha, servicio] of [["soat", v.fechaSoat, "Vencimiento del SOAT"], ["tecnomecanica", v.fechaTecnomecanica, "Vencimiento de la revisión técnico-mecánica"]] as const) {
    const vivo = b.recordatorios.find((r) => r.vehiculoId === v.id && r.tipo === tipo && (r.estado === "pendiente" || r.estado === "enviado"));
    if (vivo?.fechaEstimada === (fecha ?? null)) continue;
    if (vivo) vivo.estado = "descartado";
    if (fecha) b.recordatorios.push(nuevoRecordatorio(v.id, servicio, tipo, fecha, null));
  }
}

export function nuevoRecordatorio(vehiculoId: string, servicio: string, tipo: RecordatorioDemo["tipo"], fecha: string | null, km: number | null): RecordatorioDemo {
  return { id: nuevoId(), token: nuevoId(), vehiculoId, servicio, tipo, fechaEstimada: fecha, kmEstimado: km, estado: "pendiente", creadoEn: new Date().toISOString(), enviadoEn: null, agendadoEn: null, solicitudId: null };
}

export function marcarRecordatorioDemo(b: BaseDemo, id: string, estado: RecordatorioDemo["estado"]) {
  const r = b.recordatorios.find((x) => x.id === id)!;
  r.estado = estado;
  if (estado === "enviado") r.enviadoEn ??= new Date().toISOString();
  if (estado === "agendado") r.agendadoEn = new Date().toISOString();
}

export function indicadorDemo(b: BaseDemo, dias: number) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const env = b.recordatorios.filter((r) => r.enviadoEn && r.enviadoEn >= desde);
  const ag = env.filter((r) => r.estado === "agendado").length;
  return { dias, enviados: env.length, agendados: ag, conversion: env.length ? Math.round((ag / env.length) * 1000) / 1000 : null };
}

export function vehiculoDeCliente(b: BaseDemo, placa: string, doc4: string, cel4: string) {
  const v = b.vehiculos.find((x) => x.placa === limpiarPlaca(placa));
  const c = v && b.clientes.find((x) => x.id === v.clienteId);
  return v && c && !c.anonimizadoEn && ultimos4(c.numeroDocumento) === doc4 && ultimos4(c.celular) === cel4 ? v : null;
}

export function miMantenimientoDemo(b: BaseDemo, v: VehiculoDemo): MiMantenimiento {
  const ord = b.ordenes.filter((o) => o.estado === "entregado" && b.recepciones.find((r) => r.id === o.recepcionId)?.vehiculoId === v.id)
    .sort((a, c) => (c.fechaEntrega ?? "").localeCompare(a.fechaEntrega ?? ""))[0];
  return {
    placa: v.placa, marca: v.marca, linea: v.linea, anio: v.anio, color: v.color, combustible: v.combustible, km: v.km, kmFecha: v.kmFecha ?? null,
    fechaSoat: v.fechaSoat ?? null, fechaTecnomecanica: v.fechaTecnomecanica ?? null,
    proximos: b.recordatorios.filter((r) => r.vehiculoId === v.id && (r.estado === "pendiente" || r.estado === "enviado"))
      .map((r) => ({ servicio: r.servicio, tipo: r.tipo, fecha: calcular(b, r).objetivo, km: r.kmEstimado })).sort((a, c) => (a.fecha ?? "").localeCompare(c.fecha ?? "")),
    ultimoServicio: ord ? { fecha: ord.fechaEntrega!, km: ord.kmSalida, trabajos: ord.trabajos.map((t) => t.descripcion) } : null,
  };
}

export function fichaDemo(b: BaseDemo, id: string): FichaCliente {
  const c = b.clientes.find((x) => x.id === id)!;
  return {
    id: c.id, tipoDocumento: c.tipoDocumento, numeroDocumento: c.numeroDocumento, digitoVerificacion: null, nombre: c.nombre, celular: c.celular,
    correo: c.correo ?? null, direccion: c.direccion ?? null, barrioMunicipio: null, autorizaDatos: c.autorizaDatos !== false,
    autorizaFecha: c.autorizaDatos === false ? null : c.creadoEn ?? null, autorizaVersion: c.autorizaDatos === false ? null : "2026-11-v1",
    verificado: b.recepciones.some((r) => b.vehiculos.find((v) => v.id === r.vehiculoId)?.clienteId === c.id), origen: c.origen ?? "portal",
    aceptaRecordatorios: c.aceptaRecordatorios !== false, anonimizadoEn: c.anonimizadoEn ?? null, creadoEn: c.creadoEn ?? new Date().toISOString(),
    vehiculos: b.vehiculos.filter((v) => v.clienteId === c.id).map((v) => ({
      id: v.id, placa: v.placa, marca: v.marca, linea: v.linea, anio: v.anio, color: v.color, vin: v.vin ?? null, combustible: v.combustible, km: v.km, kmFecha: v.kmFecha ?? null,
      kmDia: kmPorDia(lecturasDe(b, v.id)), fechaSoat: v.fechaSoat ?? null, fechaTecnomecanica: v.fechaTecnomecanica ?? null,
      solicitudes: b.solicitudes.filter((s) => s.vehiculoId === v.id).map((s) => ({ id: s.id, codigo: s.codigo, creadoEn: s.creadoEn, estado: s.estado, zonas: s.zonas, sintomas: s.sintomas, descripcion: s.descripcion })).reverse(),
      ordenes: b.ordenes.filter((o) => b.recepciones.find((r) => r.id === o.recepcionId)?.vehiculoId === v.id).map((o) => {
        const r = b.recepciones.find((x) => x.id === o.recepcionId)!;
        return { id: o.id, estado: o.estado, creadoEn: o.creadoEn, fechaEntrega: o.fechaEntrega, recepcionId: r.id, kmIngreso: r.kmIngreso, kmSalida: o.kmSalida, trabajos: o.trabajos, presupuestoTotal: o.presupuestoTotal, presupuestoEstado: o.presupuestoEstado, garantiaHasta: o.garantiaHasta };
      }).reverse(),
      recordatorios: b.recordatorios.filter((r) => r.vehiculoId === v.id && r.estado !== "descartado").map((r) => ({ id: r.id, servicio: r.servicio, tipo: r.tipo, estado: r.estado, fechaObjetivo: calcular(b, r).objetivo, kmEstimado: r.kmEstimado })),
    })),
  };
}

export function anonimizarDemo(b: BaseDemo, id: string) {
  const c = b.clientes.find((x) => x.id === id)!;
  Object.assign(c, { nombre: "Cliente anonimizado", numeroDocumento: "ANON-" + id.replace(/-/g, "").slice(0, 10), celular: "", correo: undefined, direccion: undefined, aceptaRecordatorios: false, anonimizadoEn: new Date().toISOString() });
  for (const s of b.solicitudes.filter((x) => x.clienteId === id)) { s.datosReportados = {}; s.descripcion = ""; }
  const vs = b.vehiculos.filter((v) => v.clienteId === id).map((v) => v.id);
  for (const r of b.recepciones.filter((x) => vs.includes(x.vehiculoId))) { r.firmadoPor = "Anonimizado"; r.objetosPersonales = ""; }
  for (const r of b.recordatorios.filter((x) => vs.includes(x.vehiculoId) && (x.estado === "pendiente" || x.estado === "enviado"))) r.estado = "descartado";
}

/** Importación: no sobrescribe; solo completa vacíos. Los nuevos quedan SIN autorización registrada. */
export function importarDemo(b: BaseDemo, filas: FilaImportacion[]): ResultadoImportacion {
  const res: ResultadoImportacion = { filas: 0, clientesNuevos: 0, clientesActualizados: 0, vehiculosNuevos: 0, vehiculosActualizados: 0, recordatorios: 0, errores: [] };
  filas.forEach((f, i) => {
    res.filas++;
    try {
      let tipo = (f.tipoDocumento || "CC").trim().toUpperCase();
      if (["CEDULA", "CÉDULA", "C.C.", "C.C"].includes(tipo)) tipo = "CC";
      if (!["CC", "CE", "NIT", "PAS"].includes(tipo)) throw new Error(`Tipo de documento no reconocido: ${f.tipoDocumento}`);
      const doc = tipo === "PAS" ? (f.numeroDocumento ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "") : (f.numeroDocumento ?? "").replace(/\D/g, "");
      if (doc.length < 4) throw new Error("Falta el número de documento");
      if ((f.nombre ?? "").trim().length < 2) throw new Error("Falta el nombre");
      let c = b.clientes.find((x) => x.tipoDocumento === tipo && x.numeroDocumento === doc);
      if (!c) {
        c = { id: nuevoId(), tipoDocumento: tipo, numeroDocumento: doc, nombre: f.nombre!.trim(), celular: (f.celular ?? "").replace(/\D/g, ""), correo: f.correo?.trim() || undefined, direccion: f.direccion?.trim() || undefined, origen: "importado", autorizaDatos: false, creadoEn: new Date().toISOString() } as ClienteDemo;
        b.clientes.push(c); res.clientesNuevos++;
      } else {
        c.celular ||= (f.celular ?? "").replace(/\D/g, ""); c.correo ||= f.correo?.trim() || undefined; c.direccion ||= f.direccion?.trim() || undefined;
        res.clientesActualizados++;
      }
      const placa = limpiarPlaca(f.placa ?? "");
      if (placa.length >= 3 && placa.length <= 8) {
        const km = f.km ? Number(String(f.km).replace(/\D/g, "")) || null : null;
        const fecha = f.fechaUltimoServicio || null;
        let v = b.vehiculos.find((x) => x.placa === placa);
        if (!v) {
          v = { id: nuevoId(), clienteId: c.id, placa, marca: f.marca?.trim() || "Sin dato", linea: f.linea?.trim() || "", anio: f.anio ? Number(f.anio) || null : null, color: f.color?.trim() || "", combustible: "", km, kmFecha: km != null ? fecha ?? hoyBogota() : null, fechaSoat: f.fechaSoat || null, fechaTecnomecanica: f.fechaTecnomecanica || null };
          b.vehiculos.push(v); res.vehiculosNuevos++;
          sincronizarVencimientos(b, v);
        } else {
          v.linea ||= f.linea?.trim() || ""; v.color ||= f.color?.trim() || "";
          if (km != null && km > (v.km ?? -1)) { v.km = km; v.kmFecha = fecha ?? hoyBogota(); }
          v.fechaSoat ??= f.fechaSoat || null; v.fechaTecnomecanica ??= f.fechaTecnomecanica || null;
          sincronizarVencimientos(b, v);
          res.vehiculosActualizados++;
        }
        const servicio = f.ultimoServicio?.trim().toLowerCase();
        if (fecha && servicio) {
          const pl = b.planes.find((p) => p.servicio.toLowerCase().includes(servicio));
          if (pl && !b.recordatorios.some((r) => r.vehiculoId === v!.id && r.servicio === pl.servicio && (r.estado === "pendiente" || r.estado === "enviado"))) {
            const d = new Date(fecha + "T00:00:00Z"); if (pl.intervaloMeses) d.setUTCMonth(d.getUTCMonth() + pl.intervaloMeses);
            b.recordatorios.push(nuevoRecordatorio(v.id, pl.servicio, "mantenimiento", pl.intervaloMeses ? d.toISOString().slice(0, 10) : null, pl.intervaloKm && km != null ? km + pl.intervaloKm : null));
            res.recordatorios++;
          }
        }
      }
    } catch (e) {
      res.errores.push({ fila: i + 1, motivo: e instanceof Error ? e.message : String(e) });
    }
  });
  return res;
}
