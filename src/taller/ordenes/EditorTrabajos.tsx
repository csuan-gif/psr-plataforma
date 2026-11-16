import { useEffect, useState } from "react";
import { apiTaller } from "../datos/api";
import type { PlanMantenimiento } from "../datos/tipos";
import type { Trabajo } from "../util/reglasOrden";

export const TIPOS_TRABAJO: Record<Trabajo["tipo"], string> = {
  diagnostico: "Diagnóstico", correctivo: "Correctivo", preventivo: "Preventivo (mantenimiento)", latoneria: "Latonería y pintura", electrico: "Eléctrico / electrónico",
};

let cachePlanes: PlanMantenimiento[] | null = null;

/** Lista editable de trabajos. Si un trabajo es del plan de mantenimiento, genera recordatorio al entregar. */
export default function EditorTrabajos({ trabajos, onCambio, soloLectura }: { trabajos: Trabajo[]; onCambio: (t: Trabajo[]) => void; soloLectura?: boolean }) {
  const [planes, setPlanes] = useState<PlanMantenimiento[]>(cachePlanes ?? []);
  useEffect(() => { if (!cachePlanes) apiTaller.planes().then((p) => { cachePlanes = p; setPlanes(p); }).catch(() => {}); }, []);
  const cambiar = (i: number, t: Partial<Trabajo>) => onCambio(trabajos.map((x, j) => (j === i ? { ...x, ...t } : x)));

  return (
    <div>
      {trabajos.length === 0 && <p className="mb-2 text-sm text-suave">Sin trabajos registrados.</p>}
      <ul className="grid gap-2">
        {trabajos.map((t, i) => (
          <li key={i} className="grid gap-2 rounded-xl border border-borde p-2 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <input aria-label="Descripción del trabajo" className="campo" value={t.descripcion} disabled={soloLectura} placeholder="Ej.: cambio de pastillas delanteras" onChange={(e) => cambiar(i, { descripcion: e.target.value })} />
              <div className="grid gap-2 sm:grid-cols-3">
                <select aria-label="Tipo" className="campo" value={t.tipo} disabled={soloLectura} onChange={(e) => cambiar(i, { tipo: e.target.value as Trabajo["tipo"], planId: e.target.value === "preventivo" ? t.planId : null })}>
                  {Object.entries(TIPOS_TRABAJO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
                <input aria-label="Repuestos" className="campo" value={t.repuestos ?? ""} disabled={soloLectura} placeholder="Repuestos (opcional)" onChange={(e) => cambiar(i, { repuestos: e.target.value })} />
                {t.tipo === "preventivo" && (
                  <select aria-label="Servicio del plan de mantenimiento" className="campo" value={t.planId ?? ""} disabled={soloLectura}
                    onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; const pl = planes.find((p) => p.id === id); cambiar(i, { planId: id, descripcion: t.descripcion || pl?.servicio || "" }); }}>
                    <option value="">Sin recordatorio</option>
                    {planes.map((p) => <option key={p.id} value={p.id}>⏰ {p.servicio}</option>)}
                  </select>
                )}
              </div>
            </div>
            {!soloLectura && <button type="button" aria-label="Quitar trabajo" className="self-start rounded-lg border border-borde px-3 py-2 font-bold text-marca" onClick={() => onCambio(trabajos.filter((_, j) => j !== i))}>×</button>}
          </li>
        ))}
      </ul>
      {!soloLectura && (
        <button type="button" className="mt-2 min-h-11 rounded-xl border-2 border-dashed border-borde px-4 font-bold" onClick={() => onCambio([...trabajos, { descripcion: "", tipo: "correctivo" }])}>
          + Agregar trabajo
        </button>
      )}
    </div>
  );
}
