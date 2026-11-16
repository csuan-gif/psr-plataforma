import { useEffect, useState } from "react";
import { almacen } from "../util/almacen";

type Tema = "sistema" | "claro" | "oscuro";
const CLAVE = "psr-tema";
const SIGUIENTE: Record<Tema, Tema> = { sistema: "claro", claro: "oscuro", oscuro: "sistema" };
const ICONO: Record<Tema, string> = { sistema: "🌓", claro: "☀️", oscuro: "🌙" };
const NOMBRE: Record<Tema, string> = { sistema: "según el celular", claro: "claro", oscuro: "oscuro" };

export function aplicarTema(t: Tema = almacen.leer<Tema>(CLAVE, "sistema")) {
  if (t === "sistema") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = t;
}

/** Botón que alterna entre tema del sistema, claro y oscuro (se recuerda en este dispositivo). */
export function BotonTema({ className = "" }: { className?: string }) {
  const [t, setT] = useState<Tema>(() => almacen.leer<Tema>(CLAVE, "sistema"));
  useEffect(() => { aplicarTema(t); almacen.guardar(CLAVE, t); }, [t]);
  return (
    <button type="button" onClick={() => setT(SIGUIENTE[t])} className={`grid h-10 w-10 place-items-center rounded-lg border border-borde ${className}`}
      aria-label={`Tema: ${NOMBRE[t]}. Cambiar a ${NOMBRE[SIGUIENTE[t]]}`} title={`Tema ${NOMBRE[t]}`}>
      <span aria-hidden>{ICONO[t]}</span>
    </button>
  );
}

/** Enlace para saltar al contenido con el teclado (visible solo al enfocarlo). */
export function SaltarAlContenido() {
  return (
    <a href="#contenido" className="sr-only z-50 rounded-lg bg-marca px-4 py-2 font-bold text-sobre-marca focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
      Saltar al contenido
    </a>
  );
}
