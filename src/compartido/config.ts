/**
 * Datos públicos del taller. El admin los edita en Ajustes → Datos del taller
 * (tabla config_taller, clave "publico"); estos valores son el RESPALDO si no hay conexión.
 * // EDITAR con los datos reales (no se recibió datos_taller.md).
 */
export const TALLER = {
  nombre: "PSR Pasión Sobre Ruedas",
  nombreCorto: "PSR",
  whatsapp: "573000000000", // EDITAR: indicativo 57 + celular, solo dígitos
  telefono: "+57 300 000 0000", // EDITAR
  correo: "contacto@ejemplo.com", // EDITAR
  direccion: "Barrio Santa María del Lago, Engativá, Bogotá", // EDITAR: dirección exacta
  mapa: "https://www.google.com/maps/search/?api=1&query=Santa+Mar%C3%ADa+del+Lago+Engativ%C3%A1+Bogot%C3%A1", // EDITAR
  horarios: [
    { dias: "Lunes a viernes", horas: "7:30 a. m. – 5:30 p. m." }, // EDITAR
    { dias: "Sábados", horas: "8:00 a. m. – 1:00 p. m." }, // EDITAR
  ],
  responsableDatos: "Javier Montoya – PSR Pasión Sobre Ruedas", // EDITAR: razón social y NIT si aplica
  nit: "", // EDITAR
  conservacion: "", // EDITAR: plazo de conservación de datos para el aviso
  regionDatos: "", // EDITAR: región del servidor de Supabase (ej. São Paulo)
  versionAviso: "2026-11-v1",
};
export type DatosTaller = Omit<typeof TALLER, "nombreCorto" | "versionAviso">;
export const CAMPOS_PUBLICOS = ["nombre", "whatsapp", "telefono", "correo", "direccion", "mapa", "horarios", "responsableDatos", "nit", "conservacion", "regionDatos"] as const;

/** Mezcla la configuración guardada (solo campos conocidos y con valor) sobre el respaldo. */
export function aplicarConfig(remota: Partial<DatosTaller> | null | undefined) {
  if (!remota) return;
  for (const k of CAMPOS_PUBLICOS) {
    const v = remota[k];
    if (k === "horarios") { if (Array.isArray(v) && v.length) TALLER.horarios = v as typeof TALLER.horarios; }
    else if (typeof v === "string" && v.trim()) (TALLER as Record<string, unknown>)[k] = v.trim();
  }
}

export const FRANJAS = {
  manana: { nombre: "Mañana", horas: "7:30 a. m. – 12:00 m." }, // EDITAR
  tarde: { nombre: "Tarde", horas: "1:00 p. m. – 5:00 p. m." }, // EDITAR
} as const;
export type Franja = keyof typeof FRANJAS;

export const ES_DEMO = import.meta.env.VITE_DEMO === "true";
