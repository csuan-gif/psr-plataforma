import type { RecordatorioTaller } from "../datos/tipos";
import { TALLER } from "../../compartido/config";
import { cuandoTexto } from "../../compartido/util/mantenimiento";
import { fechaLarga, hoyBogota } from "../../compartido/util/fechas";

/** Mensaje cálido, sin precios ni tiempos de reparación, con enlace para agendar con datos precargados. */
export function mensajeRecordatorio(r: RecordatorioTaller, origen = location.origin, hoy = hoyBogota()) {
  const n = r.cliente.nombre.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0];
  const veh = `${[r.vehiculo.marca, r.vehiculo.linea].filter(Boolean).join(" ")} (${r.vehiculo.placa})`;
  const enlace = `${origen}/solicitar?r=${r.token}`;
  const cuerpo = r.tipo === "mantenimiento"
    ? `según nuestros registros, a tu ${veh} le corresponde ${r.servicio.toLowerCase()}${r.fechaObjetivo ? ` ${r.fechaObjetivo <= hoy ? "ya" : "aproximadamente " + cuandoTexto(r.fechaObjetivo, hoy)}` : ""}${r.kmEstimado ? ` (alrededor de los ${r.kmEstimado.toLocaleString("es-CO")} km)` : ""}. Hacerlo a tiempo cuida tu carro y tu bolsillo.`
    : `te recordamos que el ${r.servicio.replace(/^Vencimiento (del |de la )?/i, "").toLowerCase()} de tu ${veh} vence el ${r.fechaEstimada ? fechaLarga(r.fechaEstimada) : "pronto"}. Si quieres, te ayudamos con una revisión previa.`;
  const privacidad = r.cliente.autorizaDatos ? "" : ` Tratamos tus datos según nuestro aviso de privacidad: ${origen}/privacidad.`;
  return `Hola ${n}, te saluda ${TALLER.nombre}. ${cuerpo[0].toUpperCase()}${cuerpo.slice(1)} Puedes apartar tu cita aquí: ${enlace} o respondernos por este chat.${privacidad} Si no quieres recibir estos recordatorios, respóndenos NO. ¡Un abrazo!`;
}

