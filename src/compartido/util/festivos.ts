/**
 * Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani"): algunos se trasladan al
 * lunes siguiente. Misma lógica que la función SQL psr_privado.festivos_colombia.
 */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const sumar = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const alLunes = (d: Date) => {
  const dow = d.getUTCDay(); // 0 domingo, 1 lunes
  return dow === 1 ? d : sumar(d, (8 - dow) % 7);
};

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
export function pascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, mes, dia);
}

export function festivosColombia(y: number): { fecha: string; nombre: string }[] {
  const p = pascua(y);
  const L: [Date, string][] = [
    [utc(y, 1, 1), "Año Nuevo"],
    [alLunes(utc(y, 1, 6)), "Día de los Reyes Magos"],
    [alLunes(utc(y, 3, 19)), "Día de San José"],
    [sumar(p, -3), "Jueves Santo"],
    [sumar(p, -2), "Viernes Santo"],
    [utc(y, 5, 1), "Día del Trabajo"],
    [sumar(p, 43), "Ascensión del Señor"],
    [sumar(p, 64), "Corpus Christi"],
    [sumar(p, 71), "Sagrado Corazón"],
    [alLunes(utc(y, 6, 29)), "San Pedro y San Pablo"],
    [utc(y, 7, 20), "Día de la Independencia"],
    [utc(y, 8, 7), "Batalla de Boyacá"],
    [alLunes(utc(y, 8, 15)), "Asunción de la Virgen"],
    [alLunes(utc(y, 10, 12)), "Día de la Raza"],
    [alLunes(utc(y, 11, 1)), "Todos los Santos"],
    [alLunes(utc(y, 11, 11)), "Independencia de Cartagena"],
    [utc(y, 12, 8), "Inmaculada Concepción"],
    [utc(y, 12, 25), "Navidad"],
  ];
  return L.map(([d, nombre]) => ({ fecha: iso(d), nombre })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
