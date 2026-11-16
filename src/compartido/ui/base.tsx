import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TALLER } from "../config";
import { BotonTema, SaltarAlContenido } from "./Tema";

type Variante = "primario" | "secundario" | "fantasma";
const CLASES: Record<Variante, string> = {
  primario: "bg-marca text-sobre-marca hover:bg-marca-hover border-transparent",
  secundario: "bg-superficie text-texto border-borde hover:border-marca",
  fantasma: "bg-transparent text-marca border-transparent underline-offset-4 hover:underline",
};

export function Boton({ variante = "primario", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-5 py-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${CLASES[variante]} ${className}`}
    />
  );
}

export function Campo({ etiqueta, opcional, aviso, ayuda, children, id }: {
  etiqueta: string; opcional?: boolean; aviso?: string | null; ayuda?: string; id: string; children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block font-bold">
        {etiqueta} {opcional && <span className="font-normal text-suave">(opcional)</span>}
      </label>
      {ayuda && <p id={id + "-ayuda"} className="mb-1 text-sm text-suave">{ayuda}</p>}
      {children}
      {aviso && <p id={id + "-aviso"} role="status" className="mt-1 rounded-lg bg-aviso-fondo px-3 py-1.5 text-sm text-aviso">⚠ {aviso}</p>}
    </div>
  );
}

/** Botón de opción tipo "chip" (selección única o múltiple). */
export function Opcion({ activo, onClick, children, className = "" }: { activo: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-12 rounded-xl border-2 px-4 py-2 text-left transition ${activo ? "border-marca bg-marca-suave font-bold" : "border-borde bg-superficie hover:border-marca"} ${className}`}
    >
      {activo && <span aria-hidden className="mr-1">✓</span>}
      {children}
    </button>
  );
}

export function Grupo({ titulo, children, opcional }: { titulo: string; children: ReactNode; opcional?: boolean }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="mb-5">
      <p id={id} className="mb-2 font-bold">{titulo} {opcional && <span className="font-normal text-suave">(opcional)</span>}</p>
      {children}
    </div>
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-borde bg-superficie p-4 shadow-sm sm:p-6 ${className}`}>{children}</div>;
}

export function Aviso({ tono = "aviso", children }: { tono?: "aviso" | "ok" | "marca"; children: ReactNode }) {
  const c = tono === "ok" ? "bg-ok-fondo text-ok" : tono === "marca" ? "bg-marca-suave text-texto border-l-4 border-marca" : "bg-aviso-fondo text-aviso";
  return <div role="note" className={`rounded-xl px-4 py-3 ${c}`}>{children}</div>;
}

export function Marco({ children, titulo }: { children: ReactNode; titulo?: string }) {
  return (
    <div className="min-h-dvh">
      <SaltarAlContenido />
      <header className="sticky top-0 z-20 border-b border-borde bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 font-bold no-underline text-texto">
            <img src="/icono.svg" alt="" width={32} height={32} />
            <span>{TALLER.nombre}</span>
          </Link>
          <span className="flex items-center gap-2">
            {titulo && <span className="hidden text-sm text-suave sm:inline">{titulo}</span>}
            <BotonTema />
          </span>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-2xl px-4 pb-28 pt-4 outline-none">{children}</main>
    </div>
  );
}
