import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePanel } from "./contexto";
import type { Color, SolicitudTaller } from "./datos/tipos";
import { ChipColor, COLOR_INFO, ESTADO_CITA, MOVILIDAD, nombreSintoma, nombreZona } from "./ui";
import DetalleSolicitud from "./DetalleSolicitud";
import { haceCuanto } from "../compartido/util/fechas";
import { filtrarBandeja, ordenarBandeja, type FiltroEstado, type Periodo } from "./util/bandeja";
import { textoCita } from "../compartido/util/mensajes";
import type { Franja } from "../compartido/config";


function Tarjeta({ s, nueva, mirando, onAbrir }: { s: SolicitudTaller; nueva: boolean; mirando: string[]; onAbrir: () => void }) {
  return (
    <li className={`entrar relative overflow-hidden rounded-2xl border bg-superficie pl-2 ${nueva ? "border-marca shadow-md" : "border-borde"}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-2 ${COLOR_INFO[s.semaforo.final].barra}`} />
      <button type="button" onClick={onAbrir} className="block w-full p-3 text-left sm:p-4">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <ChipColor color={s.semaforo.final} ajustado={s.semaforo.auto !== s.semaforo.final} />
          {nueva && <span className="rounded-full bg-marca px-2 text-xs font-bold text-sobre-marca">NUEVA</span>}
          <span className="text-sm text-suave">{haceCuanto(s.creadoEn)}</span>
          <span className="ml-auto font-mono text-xs text-suave">{s.codigo}</span>
        </div>
        <p className="text-lg font-bold leading-tight">{s.vehiculo.placa} · {[s.vehiculo.marca, s.vehiculo.linea].filter(Boolean).join(" ")}</p>
        <p className="text-sm">{s.cliente.nombre}</p>
        <p className="mt-1 text-sm"><strong>{s.zonas.map(nombreZona).join(", ")}</strong>{s.sintomas.length > 0 && ": " + s.sintomas.slice(0, 3).map(nombreSintoma).join("; ")}{s.sintomas.length > 3 && ` y ${s.sintomas.length - 3} más`}</p>
        <p className={`text-sm ${s.movilidad === "si" ? "text-suave" : "font-bold text-marca"}`}>{MOVILIDAD[s.movilidad]}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-suave">
          <span>📅 {s.cita ? `${textoCita(s.cita.fecha, s.cita.franja as Franja).replace(/ \(.*\)/, "")} · ${ESTADO_CITA[s.cita.estado]}` : "Sin cita"}</span>
          {s.adjuntos.some((a) => a.tipo === "foto" || a.tipo === "video") && <span>📷 {s.adjuntos.filter((a) => a.tipo === "foto" || a.tipo === "video").length}</span>}
          {s.adjuntos.some((a) => a.tipo === "audio") && <span>🎙 nota de voz</span>}
        </div>
        {mirando.length > 0 && <p className="mt-1 text-sm font-bold text-aviso">👀 {mirando.join(", ")} la está viendo</p>}
      </button>
    </li>
  );
}

export default function Bandeja() {
  const { solicitudes, error, noVistas, otros } = usePanel();
  const [params, setParams] = useSearchParams();
  const [abierta, setAbierta] = useState<string | null>(params.get("abrir"));
  const color = (params.get("color") as Color | null) ?? "todos";
  const estado = (params.get("estado") as FiltroEstado | null) ?? "activas";
  const periodo = (params.get("periodo") as Periodo | null) ?? "30";
  const [texto, setTexto] = useState("");
  const set = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); n.set(k, v); n.delete("abrir"); return n; }, { replace: true });
  useEffect(() => { if (params.get("abrir")) setAbierta(params.get("abrir")); }, [params]);

  const lista = useMemo(() => ordenarBandeja(filtrarBandeja(solicitudes ?? [], { color, estado, periodo, texto })), [solicitudes, color, estado, periodo, texto]);
  const conteo = useMemo(() => {
    const base = filtrarBandeja(solicitudes ?? [], { color: "todos", estado, periodo, texto });
    return { todos: base.length, rojo: base.filter((s) => s.semaforo.final === "rojo").length, amarillo: base.filter((s) => s.semaforo.final === "amarillo").length, verde: base.filter((s) => s.semaforo.final === "verde").length };
  }, [solicitudes, estado, periodo, texto]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Bandeja {noVistas.size > 0 && <span className="text-base font-normal text-marca">· {noVistas.size} sin abrir</span>}</h1>
        <span className="flex items-center gap-1 text-sm text-ok"><span className="h-2 w-2 animate-pulse rounded-full bg-green-600" aria-hidden /> En vivo</span>
      </div>

      <div className="mb-3 grid gap-2">
        <input type="search" aria-label="Buscar por placa, nombre, documento o código" placeholder="🔎 Placa, nombre, documento o código" className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div role="group" aria-label="Filtrar por color" className="flex flex-wrap gap-2">
          {(["todos", "rojo", "amarillo", "verde"] as const).map((c) => (
            <button key={c} type="button" aria-pressed={color === c} onClick={() => set("color", c)}
              className={`min-h-10 rounded-full border-2 px-3 text-sm font-bold ${color === c ? "border-texto" : "border-borde"} ${c !== "todos" ? COLOR_INFO[c].clase : "bg-superficie"}`}>
              {c === "todos" ? "Todos" : COLOR_INFO[c].corto} ({conteo[c]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Estado" className="campo !w-auto !min-h-10 !py-1" value={estado} onChange={(e) => set("estado", e.target.value)}>
            <option value="activas">Por atender</option><option value="atendidas">Atendidas</option><option value="todas">Todas</option>
          </select>
          <select aria-label="Fecha" className="campo !w-auto !min-h-10 !py-1" value={periodo} onChange={(e) => set("periodo", e.target.value)}>
            <option value="hoy">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="todo">Todo</option>
          </select>
        </div>
      </div>

      {error && <p role="alert" className="mb-3 text-marca">⚠ {error}</p>}
      {!solicitudes && <p className="py-10 text-center text-suave">Cargando bandeja…</p>}
      {solicitudes && lista.length === 0 && <p className="py-10 text-center text-suave">No hay solicitudes con estos filtros. 🎉</p>}
      <ul aria-live="polite" className="grid gap-3 lg:grid-cols-2">
        {lista.map((s) => (
          <Tarjeta key={s.id} s={s} nueva={noVistas.has(s.id)} mirando={otros.filter((o) => o.viendo === s.id).map((o) => o.nombre)} onAbrir={() => setAbierta(s.id)} />
        ))}
      </ul>
      <DetalleSolicitud id={abierta} onCerrar={() => { setAbierta(null); if (params.get("abrir")) set("estado", estado); }} />
    </>
  );
}
