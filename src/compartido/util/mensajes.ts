import { TALLER, FRANJAS, type Franja } from "../config";
import { fechaLarga } from "./fechas";

/** Enlace wa.me (sin API de WhatsApp Business). */
export const enlaceWhatsApp = (numero: string, texto: string) =>
  `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;

/**
 * Aviso de seguridad (excepción de la regla 1). Se calcula SOLO con lo que el
 * cliente marcó, no con el semáforo, y nunca menciona colores ni prioridad.
 */
export function requiereAvisoSeguridad(d: { movilidad: string; zonas: string[]; sintomas: string[] }) {
  return (
    d.movilidad === "no" ||
    d.zonas.some((z) => z === "frenos" || z === "direccion") ||
    d.sintomas.some((s) => s.startsWith("frenos.") || s.startsWith("direccion.") || s === "nose.frenos_direccion")
  );
}
export const AVISO_SEGURIDAD = "Si sientes que los frenos o la dirección fallan, no conduzcas el vehículo.";
export const MENSAJE_NEUTRO = "Recibimos tu solicitud. El taller la revisará y te confirmará.";

/** Archivo .ics para "Añadir al calendario" (cita pendiente de confirmación). */
export function generarIcs(codigo: string, fecha: string, franja: Franja) {
  const [hi, hf] = franja === "manana" ? ["073000", "120000"] : ["130000", "170000"];
  const f = fecha.replace(/-/g, "");
  const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const esc = (s: string) => s.replace(/[,;\\]/g, (m) => "\\" + m);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PSR//Portal//ES", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${codigo}@psr`, `DTSTAMP:${ahora}`,
    `DTSTART;TZID=America/Bogota:${f}T${hi}`, `DTEND;TZID=America/Bogota:${f}T${hf}`,
    `SUMMARY:${esc(`${TALLER.nombreCorto} · Cita PENDIENTE de confirmación (${codigo})`)}`,
    `LOCATION:${esc(TALLER.direccion)}`,
    `DESCRIPTION:${esc(`Franja ${FRANJAS[franja].nombre.toLowerCase()} (${FRANJAS[franja].horas}). El taller te confirmará la cita. Código: ${codigo}`)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function textoCita(fecha?: string | null, franja?: Franja | null) {
  if (!fecha || !franja) return "Sin cita (solo cotización o información)";
  return `${fechaLarga(fecha)}, en la ${FRANJAS[franja].nombre.toLowerCase()} (${FRANJAS[franja].horas})`;
}
