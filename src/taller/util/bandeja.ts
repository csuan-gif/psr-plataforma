import type { Color, SolicitudTaller } from "../datos/tipos";
import { hoyBogota, sumarDias, diaSemana } from "../../compartido/util/fechas";
import { limpiarPlaca } from "../../compartido/util/validaciones";
import { normalizarTexto } from "./texto";
import type { Franja } from "../../compartido/config";
import type { FilaDisponibilidad } from "../datos/tipos";

export type FiltroEstado = "activas" | "atendidas" | "todas";
export type Periodo = "hoy" | "7" | "30" | "todo";
const ORDEN: Record<Color, number> = { rojo: 0, amarillo: 1, verde: 2 };

/** Orden: rojo primero; dentro de cada color, la que más lleva esperando. */
export function ordenarBandeja(l: SolicitudTaller[]) {
  return [...l].sort((a, b) => ORDEN[a.semaforo.final] - ORDEN[b.semaforo.final] || a.creadoEn.localeCompare(b.creadoEn));
}

export function filtrarBandeja(l: SolicitudTaller[], f: { color: Color | "todos"; estado: FiltroEstado; periodo: Periodo; texto: string }, hoy = hoyBogota()) {
  const q = normalizarTexto(f.texto), qPlaca = limpiarPlaca(f.texto);
  const desde = f.periodo === "hoy" ? hoy : f.periodo === "7" ? sumarDias(hoy, -6) : f.periodo === "30" ? sumarDias(hoy, -29) : "";
  return l.filter((s) =>
    (f.color === "todos" || s.semaforo.final === f.color) &&
    (f.estado === "todas" ? true : f.estado === "activas" ? s.estado === "nueva" || s.estado === "en_revision" : s.estado === "atendida") &&
    (!desde || new Date(new Date(s.creadoEn).getTime() - 5 * 3600000).toISOString().slice(0, 10) >= desde) &&
    (!q || normalizarTexto(s.cliente.nombre).includes(q) || (qPlaca.length >= 2 && s.vehiculo.placa.includes(qPlaca)) || (s.cliente.numeroDocumento ?? "").includes(q.replace(/\D/g, "") || "-") || s.codigo.toLowerCase().includes(q)));
}


/** Lunes de la semana de una fecha (la agenda va de lunes a sábado). */
export const lunesDe = (f: string) => sumarDias(f, -((diaSemana(f) + 6) % 7));

/** Completa las 14 filas (7 días × 2 franjas) aunque la base no las tenga todas. */
export function completarFilas(filas: FilaDisponibilidad[]): FilaDisponibilidad[] {
  return [1, 2, 3, 4, 5, 6, 0].flatMap((d) => (["manana", "tarde"] as Franja[]).map((fr) =>
    filas.find((x) => x.diaSemana === d && x.franja === fr) ?? { diaSemana: d, franja: fr, horaInicio: fr === "manana" ? "07:30" : "13:00", horaFin: fr === "manana" ? "12:00" : "17:00", cupos: 0, activo: false }));
}
