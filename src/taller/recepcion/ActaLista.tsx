import { useState } from "react";
import { apiTaller } from "../datos/api";
import { Boton, Tarjeta } from "../../compartido/ui/base";
import { TALLER } from "../../compartido/config";
import { enlaceWhatsApp } from "../../compartido/util/mensajes";
import { celularE164 } from "../../compartido/util/validaciones";

export async function descargarActa(recepcionId: string) {
  const [{ generarPdfActa }, acta] = await Promise.all([import("./pdfActa"), apiTaller.acta(recepcionId)]);
  const blob = await generarPdfActa(acta);
  const nombre = `acta-${acta.vehiculo.placa}-${acta.fechaHora.slice(0, 10)}.pdf`;
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  // En el celular se puede compartir directo (WhatsApp, correo); si no, se descarga.
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: "Acta de ingreso" }); return; } catch { /* canceló: se descarga */ }
  }
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: nombre }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function mensajeRecibido(nombre: string, placa: string, codigo: string | null) {
  const primer = nombre.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0];
  return `Hola ${primer}, tu vehículo ${placa} quedó recibido en ${TALLER.nombre}. ` +
    (codigo ? `Puedes ver cómo va en ${location.origin}/consultar con el código ${codigo} y los últimos 4 dígitos de tu documento. ` : "") +
    "Te compartimos el acta de ingreso con las fotos y lo que acordamos.";
}

export default function ActaLista({ recepcionId, codigo, celular, nombre, placa, onSeguir }: { recepcionId: string; codigo: string | null; celular: string; nombre: string; placa: string; onSeguir: () => void }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="entrar mx-auto max-w-lg">
      <div className="mb-4 text-center">
        <div aria-hidden className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-ok-fondo text-3xl text-ok">✓</div>
        <h1 className="text-2xl font-bold">Acta guardada y firmada</h1>
        <p className="text-suave">{placa} ya está en el tablero de órdenes como «Recibido».</p>
      </div>
      <Tarjeta className="grid gap-2">
        <Boton disabled={generando} onClick={async () => { setGenerando(true); setError(""); try { await descargarActa(recepcionId); } catch { setError("No se pudo generar el PDF."); } finally { setGenerando(false); } }}>
          {generando ? "Generando PDF…" : "📄 Generar acta PDF"}
        </Boton>
        <a href={enlaceWhatsApp(celularE164(celular), mensajeRecibido(nombre, placa, codigo))} target="_blank" rel="noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1f7a43] px-4 font-bold text-white no-underline">💬 Enviar al cliente por WhatsApp</a>
        <p className="text-xs text-suave">El mensaje lleva el código para que el cliente consulte el estado. El PDF lo adjuntas tú en el chat (en el celular, «Generar acta PDF» abre la opción de compartir).</p>
        {error && <p role="alert" className="text-marca">{error}</p>}
        <Boton variante="secundario" onClick={onSeguir}>Ir al tablero de órdenes</Boton>
      </Tarjeta>
    </div>
  );
}
