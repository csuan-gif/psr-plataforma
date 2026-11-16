import type { KeyboardEvent, PointerEvent } from "react";
import { nombreCombustible } from "../util/reglasOrden";

/** Medidor tipo aguja: Vacío · 1/4 · 1/2 · 3/4 · Lleno, en pasos de 1/8. Se toca, se arrastra o se usa con las flechas. */
export default function MedidorCombustible({ valor, onCambio }: { valor: number | null; onCambio: (v: number) => void }) {
  const v = valor ?? 0;
  const angulo = -90 + v * 180; // -90° = vacío, +90° = lleno
  const fijar = (n: number) => onCambio(Math.min(8, Math.max(0, Math.round(n))) / 8);

  function desdePuntero(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = (r.top + r.height * 0.85) - e.clientY;
    const a = Math.atan2(x, Math.max(y, 0.01)); // -π/2 … π/2
    fijar(((a + Math.PI / 2) / Math.PI) * 8);
  }
  function tecla(e: KeyboardEvent) {
    const o = Math.round(v * 8);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); fijar(o + 1); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); fijar(o - 1); }
    if (e.key === "Home") fijar(0);
    if (e.key === "End") fijar(8);
  }

  const marcas = Array.from({ length: 9 }, (_, i) => {
    const a = ((-90 + i * 22.5) * Math.PI) / 180;
    const largo = i % 2 === 0 ? 18 : 10;
    return { i, x1: 100 + Math.sin(a) * 80, y1: 110 - Math.cos(a) * 80, x2: 100 + Math.sin(a) * (80 - largo), y2: 110 - Math.cos(a) * (80 - largo) };
  });

  return (
    <div>
      <div role="slider" tabIndex={0} aria-label="Nivel de combustible" aria-valuemin={0} aria-valuemax={8} aria-valuenow={Math.round(v * 8)}
        aria-valuetext={valor === null ? "Sin marcar" : nombreCombustible(v)} onKeyDown={tecla}
        className="mx-auto max-w-xs rounded-2xl outline-offset-4">
        <svg viewBox="0 0 200 130" className="w-full touch-none select-none" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); desdePuntero(e); }}
          onPointerMove={(e) => e.buttons && desdePuntero(e)}>
          <defs>
            <linearGradient id="grad-comb" x1="0" x2="1"><stop offset="0" stopColor="#dc2626" /><stop offset="0.3" stopColor="#eab308" /><stop offset="1" stopColor="#16a34a" /></linearGradient>
          </defs>
          <path d="M20 110 A80 80 0 0 1 180 110" fill="none" stroke="url(#grad-comb)" strokeWidth="14" strokeLinecap="round" opacity="0.85" />
          {marcas.map((m) => <line key={m.i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="var(--texto)" strokeWidth={m.i % 2 === 0 ? 3 : 1.5} />)}
          {[["E", 0], ["1/4", 2], ["1/2", 4], ["3/4", 6], ["F", 8]].map(([t, i]) => {
            const a = ((-90 + (i as number) * 22.5) * Math.PI) / 180;
            return <text key={t} x={100 + Math.sin(a) * 52} y={114 - Math.cos(a) * 52} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--suave)">{t}</text>;
          })}
          <g style={{ transform: `rotate(${angulo}deg)`, transformOrigin: "100px 110px", transition: "transform .35s cubic-bezier(.3,1.4,.5,1)" }}>
            <line x1="100" y1="110" x2="100" y2="40" stroke={valor === null ? "var(--borde)" : "var(--marca)"} strokeWidth="4" strokeLinecap="round" />
          </g>
          <circle cx="100" cy="110" r="8" fill="var(--texto)" />
          <text x="100" y="128" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--texto)">⛽ {valor === null ? "Toca para marcar" : nombreCombustible(v)}</text>
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <button type="button" className="campo !w-14 font-bold" aria-label="Bajar un octavo" onClick={() => fijar(Math.round(v * 8) - 1)}>−</button>
        {[0, 2, 4, 6, 8].map((o) => (
          <button key={o} type="button" onClick={() => fijar(o)} aria-pressed={valor !== null && Math.round(v * 8) === o}
            className={`min-h-10 rounded-lg border-2 px-2 text-sm font-bold ${valor !== null && Math.round(v * 8) === o ? "border-marca bg-marca-suave" : "border-borde"}`}>
            {nombreCombustible(o / 8)}
          </button>
        ))}
        <button type="button" className="campo !w-14 font-bold" aria-label="Subir un octavo" onClick={() => fijar(Math.round(v * 8) + 1)}>+</button>
      </div>
    </div>
  );
}
