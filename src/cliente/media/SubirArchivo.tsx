import { useId, useRef, useState } from "react";
import type { Adjunto } from "../../compartido/datos/tipos";
import { LIMITES, duracionVideo, mb, subir } from "./subida";

interface Carga {
  clave: string; nombre: string; tipo: Adjunto["tipo"]; progreso: number;
  estado: "subiendo" | "error"; archivo: File; vista?: string; mensaje?: string;
}

/** Carga de fotos y videos desde la cámara o la galería, con progreso y reintento. */
export function SubirMultiple({ borradorId, valor, onCambio }: { borradorId: string; valor: Adjunto[]; onCambio: (f: (a: Adjunto[]) => Adjunto[]) => void }) {
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [vistas, setVistas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();

  const actualizar = (clave: string, c: Partial<Carga>) => setCargas((l) => l.map((x) => (x.clave === clave ? { ...x, ...c } : x)));

  async function procesar(c: Carga) {
    actualizar(c.clave, { estado: "subiendo", progreso: 0, mensaje: undefined });
    try {
      const a = await subir(borradorId, c.archivo, c.nombre, c.tipo, (p) => actualizar(c.clave, { progreso: p }));
      if (c.vista) setVistas((v) => ({ ...v, [a.ruta]: c.vista! }));
      onCambio((l) => [...l, a]);
      setCargas((l) => l.filter((x) => x.clave !== c.clave));
    } catch {
      actualizar(c.clave, { estado: "error", mensaje: "No se pudo subir. Revisa tu señal." });
    }
  }

  async function elegir(files: FileList | null) {
    setAviso("");
    if (!files) return;
    const libres = LIMITES.maxArchivos - valor.length - cargas.length;
    for (const f of Array.from(files).slice(0, Math.max(0, libres))) {
      const esVideo = f.type.startsWith("video/");
      if (!esVideo && !f.type.startsWith("image/")) { setAviso("Solo fotos o videos."); continue; }
      if (esVideo) {
        if (f.size > LIMITES.videoMB * 1024 * 1024) { setAviso(`El video pesa ${mb(f.size)}. El máximo es ${LIMITES.videoMB} MB: grábalo más corto.`); continue; }
        const d = await duracionVideo(f);
        if (d > LIMITES.videoSegundos + 1) { setAviso(`El video dura ${Math.round(d)} s. Graba uno de máximo ${LIMITES.videoSegundos} s.`); continue; }
      }
      const c: Carga = { clave: crypto.randomUUID(), nombre: f.name || (esVideo ? "video.mp4" : "foto.jpg"), tipo: esVideo ? "video" : "foto", progreso: 0, estado: "subiendo", archivo: f, vista: esVideo ? undefined : URL.createObjectURL(f) };
      setCargas((l) => [...l, c]);
      void procesar(c);
    }
    if (Array.from(files).length > libres) setAviso(`Puedes adjuntar hasta ${LIMITES.maxArchivos} archivos.`);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="mb-5">
      <p className="mb-1 font-bold">Fotos o video <span className="font-normal text-suave">(opcional)</span></p>
      <p className="mb-2 text-sm text-suave">En latonería y pintura un video ayuda mucho a cotizar. Máximo {LIMITES.videoSegundos} segundos por video.</p>
      <label htmlFor={id} className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borde bg-superficie px-4 font-bold hover:border-marca">
        📷 Tomar o elegir fotos / video
      </label>
      <input id={id} ref={ref} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => elegir(e.target.files)} />
      {aviso && <p role="status" className="mt-2 rounded-lg bg-aviso-fondo px-3 py-1.5 text-sm text-aviso">⚠ {aviso}</p>}

      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-live="polite">
        {valor.map((a) => (
          <li key={a.ruta} className="relative overflow-hidden rounded-xl border border-borde bg-superficie">
            {vistas[a.ruta] ? <img src={vistas[a.ruta]} alt={`Adjunto: ${a.nombre}`} className="aspect-square w-full object-cover" />
              : <div className="flex aspect-square items-center justify-center p-1 text-center text-xs">{a.tipo === "video" ? "🎬" : "🖼"} {a.nombre}</div>}
            <button type="button" aria-label={`Quitar ${a.nombre}`} onClick={() => onCambio((l) => l.filter((x) => x.ruta !== a.ruta))}
              className="absolute right-1 top-1 h-8 w-8 rounded-full bg-black/70 font-bold text-white">×</button>
          </li>
        ))}
        {cargas.map((c) => (
          <li key={c.clave} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-borde bg-superficie p-2 text-center text-xs">
            <span className="line-clamp-2 break-all">{c.nombre}</span>
            {c.estado === "subiendo" ? (
              <div className="h-2 w-full overflow-hidden rounded bg-borde" role="progressbar" aria-valuenow={c.progreso} aria-valuemin={0} aria-valuemax={100} aria-label={`Subiendo ${c.nombre}`}>
                <div className="h-full bg-marca transition-all" style={{ width: c.progreso + "%" }} />
              </div>
            ) : (
              <>
                <span className="text-aviso">{c.mensaje}</span>
                <div className="flex gap-1">
                  <button type="button" className="rounded-lg border border-borde px-2 py-1 font-bold" onClick={() => procesar(c)}>Reintentar</button>
                  <button type="button" aria-label="Descartar" className="rounded-lg border border-borde px-2 py-1" onClick={() => setCargas((l) => l.filter((x) => x.clave !== c.clave))}>×</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Un solo archivo (ej. foto de la tarjeta de propiedad). */
export default function SubirArchivo({ borradorId, tipo, etiqueta, acepta, valor, onCambio }: {
  borradorId: string; tipo: Adjunto["tipo"]; etiqueta: string; acepta: string; valor: Adjunto | null; onCambio: (a: Adjunto | null) => void;
}) {
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState("");
  const id = useId();
  async function elegir(f?: File) {
    if (!f) return;
    setError(""); setProgreso(0);
    try { onCambio(await subir(borradorId, f, f.name || "tarjeta.jpg", tipo, setProgreso)); }
    catch { setError("No se pudo subir. Intenta de nuevo."); }
    finally { setProgreso(null); }
  }
  return (
    <div className="mb-4">
      {valor ? (
        <div className="flex items-center justify-between rounded-xl border-2 border-ok bg-ok-fondo px-4 py-3 text-ok">
          <span>✓ Foto de la tarjeta adjunta</span>
          <button type="button" className="font-bold underline" onClick={() => onCambio(null)}>Quitar</button>
        </div>
      ) : (
        <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-borde bg-superficie px-4 font-bold hover:border-marca">
          {progreso !== null ? `Subiendo… ${progreso}%` : etiqueta}
        </label>
      )}
      <input id={id} type="file" accept={acepta} className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
      {error && <p role="alert" className="mt-1 text-sm text-aviso">⚠ {error}</p>}
    </div>
  );
}
