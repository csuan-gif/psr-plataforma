import { useEffect, useRef, useState } from "react";
import type { Adjunto } from "../../compartido/datos/tipos";
import { LIMITES, subir } from "./subida";

/** Nota de voz opcional de hasta 60 s ("cuéntanos cómo suena"). */
export default function NotaVoz({ borradorId, valor, onCambio }: { borradorId: string; valor: Adjunto | null; onCambio: (a: Adjunto | null) => void }) {
  const [estado, setEstado] = useState<"listo" | "grabando" | "subiendo" | "error">("listo");
  const [seg, setSeg] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const soportado = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => () => { window.clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  async function grabar() {
    setMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      const partes: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && partes.push(e.data);
      r.onstop = async () => {
        window.clearInterval(timer.current);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(partes, { type: r.mimeType || "audio/webm" });
        setUrl(URL.createObjectURL(blob));
        setEstado("subiendo");
        try {
          const ext = blob.type.includes("mp4") ? "m4a" : "webm";
          onCambio(await subir(borradorId, blob, `nota-voz.${ext}`, "audio", () => {}));
          setEstado("listo");
        } catch { setEstado("error"); setMsg("No se pudo subir la nota. Intenta otra vez."); }
      };
      rec.current = r;
      r.start();
      setSeg(0); setEstado("grabando");
      timer.current = window.setInterval(() => setSeg((s) => {
        if (s + 1 >= LIMITES.audioSegundos) r.state === "recording" && r.stop();
        return s + 1;
      }), 1000);
    } catch {
      setMsg("No pudimos usar el micrófono. Revisa el permiso del navegador o escribe la descripción.");
    }
  }

  if (!soportado) return null;
  return (
    <div className="mb-5">
      <p className="mb-1 font-bold">Nota de voz <span className="font-normal text-suave">(opcional)</span></p>
      <p className="mb-2 text-sm text-suave">Cuéntanos cómo suena o qué sientes. Máximo {LIMITES.audioSegundos} segundos.</p>
      {estado === "grabando" ? (
        <button type="button" onClick={() => rec.current?.stop()} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border-2 border-marca bg-marca-suave font-bold">
          <span className="h-3 w-3 animate-pulse rounded-full bg-marca" aria-hidden /> Grabando {seg} s · Toca para terminar
        </button>
      ) : valor || url ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-superficie p-3">
          {url ? <audio controls src={url} className="max-w-full" /> : <span>🎙 Nota de voz adjunta</span>}
          {estado === "subiendo" ? <span className="text-sm">Subiendo…</span> :
            <button type="button" className="font-bold text-marca underline" onClick={() => { onCambio(null); setUrl(null); }}>Borrar y grabar otra</button>}
        </div>
      ) : (
        <button type="button" onClick={grabar} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borde bg-superficie font-bold hover:border-marca">
          🎙 Grabar nota de voz
        </button>
      )}
      {msg && <p role="alert" className="mt-2 text-sm text-aviso">⚠ {msg}</p>}
    </div>
  );
}
