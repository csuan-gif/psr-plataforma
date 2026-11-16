/**
 * Lectura y escritura de Excel/CSV en el navegador. Las librerías se cargan
 * solo al usarlas (read-excel-file / write-excel-file, versiones fijadas).
 */
import type { ClienteLista, FilaImportacion } from "../datos/tipos";

export type Celda = string | number | boolean | Date | null;

/** CSV con detección de separador (; es el habitual en Excel en español). */
export function leerCsv(texto: string): Celda[][] {
  const t = texto.replace(/^﻿/, "");
  const primera = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: Celda[][] = [];
  let fila: Celda[] = [], campo = "", comillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((c) => String(c).trim())) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some((c) => String(c).trim())) filas.push(fila);
  return filas;
}

export async function leerArchivo(archivo: File): Promise<Celda[][]> {
  if (/\.csv$/i.test(archivo.name) || archivo.type === "text/csv") return leerCsv(await archivo.text());
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(archivo)) as Celda[][];
}

/** Campos que entiende la importación y palabras con que suelen venir en el Excel del taller. */
export const CAMPOS: { id: keyof FilaImportacion; nombre: string; obligatorio?: boolean; sinonimos: string[] }[] = [
  { id: "tipoDocumento", nombre: "Tipo de documento", sinonimos: ["tipo doc", "tipo de documento", "tipo"] },
  { id: "numeroDocumento", nombre: "Número de documento", obligatorio: true, sinonimos: ["cedula", "cédula", "documento", "nit", "cc", "identificacion", "identificación", "numero documento"] },
  { id: "nombre", nombre: "Nombre o razón social", obligatorio: true, sinonimos: ["nombre", "cliente", "razon social", "razón social", "propietario"] },
  { id: "celular", nombre: "Celular", sinonimos: ["celular", "telefono", "teléfono", "movil", "móvil", "whatsapp", "tel"] },
  { id: "correo", nombre: "Correo", sinonimos: ["correo", "email", "e-mail", "mail"] },
  { id: "direccion", nombre: "Dirección", sinonimos: ["direccion", "dirección"] },
  { id: "placa", nombre: "Placa", sinonimos: ["placa"] },
  { id: "marca", nombre: "Marca", sinonimos: ["marca"] },
  { id: "linea", nombre: "Línea o modelo", sinonimos: ["linea", "línea", "modelo", "referencia", "vehiculo", "vehículo"] },
  { id: "anio", nombre: "Año", sinonimos: ["año", "ano", "anio", "modelo año"] },
  { id: "color", nombre: "Color", sinonimos: ["color"] },
  { id: "km", nombre: "Kilometraje", sinonimos: ["km", "kilometraje", "kilometros", "kilómetros"] },
  { id: "fechaUltimoServicio", nombre: "Fecha del último servicio", sinonimos: ["fecha", "fecha servicio", "ultima visita", "última visita", "fecha ultimo servicio"] },
  { id: "ultimoServicio", nombre: "Último servicio", sinonimos: ["servicio", "trabajo", "ultimo servicio", "último servicio"] },
  { id: "fechaSoat", nombre: "Vencimiento SOAT", sinonimos: ["soat"] },
  { id: "fechaTecnomecanica", nombre: "Vencimiento técnico-mecánica", sinonimos: ["tecno", "tecnomecanica", "técnico-mecánica", "rtm", "revision tecnica"] },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Propone qué columna del Excel va a cada campo según el encabezado. */
export function proponerMapeo(encabezados: string[]): Partial<Record<keyof FilaImportacion, number>> {
  const m: Partial<Record<keyof FilaImportacion, number>> = {};
  const usadas = new Set<number>();
  for (const pasada of ["exacta", "contiene"] as const) {
    for (const c of CAMPOS) {
      if (m[c.id] !== undefined) continue;
      const i = encabezados.findIndex((h, j) => !usadas.has(j) && c.sinonimos.some((s) => (pasada === "exacta" ? norm(h) === norm(s) : norm(h).includes(norm(s)))));
      if (i >= 0) { m[c.id] = i; usadas.add(i); }
    }
  }
  return m;
}

/** Fechas: Date de Excel, AAAA-MM-DD o DD/MM/AAAA. */
export function aFechaIso(v: Celda): string | undefined {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return undefined;
}

export function aFilas(datos: Celda[][], mapeo: Partial<Record<keyof FilaImportacion, number>>): FilaImportacion[] {
  return datos.slice(1).map((fila) => {
    const f: FilaImportacion = {};
    for (const c of CAMPOS) {
      const i = mapeo[c.id];
      if (i === undefined) continue;
      const v = fila[i];
      if (v === null || v === undefined || String(v).trim() === "") continue;
      f[c.id] = c.id.startsWith("fecha") ? aFechaIso(v) : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim();
    }
    return f;
  }).filter((f) => Object.keys(f).length > 0);
}

// ---------- Exportar ----------
const ENCABEZADOS = ["Tipo documento", "Número documento", "Nombre o razón social", "Celular", "Correo", "Placas", "Origen", "Autorización de datos", "Fecha de registro"];
const fila = (c: ClienteLista) => [c.tipoDocumento, c.numeroDocumento, c.nombre, c.celular, c.correo ?? "", c.placas.join(", "), c.origen, c.autorizaDatos ? "Sí" : "No registrada", c.creadoEn.slice(0, 10)];

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: nombre }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Celda CSV segura: lo que viene del portal no debe ejecutarse como fórmula al abrir el archivo en Excel. */
export function celdaCsv(v0: string) {
  const v = /^[=+\-@\t\r]/.test(v0) ? "'" + v0 : v0;
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function exportarCsv(clientes: ClienteLista[]) {
  const esc = celdaCsv;
  const txt = [ENCABEZADOS, ...clientes.map(fila)].map((r) => r.map((v) => esc(String(v))).join(";")).join("\r\n");
  descargar(new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" }), `clientes-psr-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportarXlsx(clientes: ClienteLista[]) {
  const { default: escribir } = await import("write-excel-file/browser");
  const datos = [ENCABEZADOS.map((h) => ({ value: h, fontWeight: "bold" as const })), ...clientes.map((c) => fila(c).map((v) => ({ value: v })))];
  const blob = await escribir(datos, { columns: ENCABEZADOS.map((_, i) => ({ width: [8, 16, 34, 14, 28, 18, 12, 14, 14][i] })) }).toBlob();
  descargar(blob, `clientes-psr-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
