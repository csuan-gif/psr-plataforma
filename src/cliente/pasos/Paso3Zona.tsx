import { useState } from "react";
import type { PropsPaso } from "./Paso1Datos";
import type { ZonaCat } from "../../compartido/datos/tipos";
import { VistaLateral, VistaSuperior } from "./MapaVehiculo";

export default function Paso3Zona({ b, set, zonas }: PropsPaso & { zonas: ZonaCat[] }) {
  const [vista, setVista] = useState<"superior" | "lateral">("superior");
  const nombres = Object.fromEntries(zonas.map((z) => [z.id, z.nombre]));
  const toggle = (id: string) =>
    set((x) => {
      const activo = x.zonas.includes(id);
      return {
        ...x,
        zonas: activo ? x.zonas.filter((z) => z !== id) : [...x.zonas, id],
        // Al quitar una zona se quitan sus síntomas (los generales se conservan).
        sintomas: activo ? x.sintomas.filter((s) => !s.startsWith(id + ".")) : x.sintomas,
      };
    });
  const props = { seleccion: b.zonas, onToggle: toggle, nombres };
  const mapa = zonas.filter((z) => z.id !== "general" && z.id !== "nose");

  return (
    <>
      <h2 className="mb-1 text-2xl font-bold">¿Dónde está el problema?</h2>
      <p className="mb-3 text-suave">Toca una o varias partes del carro. Si no sabes, elige «No sé».</p>

      <div role="tablist" aria-label="Vista del vehículo" className="mb-3 inline-flex rounded-xl border border-borde bg-superficie p-1">
        {(["superior", "lateral"] as const).map((v) => (
          <button key={v} role="tab" type="button" aria-selected={vista === v} onClick={() => setVista(v)}
            className={`min-h-10 rounded-lg px-4 font-bold ${vista === v ? "bg-marca text-sobre-marca" : ""}`}>
            {v === "superior" ? "Desde arriba" : "De lado"}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-borde bg-fondo p-2">
        {vista === "superior" ? <VistaSuperior {...props} /> : <VistaLateral {...props} />}
      </div>

      <p className="mb-2 text-sm font-bold text-suave">También puedes elegir aquí:</p>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {mapa.map((z) => (
          <button key={z.id} type="button" aria-pressed={b.zonas.includes(z.id)} onClick={() => toggle(z.id)}
            className={`min-h-12 rounded-xl border-2 px-3 py-2 text-left text-sm leading-tight transition ${b.zonas.includes(z.id) ? "border-marca bg-marca-suave font-bold" : "border-borde bg-superficie hover:border-marca"}`}>
            {b.zonas.includes(z.id) && "✓ "}{z.nombre}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {["general", "nose"].map((id) => {
          const z = zonas.find((x) => x.id === id);
          if (!z) return null;
          const activo = b.zonas.includes(id);
          return (
            <button key={id} type="button" aria-pressed={activo} onClick={() => toggle(id)}
              className={`min-h-14 rounded-xl border-2 px-4 py-2 text-left transition ${activo ? "border-marca bg-marca-suave" : "border-borde bg-superficie hover:border-marca"}`}>
              <span className="block font-bold">{activo && "✓ "}{z.nombre}</span>
              <span className="text-sm text-suave">{z.ayuda}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
