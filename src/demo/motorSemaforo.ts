/**
 * __MOTOR_SEMAFORO_DEMO__
 * Motor del semáforo para el MODO DEMO. En producción el color lo calcula el
 * servidor (función SQL psr_privado.clasificar_solicitud) y este archivo NO
 * debe llegar al navegador: scripts/verificar-bundle.mjs lo comprueba.
 * Misma lógica que la versión SQL; ambas se prueban con tests/casos.json.
 */
import reglas from "./reglas.json";

export type Color = "rojo" | "amarillo" | "verde";
export interface EntradaSemaforo {
  zonas: string[];
  sintomas: string[];
  descripcion: string;
  movilidad: "si" | "no" | "nose" | string;
}
export interface ResultadoSemaforo {
  color: Color;
  razones: string[];
}

export interface Reglas {
  movilidad: Record<string, string>;
  noSeguroEnZonas: string[];
  sintomas: Record<string, string>;
  palabras: { rojo: string[]; amarillo: string[] };
}

export const normalizar = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const GRAVEDAD: Record<Color, number> = { verde: 0, amarillo: 1, rojo: 2 };

export function clasificar(e: EntradaSemaforo, R: Reglas = reglas as Reglas): ResultadoSemaforo {
  const razones: Record<Color, string[]> = { rojo: [], amarillo: [], verde: [] };
  const mov = R.movilidad[e.movilidad] as Color | undefined;
  if (mov) razones[mov].push("El cliente indica que el vehículo no puede movilizarse");
  if (e.movilidad === "nose" && e.zonas.some((z) => R.noSeguroEnZonas.includes(z)))
    razones.rojo.push("No está seguro de poder movilizarse y la zona es frenos o dirección");
  for (const s of e.sintomas) {
    const c = R.sintomas[s] as Color | undefined;
    if (c && c !== "verde") razones[c].push("Síntoma marcado: " + s);
  }
  const txt = normalizar(e.descripcion);
  if (txt) {
    for (const c of ["rojo", "amarillo"] as const)
      for (const w of R.palabras[c]) if (txt.includes(normalizar(w))) razones[c].push(`La descripción menciona «${w}»`);
  }
  // Gana el color más grave encontrado.
  const color: Color = razones.rojo.length ? "rojo" : razones.amarillo.length ? "amarillo" : "verde";
  return {
    color,
    razones: color === "verde" ? ["Mantenimiento, cotización, latonería sin compromiso mecánico o duda general"] : razones[color],
  };
}

export const esMasGrave = (a: Color, b: Color) => GRAVEDAD[a] > GRAVEDAD[b];

/** Reglas como filas editables (igual que la tabla reglas_semaforo) y de vuelta al formato del motor. */
export interface FilaRegla { id: number; tipo: "sintoma" | "palabra" | "movilidad" | "movilidad_zona"; valor: string; zona: string | null; color: Color; activo: boolean }
export function listaDesdeReglas(R: Reglas = reglas as Reglas): FilaRegla[] {
  const l: Omit<FilaRegla, "id">[] = [
    ...Object.entries(R.movilidad).map(([valor, color]) => ({ tipo: "movilidad" as const, valor, zona: null, color: color as Color, activo: true })),
    ...R.noSeguroEnZonas.map((zona) => ({ tipo: "movilidad_zona" as const, valor: "nose", zona, color: "rojo" as Color, activo: true })),
    ...Object.entries(R.sintomas).map(([valor, color]) => ({ tipo: "sintoma" as const, valor, zona: null, color: color as Color, activo: true })),
    ...(["rojo", "amarillo"] as const).flatMap((color) => R.palabras[color].map((valor) => ({ tipo: "palabra" as const, valor, zona: null, color, activo: true }))),
  ];
  return l.map((x, i) => ({ ...x, id: i + 1 }));
}
export function reglasDesdeLista(l: FilaRegla[]): Reglas {
  const a = l.filter((x) => x.activo);
  return {
    movilidad: Object.fromEntries(a.filter((x) => x.tipo === "movilidad").map((x) => [x.valor, x.color])),
    noSeguroEnZonas: a.filter((x) => x.tipo === "movilidad_zona" && x.color === "rojo").map((x) => x.zona!),
    sintomas: Object.fromEntries(a.filter((x) => x.tipo === "sintoma").map((x) => [x.valor, x.color])),
    palabras: { rojo: a.filter((x) => x.tipo === "palabra" && x.color === "rojo").map((x) => x.valor), amarillo: a.filter((x) => x.tipo === "palabra" && x.color === "amarillo").map((x) => x.valor) },
  };
}
