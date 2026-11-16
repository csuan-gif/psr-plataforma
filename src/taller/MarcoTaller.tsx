import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { usePanel } from "./contexto";
import { pedirPermiso, permisoNotificaciones, preferencias } from "./avisos";
import { ES_DEMO } from "../compartido/config";
import { esIOS, instalar, usarInstalable, yaInstalada } from "../compartido/util/instalar";
import { BotonTema, SaltarAlContenido } from "../compartido/ui/Tema";

const PESTANAS = [
  { a: "/taller", t: "Inicio", i: "🏠", fin: true },
  { a: "/taller/bandeja", t: "Bandeja", i: "📥" },
  { a: "/taller/agenda", t: "Agenda", i: "📅" },
  { a: "/taller/ordenes", t: "Órdenes", i: "🔧" },
  { a: "/taller/clientes", t: "Clientes", i: "👥", mas: true },
  { a: "/taller/mantenimiento", t: "Mantenimiento", i: "⏰", mas: true },
  { a: "/taller/configuracion", t: "Ajustes", i: "⚙️", mas: true },
];

export default function MarcoTaller({ children }: { children: ReactNode }) {
  const { usuario, salir, noVistas, otros } = usePanel();
  const [permiso, setPermiso] = useState(permisoNotificaciones());
  const [sonido, setSonido] = useState(preferencias.sonido());
  const enLinea = otros.filter((o) => o.nombre);
  const [mas, setMas] = useState(false);
  const instalable = usarInstalable();
  const [ayudaIOS, setAyudaIOS] = useState(false);
  const loc = useLocation();
  const enMas = PESTANAS.some((p) => p.mas && loc.pathname.startsWith(p.a));

  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <SaltarAlContenido />
      <header className="sticky top-0 z-20 border-b border-borde bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <span className="flex items-center gap-2 font-bold"><img src="/icono.svg" alt="" width={28} height={28} /> Taller PSR</span>
          {ES_DEMO && <span className="rounded bg-aviso-fondo px-2 text-xs font-bold text-aviso">DEMO</span>}
          <nav aria-label="Secciones del panel" className="order-last hidden w-full gap-1 sm:order-none sm:flex sm:w-auto">
            {PESTANAS.map((p) => (
              <NavLink key={p.a} to={p.a} end={p.fin}
                className={({ isActive }) => `relative rounded-lg px-3 py-2 font-bold no-underline ${isActive ? "bg-marca text-sobre-marca" : "text-texto hover:bg-marca-suave"}`}>
                {p.t}
                {p.t === "Bandeja" && noVistas.size > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white" aria-label={`${noVistas.size} nuevas`}>{noVistas.size}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {enLinea.length > 0 && <span className="hidden text-suave md:inline" title={enLinea.map((o) => o.nombre).join(", ")}>🟢 {enLinea.length} más en línea</span>}
            <BotonTema />
            <button type="button" className="rounded-lg border border-borde px-2 py-1" aria-pressed={sonido}
              onClick={() => { preferencias.setSonido(!sonido); setSonido(!sonido); }} title="Sonido al llegar solicitudes">{sonido ? "🔔" : "🔕"}</button>
            {permiso === "default" && (
              <button type="button" className="rounded-lg border border-marca px-2 py-1 font-bold text-marca" onClick={async () => setPermiso(await pedirPermiso())}>Activar avisos</button>
            )}
            {instalable && <button type="button" className="rounded-lg border border-marca px-2 py-1 font-bold text-marca" onClick={() => void instalar()}>📲 Instalar app</button>}
            {!instalable && esIOS() && !yaInstalada() && <button type="button" className="rounded-lg border border-marca px-2 py-1 font-bold text-marca" onClick={() => setAyudaIOS(!ayudaIOS)}>📲 Instalar</button>}
            <span className="hidden font-bold sm:inline">{usuario.nombre}</span>
            <button type="button" className="rounded-lg border border-borde px-2 py-1" onClick={salir}>Salir</button>
          </div>
        </div>
      </header>
      {ayudaIOS && (
        <p role="status" className="mx-auto mt-2 max-w-6xl rounded-xl bg-aviso-fondo px-4 py-2 text-aviso">
          En iPhone: toca <strong>Compartir</strong> (el cuadro con la flecha) y luego <strong>«Agregar a inicio»</strong>. Así el panel queda como una app con su ícono.
        </p>
      )}
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-3 py-4 outline-none sm:px-4">{children}</main>
      {/* Navegación inferior en el celular, con botones grandes */}
      {mas && (
        <div className="fixed inset-0 z-30 bg-black/40 sm:hidden" onClick={() => setMas(false)}>
          <nav aria-label="Más secciones" className="absolute inset-x-0 bottom-16 grid gap-1 rounded-t-2xl bg-superficie p-3" onClick={(e) => e.stopPropagation()}>
            {PESTANAS.filter((p) => p.mas).map((p) => (
              <NavLink key={p.a} to={p.a} onClick={() => setMas(false)} className={({ isActive }) => `flex min-h-14 items-center gap-3 rounded-xl px-4 text-lg font-bold no-underline ${isActive ? "bg-marca-suave text-marca" : "text-texto"}`}>
                <span aria-hidden>{p.i}</span>{p.t}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <nav aria-label="Secciones del panel" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-borde bg-superficie sm:hidden">
        <button type="button" onClick={() => setMas(!mas)} aria-expanded={mas} className={`order-last flex min-h-16 flex-col items-center justify-center text-xs font-bold ${enMas || mas ? "text-marca" : "text-suave"}`}>
          <span aria-hidden className="text-xl">☰</span>Más
        </button>
        {PESTANAS.filter((p) => !p.mas).map((p) => (
          <NavLink key={p.a} to={p.a} end={p.fin}
            className={({ isActive }) => `relative flex min-h-16 flex-col items-center justify-center text-xs font-bold no-underline ${isActive ? "text-marca" : "text-suave"}`}>
            <span aria-hidden className="text-xl">{p.i}</span>{p.t}
            {p.t === "Bandeja" && noVistas.size > 0 && <span className="absolute right-1/4 top-2 rounded-full bg-red-600 px-1.5 text-xs text-white">{noVistas.size}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
