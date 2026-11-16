/**
 * Modo prueba del v1 (?modo=prueba): cronómetro, errores, retrocesos, intención
 * de uso y resumen copiable para las pruebas con usuarios (HA, HD).
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { almacen } from "../compartido/util/almacen";
import { CASOS_PRUEBA } from "./casosPrueba";

interface Registro { caso: string; participante: string; segundos: number; errores: number; retrocesos: number; zonas: string; codigo: string; uso: string; comentario: string; fecha: string }
interface Ctx {
  activo: boolean;
  error(): void;
  retroceso(): void;
  terminar(codigo: string, zonas: string[]): void;
}
const C = createContext<Ctx>({ activo: false, error() {}, retroceso() {}, terminar() {} });
export const useModoPrueba = () => useContext(C);
const CLAVE = "psr-prueba-registros";

export function ProveedorModoPrueba({ children }: { children: ReactNode }) {
  const activo = useMemo(() => new URLSearchParams(location.search).get("modo") === "prueba" || sessionStorageFlag(), []);
  const [corriendo, setCorriendo] = useState(false);
  const [seg, setSeg] = useState(0);
  const [err, setErr] = useState(0);
  const [ret, setRet] = useState(0);
  const [caso, setCaso] = useState("C1");
  const [part, setPart] = useState("");
  const [ultimo, setUltimo] = useState<Registro | null>(null);
  const [abierto, setAbierto] = useState(true);
  const [aviso, setAviso] = useState("");
  const t0 = useRef(0);

  useEffect(() => {
    if (!corriendo) return;
    const t = window.setInterval(() => setSeg(Math.round((Date.now() - t0.current) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [corriendo]);

  const ctx: Ctx = {
    activo,
    error: () => corriendo && setErr((n) => n + 1),
    retroceso: () => corriendo && setRet((n) => n + 1),
    terminar: (codigo, zonas) => {
      if (!corriendo) return;
      setCorriendo(false);
      const r: Registro = { caso, participante: part || "—", segundos: Math.round((Date.now() - t0.current) / 1000), errores: err, retrocesos: ret, zonas: zonas.join("+"), codigo, uso: "", comentario: "", fecha: new Date().toISOString() };
      setUltimo(r);
      almacen.guardar(CLAVE, [...almacen.leer<Registro[]>(CLAVE, []), r]);
    },
  };

  function guardarPost(k: "uso" | "comentario", v: string) {
    if (!ultimo) return;
    const r = { ...ultimo, [k]: v };
    setUltimo(r);
    const l = almacen.leer<Registro[]>(CLAVE, []);
    almacen.guardar(CLAVE, l.map((x) => (x.fecha === r.fecha ? r : x)));
  }

  async function copiar() {
    const l = almacen.leer<Registro[]>(CLAVE, []);
    const n = l.length || 1;
    const bajo3 = l.filter((r) => r.segundos < 180 && r.errores === 0).length;
    const txt = [
      `RESUMEN MODO PRUEBA · ${new Date().toLocaleString("es-CO")}`,
      `Ejecuciones: ${l.length} · Sin errores y < 3 min: ${bajo3}/${l.length}`,
      `Tiempo promedio: ${Math.round(l.reduce((a, r) => a + r.segundos, 0) / n)} s`,
      "El color del semáforo se compara en el panel del taller (no se muestra al cliente).",
      "", ["caso", "participante", "segundos", "errores", "retrocesos", "zonas", "código", "uso 1-5", "comentario"].join("\t"),
      ...l.map((r) => [r.caso, r.participante, r.segundos, r.errores, r.retrocesos, r.zonas, r.codigo, r.uso, r.comentario].join("\t")),
    ].join("\n");
    try { await navigator.clipboard.writeText(txt); setAviso("Copiado ✓"); } catch { setAviso("No se pudo copiar"); }
  }

  const mmss = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
  const textoCaso = CASOS_PRUEBA.find((c) => c.id === caso)?.texto;

  return (
    <C.Provider value={ctx}>
      {children}
      {activo && (
        <aside aria-label="Panel del modo prueba" className="fixed bottom-20 right-2 z-40 w-[min(22rem,calc(100vw-1rem))] rounded-2xl border-2 border-dashed border-aviso bg-aviso-fondo p-3 text-sm text-texto shadow-lg">
          <button type="button" className="mb-1 w-full text-left font-bold" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
            🧪 Modo prueba · {mmss} {corriendo ? "⏺" : ""} {abierto ? "▾" : "▸"}
          </button>
          {abierto && (
            <div className="grid gap-2">
              <div className="flex gap-2">
                <select aria-label="Caso" className="campo !min-h-10 !py-1" value={caso} onChange={(e) => setCaso(e.target.value)} disabled={corriendo}>
                  {CASOS_PRUEBA.map((c) => <option key={c.id}>{c.id}</option>)}
                </select>
                <input aria-label="Participante" className="campo !min-h-10 !py-1" placeholder="Participante" value={part} onChange={(e) => setPart(e.target.value)} />
              </div>
              <p className="text-xs">{textoCaso}</p>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-lg bg-marca px-3 py-2 font-bold text-sobre-marca" onClick={() => { t0.current = Date.now(); setSeg(0); setErr(0); setRet(0); setUltimo(null); setCorriendo(true); setAbierto(false); }}>
                  {corriendo ? "↺ Reiniciar" : "▶ Iniciar tarea"}
                </button>
                <span>Errores <b>{err}</b> · Retrocesos <b>{ret}</b></span>
              </div>
              {ultimo && (
                <div className="grid gap-1 rounded-lg bg-superficie p-2">
                  <span>Terminó en <b>{ultimo.segundos} s</b> · código {ultimo.codigo}</span>
                  <select aria-label="Intención de uso" className="campo !min-h-10 !py-1" value={ultimo.uso} onChange={(e) => guardarPost("uso", e.target.value)}>
                    <option value="">Intención de uso (1 a 5)</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
                  </select>
                  <input aria-label="Comentario" className="campo !min-h-10 !py-1" placeholder="Comentario" value={ultimo.comentario} onChange={(e) => guardarPost("comentario", e.target.value)} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-lg border border-borde bg-superficie px-3 py-2 font-bold" onClick={copiar}>Copiar resumen</button>
                <button type="button" className="text-xs underline" onClick={() => { if (confirm("¿Borrar todos los registros de prueba de este navegador?")) almacen.borrar(CLAVE); }}>Borrar registros</button>
                <span role="status">{aviso}</span>
              </div>
            </div>
          )}
        </aside>
      )}
    </C.Provider>
  );
}

/** Mantiene el modo prueba al navegar entre páginas. */
function sessionStorageFlag() {
  try {
    if (new URLSearchParams(location.search).get("modo") === "prueba") sessionStorage.setItem("psr-modo-prueba", "1");
    return sessionStorage.getItem("psr-modo-prueba") === "1";
  } catch { return false; }
}
