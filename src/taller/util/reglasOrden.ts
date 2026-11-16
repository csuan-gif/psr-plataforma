/**
 * Reglas de negocio de la orden de trabajo. Espejo de public.cambiar_estado_orden
 * (SQL); el servidor es quien decide, esto sirve para el modo demo y para explicar
 * en pantalla por qué un paso está bloqueado ANTES de intentarlo.
 */
export const ESTADOS_ORDEN = ["recibido", "en_diagnostico", "esperando_aprobacion", "en_reparacion", "en_prueba", "listo", "entregado"] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number] | "cancelado";
export type EstadoPresupuesto = "no_requerido" | "pendiente" | "aprobado" | "rechazado";

export const NOMBRE_ESTADO: Record<EstadoOrden, string> = {
  recibido: "Recibido", en_diagnostico: "En diagnóstico", esperando_aprobacion: "Esperando aprobación", en_reparacion: "En reparación",
  en_prueba: "En prueba", listo: "Listo para entregar", entregado: "Entregado", cancelado: "Cancelado",
};

export interface Trabajo {
  descripcion: string;
  tipo: "diagnostico" | "correctivo" | "preventivo" | "latoneria" | "electrico";
  repuestos?: string;
  planId?: number | null; // si es un servicio del plan de mantenimiento, genera recordatorio al entregar
}

export interface OrdenParaReglas {
  estado: EstadoOrden;
  presupuestoEstado: EstadoPresupuesto;
  autorizaPresupuestoPrevio: boolean;
  autorizaPruebaRuta: boolean;
  kmIngreso: number | null;
  trabajos: Trabajo[];
}
export interface DatosTransicion {
  nota?: string;
  pruebaSinConducir?: string;
  autorizacionNueva?: string;
  kmSalida?: number | null;
  garantiaHasta?: string | null;
  trabajos?: Trabajo[];
}
export type CodigoBloqueo = "PRESUPUESTO_NO_APROBADO" | "PRUEBA_RUTA_NO_AUTORIZADA" | "DATOS_ENTREGA" | "ORDEN_CERRADA";
export interface Bloqueo { codigo: CodigoBloqueo; mensaje: string }

export const MENSAJE_BLOQUEO: Record<CodigoBloqueo, string> = {
  PRESUPUESTO_NO_APROBADO: "El cliente pidió presupuesto previo y todavía no lo ha aprobado. Envía el presupuesto y espera la aprobación (por el portal o registrándola tú con una nota) antes de reparar.",
  PRUEBA_RUTA_NO_AUTORIZADA: "El cliente NO autorizó conducir el vehículo. Registra cómo lo vas a probar sin conducirlo, o la nueva autorización del cliente.",
  DATOS_ENTREGA: "Para entregar se necesitan el kilometraje de salida (no menor al de ingreso), los trabajos realizados y la fecha de garantía.",
  ORDEN_CERRADA: "La orden ya está cerrada. Solo el administrador puede reabrirla.",
};

/** ¿Qué hay que pedir antes de pasar a este estado? */
export function datosRequeridos(o: OrdenParaReglas, destino: EstadoOrden): "prueba" | "entrega" | null {
  if (destino === "en_prueba" && !o.autorizaPruebaRuta) return "prueba";
  if (destino === "entregado") return "entrega";
  return null;
}

export function revisarTransicion(o: OrdenParaReglas, destino: EstadoOrden, d: DatosTransicion = {}, opts: { esAdmin: boolean; hoy: string }): Bloqueo | null {
  const b = (codigo: CodigoBloqueo): Bloqueo => ({ codigo, mensaje: MENSAJE_BLOQUEO[codigo] });
  if ((o.estado === "entregado" || o.estado === "cancelado") && !opts.esAdmin) return b("ORDEN_CERRADA");
  if (o.autorizaPresupuestoPrevio) {
    if ((destino === "en_reparacion" || destino === "en_prueba") && o.presupuestoEstado !== "aprobado") return b("PRESUPUESTO_NO_APROBADO");
    if (destino === "listo" && o.presupuestoEstado === "pendiente") return b("PRESUPUESTO_NO_APROBADO");
  }
  if (destino === "en_prueba" && !o.autorizaPruebaRuta && (d.autorizacionNueva ?? "").trim().length < 5 && (d.pruebaSinConducir ?? "").trim().length < 5)
    return b("PRUEBA_RUTA_NO_AUTORIZADA");
  if (destino === "entregado") {
    const trabajos = d.trabajos ?? o.trabajos;
    if (d.kmSalida == null || d.kmSalida < (o.kmIngreso ?? 0) || !d.garantiaHasta || d.garantiaHasta < opts.hoy || !trabajos.length) return b("DATOS_ENTREGA");
  }
  return null;
}

/** Nota que queda en el historial cuando se prueba sin autorización de ruta. */
export function notaPrueba(d: DatosTransicion) {
  if ((d.autorizacionNueva ?? "").trim().length >= 5) return "Nueva autorización de prueba de ruta: " + d.autorizacionNueva!.trim();
  if ((d.pruebaSinConducir ?? "").trim().length >= 5) return "Prueba sin conducir: " + d.pruebaSinConducir!.trim();
  return d.nota;
}

/** Niveles del medidor de combustible (pasos de 1/8). */
export const nombreCombustible = (n: number) => {
  const octavos = Math.round(n * 8);
  return ({ 0: "Vacío", 2: "1/4", 4: "1/2", 6: "3/4", 8: "Lleno" } as Record<number, string>)[octavos] ?? `${octavos}/8`;
};
