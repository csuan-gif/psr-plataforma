/** Fechas en hora de Bogotá (UTC-5, sin horario de verano). */
const OFFSET_MS = -5 * 3600 * 1000;

export const hoyBogota = (ahora = new Date()) => new Date(ahora.getTime() + OFFSET_MS).toISOString().slice(0, 10);

export const sumarDias = (isoFecha: string, n: number) => {
  const d = new Date(isoFecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const diaSemana = (isoFecha: string) => new Date(isoFecha + "T00:00:00Z").getUTCDay();

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function fechaLarga(isoFecha: string) {
  const d = new Date(isoFecha + "T00:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}
export const nombreMes = (m: number) => MESES[m];
export const nombreDiaCorto = (dow: number) => DIAS[dow].slice(0, 3);

export function haceCuanto(isoTs: string, ahora = Date.now()) {
  const min = Math.round((ahora - new Date(isoTs).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
