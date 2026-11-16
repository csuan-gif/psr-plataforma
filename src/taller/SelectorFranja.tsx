import { useEffect, useState } from "react";
import { apiTaller } from "./datos/api";
import type { CupoTaller } from "./datos/tipos";
import { FRANJAS, type Franja } from "../compartido/config";
import { fechaLarga, hoyBogota, sumarDias } from "../compartido/util/fechas";
import { Boton } from "../compartido/ui/base";

/** Elegir día y franja viendo los cupos usados/libres. Permite sobrecupo solo de forma explícita. */
export default function SelectorFranja({ textoBoton, onElegir, ocupado }: {
  textoBoton: string; ocupado?: boolean; onElegir: (fecha: string, franja: Franja, forzar: boolean) => void;
}) {
  const [cupos, setCupos] = useState<CupoTaller[] | null>(null);
  const [sel, setSel] = useState<{ fecha: string; franja: Franja } | null>(null);
  const [forzar, setForzar] = useState(false);
  const desde = hoyBogota();
  useEffect(() => { apiTaller.cupos(desde, sumarDias(desde, 30)).then(setCupos).catch(() => setCupos([])); }, [desde]);

  if (!cupos) return <p className="text-suave">Cargando cupos…</p>;
  const dias = [...new Set(cupos.map((c) => c.fecha))];
  const elegido = sel && cupos.find((c) => c.fecha === sel.fecha && c.franja === sel.franja);
  const lleno = !!elegido && (elegido.usados >= elegido.cupos || !!elegido.motivo);

  return (
    <div>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-borde">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-superficie"><tr><th className="p-2 text-left">Día</th><th className="p-2">Mañana</th><th className="p-2">Tarde</th></tr></thead>
          <tbody>
            {dias.map((f) => (
              <tr key={f} className="border-t border-borde">
                <td className="p-2 first-letter:uppercase">{fechaLarga(f)}</td>
                {(["manana", "tarde"] as Franja[]).map((fr) => {
                  const c = cupos.find((x) => x.fecha === f && x.franja === fr)!;
                  const libres = c.cupos - c.usados;
                  const activo = sel?.fecha === f && sel.franja === fr;
                  return (
                    <td key={fr} className="p-1 text-center">
                      <button type="button" aria-pressed={activo} onClick={() => { setSel({ fecha: f, franja: fr }); setForzar(false); }}
                        title={c.motivo ?? `${c.usados} de ${c.cupos} cupos usados`}
                        className={`min-h-10 w-full rounded-lg border-2 px-1 ${activo ? "border-marca bg-marca-suave font-bold" : c.motivo || c.cupos === 0 ? "border-transparent text-suave opacity-60" : libres > 0 ? "border-borde" : "border-borde bg-aviso-fondo text-aviso"}`}>
                        {c.motivo ? (c.motivo.startsWith("Festivo") ? "Festivo" : "Cerrado") : c.cupos === 0 ? "—" : `${c.usados}/${c.cupos}`}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-suave">Cada casilla muestra cupos usados / cupos de la franja.</p>
      {sel && (
        <div className="mt-3 grid gap-2">
          <p className="first-letter:uppercase"><strong>{fechaLarga(sel.fecha)}</strong>, {FRANJAS[sel.franja].nombre.toLowerCase()} ({FRANJAS[sel.franja].horas})</p>
          {lleno && (
            <label className="flex items-start gap-2 rounded-lg bg-aviso-fondo p-2 text-aviso">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
              <span>{elegido?.motivo ? `Esta franja está marcada como «${elegido.motivo}».` : "Esta franja ya está llena."} Marca aquí si de verdad quieres agendar un cupo extra.</span>
            </label>
          )}
          <Boton disabled={ocupado || (lleno && !forzar)} onClick={() => onElegir(sel.fecha, sel.franja, forzar)}>{textoBoton}</Boton>
        </div>
      )}
    </div>
  );
}
