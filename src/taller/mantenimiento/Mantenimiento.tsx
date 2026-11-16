import { useCallback, useEffect, useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type IndicadorRecordatorios, type PlanMantenimiento, type RecordatorioTaller } from "../datos/tipos";
import { usePanel } from "../contexto";
import { Dialogo } from "../ui";
import { Boton, Tarjeta } from "../../compartido/ui/base";
import { cuandoTexto } from "../../compartido/util/mantenimiento";
import { fechaLarga, hoyBogota } from "../../compartido/util/fechas";
import { enlaceWhatsApp } from "../../compartido/util/mensajes";
import { mensajeRecordatorio } from "../util/mensajesMantenimiento";
import { celularE164 } from "../../compartido/util/validaciones";

function Item({ r, onCambio }: { r: RecordatorioTaller; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const hoy = hoyBogota();
  const vencido = r.fechaObjetivo && r.fechaObjetivo < hoy;
  const marcar = async (e: RecordatorioTaller["estado"]) => { await apiTaller.marcarRecordatorio(r.id, e); onCambio(); };
  return (
    <li className="rounded-2xl border border-borde bg-superficie p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold">{r.vehiculo.placa}</span>
        <span>{[r.vehiculo.marca, r.vehiculo.linea].filter(Boolean).join(" ")}</span>
        <span className="text-suave">· {r.cliente.nombre}</span>
        {r.estado === "enviado" && <span className="ml-auto rounded-full bg-ok-fondo px-2 text-xs font-bold text-ok">Enviado {r.enviadoEn && cuandoTexto(r.enviadoEn.slice(0, 10), hoy)}</span>}
      </div>
      <p>
        {r.tipo === "mantenimiento" ? "⏰" : "📄"} <strong>{r.servicio}</strong>{" — "}
        {r.fechaObjetivo ? <span className={vencido ? "font-bold text-marca" : ""}>{fechaLarga(r.fechaObjetivo)} ({cuandoTexto(r.fechaObjetivo, hoy)})</span> : "sin fecha"}
        {r.kmEstimado && <> · a los {r.kmEstimado.toLocaleString("es-CO")} km</>}
      </p>
      {r.tipo === "mantenimiento" && (
        <p className="text-sm text-suave">
          {r.kmDia ? <>Rueda ~{r.kmDia.toLocaleString("es-CO")} km/día; hoy debe ir por ~{r.kmHoy?.toLocaleString("es-CO")} km.{r.fechaPorKm && r.fechaPorKm === r.fechaObjetivo && " La fecha sale por kilometraje."}</> : "Sin historial de km: se usa la fecha."}
        </p>
      )}
      {!r.cliente.autorizaDatos && <p className="mt-1 text-sm text-aviso">⚠ Cliente sin autorización de datos registrada (importado): el mensaje incluye el aviso de privacidad y la opción de no recibir más.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Boton onClick={() => { setTexto(mensajeRecordatorio(r)); setAbierto(true); }}>💬 Escribir por WhatsApp</Boton>
        <Boton variante="secundario" onClick={() => marcar("agendado")}>✓ Agendó</Boton>
        <Boton variante="fantasma" onClick={() => marcar("descartado")}>Descartar</Boton>
      </div>
      <Dialogo titulo={`Recordatorio para ${r.cliente.nombre.replace(/\s*\(.*\)/, "")}`} abierto={abierto} onCerrar={() => setAbierto(false)}>
        <textarea aria-label="Mensaje" className="campo min-h-40" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <a href={enlaceWhatsApp(celularE164(r.cliente.celular), texto)} target="_blank" rel="noreferrer"
          onClick={() => { void marcar("enviado"); setAbierto(false); }}
          className="mt-2 flex min-h-12 items-center justify-center rounded-xl bg-[#1f7a43] px-4 font-bold text-white no-underline">💬 Abrir WhatsApp y marcar como enviado</a>
        <p className="mt-1 text-xs text-suave">El enlace lleva al cliente a la solicitud con su vehículo ya cargado. Cuando la envíe, este recordatorio pasa solo a «agendado».</p>
      </Dialogo>
    </li>
  );
}

function Planes() {
  const { usuario } = usePanel();
  const admin = usuario.rol === "admin";
  const [planes, setPlanes] = useState<(PlanMantenimiento & { activo?: boolean })[]>([]);
  const [nuevo, setNuevo] = useState({ servicio: "", intervaloKm: "", intervaloMeses: "", aplicaA: "todos" });
  const [msg, setMsg] = useState("");
  const cargar = useCallback(async () => setPlanes(await apiTaller.planes()), []);
  useEffect(() => { void cargar(); }, [cargar]);
  const guardar = async (p: PlanMantenimiento & { activo?: boolean }) => {
    try { await apiTaller.guardarPlan(p); setMsg("✓ Guardado."); await cargar(); } catch (e) { setMsg("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo guardar.")); }
  };
  const num = (s: string) => (s.trim() ? Math.max(0, Number(s.replace(/\D/g, ""))) : null);
  return (
    <Tarjeta>
      <h2 className="mb-1 text-lg font-bold">Plan de mantenimiento</h2>
      <p className="mb-3 text-sm text-suave">Valores de referencia: <strong>ajústalos según tu criterio y el manual de cada fabricante</strong>. Cada vez que un trabajo de la orden se marque con uno de estos servicios, al entregar se programa el siguiente (lo que llegue primero: km o meses).</p>
      {msg && <p role="status" className="mb-2 text-sm">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-left"><th className="p-1">Servicio</th><th className="p-1">Cada km</th><th className="p-1">Cada meses</th><th className="p-1">Aplica a</th><th className="p-1" /></tr></thead>
          <tbody>
            {planes.map((p, i) => (
              <tr key={p.id} className="border-t border-borde">
                <td className="p-1"><input aria-label="Servicio" className="campo !min-h-9 !py-1" disabled={!admin} value={p.servicio} onChange={(e) => setPlanes(planes.map((x, j) => (j === i ? { ...x, servicio: e.target.value } : x)))} /></td>
                <td className="p-1"><input aria-label="Cada km" className="campo !min-h-9 !w-24 !py-1" inputMode="numeric" disabled={!admin} value={p.intervaloKm ?? ""} onChange={(e) => setPlanes(planes.map((x, j) => (j === i ? { ...x, intervaloKm: num(e.target.value) } : x)))} /></td>
                <td className="p-1"><input aria-label="Cada meses" className="campo !min-h-9 !w-20 !py-1" inputMode="numeric" disabled={!admin} value={p.intervaloMeses ?? ""} onChange={(e) => setPlanes(planes.map((x, j) => (j === i ? { ...x, intervaloMeses: num(e.target.value) } : x)))} /></td>
                <td className="p-1"><select aria-label="Aplica a" className="campo !min-h-9 !py-1" disabled={!admin} value={p.aplicaA} onChange={(e) => setPlanes(planes.map((x, j) => (j === i ? { ...x, aplicaA: e.target.value } : x)))}>
                  {["todos", "gasolina", "diesel", "gas", "hibrido", "electrico"].map((a) => <option key={a}>{a}</option>)}</select></td>
                <td className="whitespace-nowrap p-1">{admin && <>
                  <button type="button" className="font-bold text-marca underline" onClick={() => guardar(p)}>Guardar</button>{" · "}
                  <button type="button" className="text-suave underline" onClick={() => confirm(`¿Desactivar «${p.servicio}»?`) && guardar({ ...p, activo: false })}>Quitar</button>
                </>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {admin && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input aria-label="Nuevo servicio" className="campo" placeholder="Nuevo servicio" value={nuevo.servicio} onChange={(e) => setNuevo({ ...nuevo, servicio: e.target.value })} />
          <input aria-label="Cada km" className="campo" placeholder="Cada km" inputMode="numeric" value={nuevo.intervaloKm} onChange={(e) => setNuevo({ ...nuevo, intervaloKm: e.target.value })} />
          <input aria-label="Cada meses" className="campo" placeholder="Cada meses" inputMode="numeric" value={nuevo.intervaloMeses} onChange={(e) => setNuevo({ ...nuevo, intervaloMeses: e.target.value })} />
          <Boton disabled={nuevo.servicio.trim().length < 3 || (!nuevo.intervaloKm && !nuevo.intervaloMeses)} onClick={async () => {
            await apiTaller.crearPlan({ servicio: nuevo.servicio.trim(), intervaloKm: num(nuevo.intervaloKm), intervaloMeses: num(nuevo.intervaloMeses), aplicaA: nuevo.aplicaA });
            setNuevo({ servicio: "", intervaloKm: "", intervaloMeses: "", aplicaA: "todos" }); await cargar();
          }}>Agregar</Boton>
        </div>
      )}
    </Tarjeta>
  );
}

export default function Mantenimiento() {
  const { ultimoCambio } = usePanel();
  const [vista, setVista] = useState<"recordatorios" | "planes">("recordatorios");
  const [dias, setDias] = useState(14);
  const [lista, setLista] = useState<RecordatorioTaller[] | null>(null);
  const [ind, setInd] = useState<IndicadorRecordatorios | null>(null);
  const cargar = useCallback(async () => {
    const [l, i] = await Promise.all([apiTaller.recordatorios(dias).catch(() => []), apiTaller.indicadorRecordatorios(90).catch(() => null)]);
    setLista(l); setInd(i);
  }, [dias]);
  useEffect(() => { void cargar(); }, [cargar, ultimoCambio]);
  const contactar = (lista ?? []).filter((r) => r.cliente.aceptaRecordatorios);
  const noQuieren = (lista ?? []).length - contactar.length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Mantenimiento preventivo</h1>
        <div role="tablist" className="inline-flex rounded-xl border border-borde bg-superficie p-1">
          {([["recordatorios", "Para contactar"], ["planes", "Plan de mantenimiento"]] as const).map(([v, t]) => (
            <button key={v} role="tab" type="button" aria-selected={vista === v} onClick={() => setVista(v)} className={`min-h-10 rounded-lg px-3 font-bold ${vista === v ? "bg-marca text-sobre-marca" : ""}`}>{t}</button>
          ))}
        </div>
      </div>
      {vista === "planes" ? <Planes /> : (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Tarjeta><p className="text-sm text-suave">Por contactar ({dias} días)</p><p className="text-3xl font-bold">{contactar.filter((r) => r.estado === "pendiente").length}</p></Tarjeta>
            <Tarjeta><p className="text-sm text-suave">Enviados (90 días)</p><p className="text-3xl font-bold">{ind?.enviados ?? "—"}</p></Tarjeta>
            <Tarjeta>
              <p className="text-sm text-suave">Agendaron desde un recordatorio</p>
              <p className="text-3xl font-bold">{ind?.agendados ?? "—"} <span className="text-lg text-suave">{ind?.conversion != null && `(${Math.round(ind.conversion * 100)} %)`}</span></p>
              <p className="text-xs text-suave">Meta del informe: 1 de cada 5 (20 %).</p>
            </Tarjeta>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span>Mostrar lo que vence en los próximos</span>
            {[7, 14, 30, 60].map((d) => <button key={d} type="button" aria-pressed={dias === d} onClick={() => setDias(d)} className={`rounded-full border-2 px-3 py-1 font-bold ${dias === d ? "border-marca bg-marca-suave" : "border-borde"}`}>{d} días</button>)}
            <span className="text-suave">(incluye lo vencido; SOAT y técnico-mecánica aparecen 30 días antes)</span>
          </div>
          {!lista ? <p className="py-10 text-center text-suave">Cargando…</p> : contactar.length === 0 ? <p className="py-10 text-center text-suave">No hay recordatorios para estas fechas. 🎉</p> : (
            <ul className="grid gap-3 lg:grid-cols-2">{contactar.map((r) => <Item key={r.id} r={r} onCambio={cargar} />)}</ul>
          )}
          {noQuieren > 0 && <p className="mt-3 text-sm text-suave">{noQuieren} cliente(s) pidieron no recibir recordatorios; no se muestran.</p>}
        </>
      )}
    </>
  );
}
