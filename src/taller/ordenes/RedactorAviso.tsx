import { useState } from "react";
import type { OrdenTaller } from "../datos/tipos";
import { mensajeEstado } from "./DetalleOrden";
import { enlaceWhatsApp } from "../../compartido/util/mensajes";
import { celularE164 } from "../../compartido/util/validaciones";

/** Aviso prellenado al cliente cuando la orden cambia de estado (sale por wa.me). */
export default function RedactorAviso({ orden }: { orden: OrdenTaller }) {
  const [texto, setTexto] = useState(mensajeEstado(orden));
  return (
    <div>
      <label htmlFor="aviso-cliente" className="mb-1 block font-bold">¿Le avisas al cliente?</label>
      <textarea id="aviso-cliente" className="campo min-h-28" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <a href={enlaceWhatsApp(celularE164(orden.cliente.celular), texto)} target="_blank" rel="noreferrer"
        className="mt-2 flex min-h-12 items-center justify-center rounded-xl bg-[#1f7a43] px-4 font-bold text-white no-underline">💬 Abrir WhatsApp con este mensaje</a>
    </div>
  );
}
