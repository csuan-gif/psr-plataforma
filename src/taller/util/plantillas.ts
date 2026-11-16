import { TALLER, FRANJAS, type Franja } from "../../compartido/config";
import { fechaLarga } from "../../compartido/util/fechas";
import type { Plantillas } from "../datos/tipos";

export const PLANTILLAS_BASE: Plantillas = {
  recibida: "Hola {nombre}, te saluda {taller}. Recibimos tu solicitud {codigo} para tu {vehiculo} ({placa}). Ya la estamos revisando y te escribimos pronto.",
  confirmar: "Hola {nombre}, te confirmamos la cita para tu {vehiculo} ({placa}) el {fecha}, en la franja de la {franja} ({horas}). Tu código es {codigo}. ¡Te esperamos!",
  reprogramar: "Hola {nombre}, necesitamos mover tu cita. Te proponemos el {fecha}, en la franja de la {franja} ({horas}). ¿Te sirve? Responde este mensaje para confirmar. Código: {codigo}.",
  rechazar: "Hola {nombre}, por ahora no tenemos cupo para la fecha que pediste. ¿Quieres que busquemos otro día? Código: {codigo}.",
  info: "Hola {nombre}, para revisar mejor tu caso ({codigo}), ¿nos puedes enviar una foto o un video de lo que le pasa a tu {vehiculo}?",
};

export const NOMBRES_PLANTILLA: Record<keyof Plantillas, string> = {
  recibida: "Recibimos tu solicitud", confirmar: "Confirmar cita", reprogramar: "Proponer otra fecha", rechazar: "Sin cupo", info: "Pedir foto o video",
};

export interface DatosMensaje { nombre: string; codigo: string; placa: string; vehiculo: string; fecha?: string | null; franja?: Franja | null }

/** Reemplaza {campos}. Usa solo el primer nombre para un trato cercano. */
export function llenarPlantilla(texto: string, d: DatosMensaje) {
  const primerNombre = d.nombre.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || d.nombre;
  const valores: Record<string, string> = {
    nombre: primerNombre, codigo: d.codigo, placa: d.placa, vehiculo: d.vehiculo || "vehículo", taller: TALLER.nombre,
    fecha: d.fecha ? fechaLarga(d.fecha) : "(fecha por definir)",
    franja: d.franja ? FRANJAS[d.franja].nombre.toLowerCase() : "(franja por definir)",
    horas: d.franja ? FRANJAS[d.franja].horas : "",
  };
  return texto.replace(/\{(\w+)\}/g, (m, k) => valores[k] ?? m).replace(/\s\(\)/g, "");
}

/** Regla 2: las plantillas no prometen precios ni tiempos de reparación. */
export function revisarPlantilla(texto: string): string | null {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/\$|\bcop\b|\bprecio|\bcuesta|\bvale\b|\bvalor\b|\btarifa/.test(t)) return "Parece mencionar un precio. Las plantillas no deben prometer precios.";
  if (/\b(\d+|una|dos|tres|unas?)\s*(horas?|minutos?|dias? habiles)\b|queda listo|estara listo|lo entregamos (hoy|manana)/.test(t))
    return "Parece prometer un tiempo de reparación. Las plantillas no deben prometer tiempos.";
  return null;
}
