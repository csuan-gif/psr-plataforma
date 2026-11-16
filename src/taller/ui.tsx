import { useEffect, useRef, type ReactNode } from "react";
import type { Color } from "./datos/tipos";
import catalogo from "../compartido/catalogo/sintomas.json";

export const COLOR_INFO: Record<Color, { nombre: string; corto: string; clase: string; barra: string; orden: number }> = {
  rojo: { nombre: "Rojo · urgente", corto: "Urgente", clase: "bg-red-700 text-white", barra: "bg-red-600", orden: 0 },
  amarillo: { nombre: "Amarillo · diagnóstico", corto: "Diagnóstico", clase: "bg-yellow-300 text-black", barra: "bg-yellow-400", orden: 1 },
  verde: { nombre: "Verde · información", corto: "Información", clase: "bg-green-700 text-white", barra: "bg-green-600", orden: 2 },
};

export function ChipColor({ color, ajustado }: { color: Color; ajustado?: boolean }) {
  const c = COLOR_INFO[color];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ${c.clase}`}>
      <span aria-hidden>{color === "rojo" ? "●" : color === "amarillo" ? "▲" : "■"}</span>
      {c.corto}{ajustado && <span title="Cambiado a mano por el taller"> ✎</span>}
    </span>
  );
}

const SINT = new Map(catalogo.sintomas.map((s) => [s.id, s.etiqueta]));
const ZON = new Map(catalogo.zonas.map((z) => [z.id, z.nombre]));
export const nombreSintoma = (id: string) => SINT.get(id) ?? id;
export const nombreZona = (id: string) => ZON.get(id) ?? id;
export const MOVILIDAD: Record<string, string> = { si: "Sí se moviliza", no: "NO se moviliza", nose: "No sabe si se moviliza" };
export const ESTADO_CITA: Record<string, string> = {
  pendiente: "Pendiente de confirmar", confirmada: "Confirmada", reprogramada: "Reprogramada (avisar)", cancelada: "Cancelada", no_asistio: "No asistió",
};

/** Diálogo accesible (cierra con Esc, enfoca el contenido). */
export function Dialogo({ titulo, abierto, onCerrar, children, ancho = "max-w-lg" }: { titulo: string; abierto: boolean; onCerrar: () => void; children: ReactNode; ancho?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} onClose={onCerrar} onCancel={onCerrar} aria-label={titulo}
      className={`m-auto w-[calc(100%-1.5rem)] ${ancho} rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/50`}>
      {abierto && (
        <div className="max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold">{titulo}</h2>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-borde text-xl">×</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
