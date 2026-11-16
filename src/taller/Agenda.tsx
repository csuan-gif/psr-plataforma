import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { apiTaller } from "./datos/api";
import { ErrorTaller, type CitaAgenda, type CupoTaller } from "./datos/tipos";
import { usePanel } from "./contexto";
import { COLOR_INFO, Dialogo, ESTADO_CITA } from "./ui";
import DetalleSolicitud from "./DetalleSolicitud";
import RedactorWhatsApp from "./RedactorWhatsApp";
import { Boton } from "../compartido/ui/base";
import { FRANJAS, type Franja } from "../compartido/config";
import { diaSemana, fechaLarga, hoyBogota, nombreDiaCorto, sumarDias } from "../compartido/util/fechas";
import { lunesDe } from "./util/bandeja";

const ACTIVAS = ["pendiente", "confirmada", "reprogramada"];

function TarjetaCita({ c, onAbrir }: { c: CitaAgenda; onAbrir: () => void }) {
  const activa = ACTIVAS.includes(c.estado);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id, data: c, disabled: !activa });
  const estilo = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 30 } : undefined;
  return (
    <div ref={setNodeRef} style={estilo}
      className={`relative mb-1.5 flex items-stretch overflow-hidden rounded-lg border bg-superficie text-left text-sm shadow-sm ${isDragging ? "opacity-80 ring-2 ring-marca" : ""} ${activa ? "border-borde" : "border-dashed border-borde opacity-60"}`}>
      <span aria-hidden className={`w-1.5 shrink-0 ${COLOR_INFO[c.color].barra}`} />
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 px-2 py-1.5 text-left">
        <span className="block font-bold">{c.placa}</span>
        <span className="block truncate text-xs">{c.vehiculo} · {c.nombre.replace(/\s*\(.*\)/, "")}</span>
        <span className={`block text-xs ${c.estado === "pendiente" || c.estado === "reprogramada" ? "font-bold text-aviso" : "text-suave"}`}>{ESTADO_CITA[c.estado]}</span>
      </button>
      {activa && (
        <button type="button" {...listeners} {...attributes} aria-label={`Mover cita de ${c.placa}`} title="Arrastra para mover"
          className="grid w-8 shrink-0 cursor-grab touch-none place-items-center text-suave hover:bg-marca-suave active:cursor-grabbing">⠿</button>
      )}
    </div>
  );
}

function Celda({ fecha, franja, cupo, citas, onAbrir, alto }: { fecha: string; franja: Franja; cupo?: CupoTaller; citas: CitaAgenda[]; onAbrir: (c: CitaAgenda) => void; alto?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${fecha}|${franja}` });
  const usados = cupo?.usados ?? 0, total = cupo?.cupos ?? 0;
  const cerrado = !!cupo?.motivo || total === 0;
  const lleno = !cerrado && usados >= total;
  return (
    <div ref={setNodeRef} className={`rounded-xl border-2 p-1.5 transition ${alto ? "min-h-40" : "min-h-28"} ${isOver ? "border-marca bg-marca-suave" : cerrado ? "border-transparent bg-fondo" : "border-borde bg-superficie/60"}`}>
      <div className="mb-1 flex items-center justify-between gap-1 text-xs">
        <span className="font-bold">{FRANJAS[franja].nombre}</span>
        {cerrado ? <span className="truncate text-suave" title={cupo?.motivo ?? "Sin atención"}>{cupo?.motivo?.split(":")[0] ?? "Cerrado"}</span>
          : <span className={`rounded-full px-1.5 font-bold ${lleno ? "bg-aviso-fondo text-aviso" : "bg-ok-fondo text-ok"}`} title={`${usados} de ${total} cupos`}>{usados}/{total}</span>}
      </div>
      {total > 0 && !cerrado && (
        <div className="mb-1 h-1.5 overflow-hidden rounded bg-borde" aria-hidden><div className={`h-full ${lleno ? "bg-yellow-500" : "bg-green-600"}`} style={{ width: `${Math.min(100, (usados / total) * 100)}%` }} /></div>
      )}
      {citas.map((c) => <TarjetaCita key={c.id} c={c} onAbrir={() => onAbrir(c)} />)}
    </div>
  );
}

export default function Agenda() {
  const { ultimoCambio, recargar } = usePanel();
  const [vista, setVista] = useState<"semana" | "dia">(() => (window.innerWidth < 640 ? "dia" : "semana"));
  const [ancla, setAncla] = useState(hoyBogota());
  const [cupos, setCupos] = useState<CupoTaller[]>([]);
  const [citas, setCitas] = useState<CitaAgenda[] | null>(null);
  const [verCanceladas, setVerCanceladas] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [movida, setMovida] = useState<CitaAgenda | null>(null);
  const [aviso, setAviso] = useState("");

  const dias = useMemo(() => {
    if (vista === "dia") return [ancla];
    const l = diaSemana(ancla) === 0 ? sumarDias(ancla, 1) : lunesDe(ancla); // un domingo muestra la semana que viene
    return Array.from({ length: 6 }, (_, i) => sumarDias(l, i)); // lunes a sábado
  }, [vista, ancla]);
  const desde = dias[0], hasta = dias[dias.length - 1];

  const cargar = useCallback(async () => {
    try {
      const [cu, ci] = await Promise.all([apiTaller.cupos(desde, hasta), apiTaller.citas(desde, hasta)]);
      setCupos(cu); setCitas(ci);
    } catch { setAviso("⚠ No se pudo cargar la agenda."); }
  }, [desde, hasta]);
  useEffect(() => { void cargar(); }, [cargar, ultimoCambio]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  async function alSoltar(e: DragEndEvent) {
    const c = e.active.data.current as CitaAgenda | undefined;
    if (!c || !e.over) return;
    const [fecha, franja] = String(e.over.id).split("|") as [string, Franja];
    if (fecha === c.fecha && franja === c.franja) return;
    const cu = cupos.find((x) => x.fecha === fecha && x.franja === franja);
    let forzar = false;
    if (cu && (cu.motivo || cu.usados >= cu.cupos)) {
      if (!confirm(`${cu.motivo ? `Esa franja está marcada «${cu.motivo}».` : "Esa franja ya está llena."} ¿Agendar igual con un cupo extra?`)) return;
      forzar = true;
    }
    // Movimiento optimista para que se sienta inmediato.
    setCitas((l) => l?.map((x) => (x.id === c.id ? { ...x, fecha, franja, estado: "reprogramada" } : x)) ?? null);
    try {
      await apiTaller.reprogramarCita(c.id, fecha, franja, forzar);
      setMovida({ ...c, fecha, franja });
      await Promise.all([cargar(), recargar()]);
    } catch (err) {
      setAviso("⚠ " + (err instanceof ErrorTaller ? err.message : "No se pudo mover la cita."));
      void cargar();
    }
  }

  const visibles = (citas ?? []).filter((c) => verCanceladas || ACTIVAS.includes(c.estado));
  const pendientes = (citas ?? []).filter((c) => c.estado === "pendiente" || c.estado === "reprogramada").length;
  const paso = vista === "dia" ? 1 : 7;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Agenda</h1>
        <div role="tablist" aria-label="Vista" className="inline-flex rounded-xl border border-borde bg-superficie p-1">
          {(["dia", "semana"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={vista === v} type="button" onClick={() => setVista(v)} className={`min-h-10 rounded-lg px-3 font-bold ${vista === v ? "bg-marca text-sobre-marca" : ""}`}>{v === "dia" ? "Día" : "Semana"}</button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Boton variante="secundario" onClick={() => setAncla(sumarDias(ancla, -paso))} aria-label="Anterior">◀</Boton>
        <Boton variante="secundario" onClick={() => setAncla(hoyBogota())}>Hoy</Boton>
        <Boton variante="secundario" onClick={() => setAncla(sumarDias(ancla, paso))} aria-label="Siguiente">▶</Boton>
        <span className="font-bold first-letter:uppercase">{vista === "dia" ? fechaLarga(ancla) : `${fechaLarga(desde)} – ${fechaLarga(hasta)}`}</span>
        <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={verCanceladas} onChange={(e) => setVerCanceladas(e.target.checked)} className="h-5 w-5" /> Ver canceladas</label>
      </div>
      {pendientes > 0 && <p className="mb-3 rounded-xl bg-aviso-fondo px-3 py-2 text-aviso">{pendientes} cita(s) por confirmar o avisar en este periodo.</p>}
      {aviso && <p role="alert" className="mb-3 text-marca" onClick={() => setAviso("")}>{aviso}</p>}
      <p className="mb-2 text-sm text-suave">Arrastra una cita con ⠿ para moverla (en el celular, mantén presionado). Toca la cita para ver la solicitud.</p>

      {!citas ? <p className="py-10 text-center text-suave">Cargando agenda…</p> : (
        <DndContext sensors={sensores} onDragEnd={alSoltar}>
          <div className={vista === "semana" ? "grid gap-2 overflow-x-auto md:grid-cols-6" : "grid gap-3 sm:grid-cols-2"}>
            {vista === "semana" ? dias.map((f) => (
              <section key={f} aria-label={fechaLarga(f)} className={`rounded-2xl p-1 ${f === hoyBogota() ? "bg-marca-suave" : ""}`}>
                <h2 className="mb-1 px-1 text-sm font-bold capitalize">{nombreDiaCorto(diaSemana(f))} {Number(f.slice(8))}</h2>
                {(["manana", "tarde"] as Franja[]).map((fr) => (
                  <div key={fr} className="mb-2"><Celda fecha={f} franja={fr} cupo={cupos.find((x) => x.fecha === f && x.franja === fr)} citas={visibles.filter((c) => c.fecha === f && c.franja === fr)} onAbrir={(c) => setAbierta(c.solicitudId)} /></div>
                ))}
              </section>
            )) : (["manana", "tarde"] as Franja[]).map((fr) => (
              <section key={fr} aria-label={FRANJAS[fr].nombre}>
                <h2 className="mb-1 text-sm font-bold text-suave">{FRANJAS[fr].horas}</h2>
                <Celda alto fecha={ancla} franja={fr} cupo={cupos.find((x) => x.fecha === ancla && x.franja === fr)} citas={visibles.filter((c) => c.fecha === ancla && c.franja === fr)} onAbrir={(c) => setAbierta(c.solicitudId)} />
              </section>
            ))}
          </div>
          {vista === "dia" && (
            <p className="mt-3 text-sm text-suave">Para mover a otro día en el celular, abre la cita y usa «Proponer otra fecha», o cambia a la vista de semana.</p>
          )}
        </DndContext>
      )}

      <DetalleSolicitud id={abierta} onCerrar={() => { setAbierta(null); void cargar(); }} />
      <Dialogo titulo="Cita movida: avisa al cliente" abierto={!!movida} onCerrar={() => setMovida(null)}>
        {movida && (
          <>
            <p className="mb-3">La cita de <strong>{movida.placa}</strong> quedó para el <strong>{fechaLarga(movida.fecha)}</strong>, {FRANJAS[movida.franja].nombre.toLowerCase()}. Queda como «reprogramada» hasta que la confirmes con el cliente.</p>
            <RedactorWhatsApp celular={movida.celular} inicial="reprogramar"
              datos={{ nombre: movida.nombre, codigo: movida.codigo, placa: movida.placa, vehiculo: movida.vehiculo, fecha: movida.fecha, franja: movida.franja }} />
          </>
        )}
      </Dialogo>
    </>
  );
}
