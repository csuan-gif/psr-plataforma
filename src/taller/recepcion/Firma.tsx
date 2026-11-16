import { useEffect, useRef, useState, type PointerEvent } from "react";

/** Firma en pantalla con el dedo o el mouse. Entrega un PNG al terminar. */
export default function Firma({ onCambio }: { onCambio: (png: Blob | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacia, setVacia] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ajustar = () => {
      const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr; c.height = r.height * dpr;
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr); ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, r.width, r.height);
      setVacia(true); onCambio(null);
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const punto = (e: PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const inicio = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId); dibujando.current = true;
    const ctx = e.currentTarget.getContext("2d")!; const [x, y] = punto(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
  };
  const mover = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const ctx = e.currentTarget.getContext("2d")!; const [x, y] = punto(e); ctx.lineTo(x, y); ctx.stroke();
  };
  const fin = () => {
    if (!dibujando.current) return;
    dibujando.current = false; setVacia(false);
    ref.current!.toBlob((b) => onCambio(b), "image/png");
  };
  const borrar = () => {
    const c = ref.current!, r = c.getBoundingClientRect(), ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, r.width, r.height); setVacia(true); onCambio(null);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border-2 border-borde bg-white">
        <canvas ref={ref} aria-label="Espacio para la firma del cliente" className="block h-44 w-full touch-none"
          onPointerDown={inicio} onPointerMove={mover} onPointerUp={fin} onPointerLeave={fin} onPointerCancel={fin} />
        {vacia && <span className="pointer-events-none absolute inset-0 grid place-items-center text-gray-400">Firma aquí con el dedo</span>}
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-gray-300" aria-hidden />
      </div>
      <button type="button" onClick={borrar} className="mt-1 text-sm font-bold text-marca underline">Borrar firma</button>
    </div>
  );
}
