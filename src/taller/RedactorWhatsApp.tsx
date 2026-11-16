import { useEffect, useState } from "react";
import { apiTaller } from "./datos/api";
import type { Plantillas } from "./datos/tipos";
import { llenarPlantilla, NOMBRES_PLANTILLA, PLANTILLAS_BASE, revisarPlantilla, type DatosMensaje } from "./util/plantillas";
import { enlaceWhatsApp } from "../compartido/util/mensajes";
import { celularE164 } from "../compartido/util/validaciones";

/** Mensaje prellenado y editable; sale por un enlace wa.me (sin API de WhatsApp Business). */
export default function RedactorWhatsApp({ celular, datos, inicial = "recibida" }: { celular: string; datos: DatosMensaje; inicial?: keyof Plantillas }) {
  const [plantillas, setPlantillas] = useState<Plantillas>(PLANTILLAS_BASE);
  const [tipo, setTipo] = useState<keyof Plantillas>(inicial);
  const [texto, setTexto] = useState(llenarPlantilla(PLANTILLAS_BASE[inicial], datos));
  useEffect(() => { apiTaller.plantillas().then((p) => { setPlantillas(p); setTexto(llenarPlantilla(p[inicial], datos)); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTipo(inicial); setTexto(llenarPlantilla(plantillas[inicial], datos)); }, [inicial, datos.fecha, datos.franja]); // eslint-disable-line react-hooks/exhaustive-deps
  const aviso = revisarPlantilla(texto);

  return (
    <div className="rounded-xl border border-borde p-3">
      <label htmlFor="tipo-msg" className="mb-1 block text-sm font-bold">Mensaje de WhatsApp</label>
      <select id="tipo-msg" className="campo mb-2" value={tipo} onChange={(e) => { const k = e.target.value as keyof Plantillas; setTipo(k); setTexto(llenarPlantilla(plantillas[k], datos)); }}>
        {(Object.keys(NOMBRES_PLANTILLA) as (keyof Plantillas)[]).map((k) => <option key={k} value={k}>{NOMBRES_PLANTILLA[k]}</option>)}
      </select>
      <textarea aria-label="Texto del mensaje" className="campo min-h-28" value={texto} onChange={(e) => setTexto(e.target.value)} />
      {aviso && <p role="status" className="mt-1 rounded-lg bg-aviso-fondo px-3 py-1.5 text-sm text-aviso">⚠ {aviso}</p>}
      <a href={enlaceWhatsApp(celularE164(celular), texto)} target="_blank" rel="noreferrer"
        className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1f7a43] px-4 font-bold text-white no-underline">
        💬 Abrir WhatsApp con este mensaje
      </a>
      <p className="mt-1 text-xs text-suave">Se abre WhatsApp con el texto listo; tú decides si lo envías.</p>
    </div>
  );
}
