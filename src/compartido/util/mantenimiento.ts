/**
 * Estimación de mantenimiento (misma lógica que psr_privado.km_por_dia y
 * psr_privado.fecha_objetivo en SQL). Se usa en el modo demo y para los textos.
 */
import { sumarDias } from "./fechas";

export interface Lectura { km: number; fecha: string } // fecha AAAA-MM-DD

const dias = (a: string, b: string) => Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);

/** Promedio de km por día con 2+ lecturas separadas al menos 14 días; si no, null (se usa la fecha). */
export function kmPorDia(lecturas: Lectura[]): number | null {
  if (lecturas.length < 2) return null;
  const o = [...lecturas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.km - b.km);
  const p = o[0], u = o[o.length - 1];
  const d = dias(p.fecha, u.fecha);
  if (d < 14 || u.km < p.km) return null;
  return Math.min(Math.round(((u.km - p.km) / d) * 10) / 10, 500);
}

/** Fecha en que se llegará a un km estimado, desde la última lectura. */
export function fechaPorKm(kmEstimado: number | null, ultima: Lectura | null, kmDia: number | null): string | null {
  if (kmEstimado == null || !ultima || !kmDia || kmDia <= 0) return null;
  return sumarDias(ultima.fecha, Math.ceil(Math.max(kmEstimado - ultima.km, 0) / kmDia));
}

/** La más cercana entre la fecha por meses y la fecha por km. */
export function fechaObjetivo(fechaEstimada: string | null, porKm: string | null): string | null {
  if (fechaEstimada && porKm) return fechaEstimada < porKm ? fechaEstimada : porKm;
  return fechaEstimada ?? porKm;
}

export function kmHoy(ultima: Lectura | null, kmDia: number | null, hoy: string): number | null {
  if (!ultima) return null;
  return kmDia ? ultima.km + Math.round(kmDia * dias(ultima.fecha, hoy)) : ultima.km;
}

/** "en 12 días", "hoy", "hace 3 días". */
export function cuandoTexto(fecha: string, hoy: string) {
  const d = dias(hoy, fecha);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d > 0) return d < 60 ? `en ${d} días` : `en ${Math.round(d / 30)} meses`;
  return d === -1 ? "ayer" : `hace ${-d} días`;
}
