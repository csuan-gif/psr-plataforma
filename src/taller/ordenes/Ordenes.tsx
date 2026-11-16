import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { apiTaller } from "../datos/api";
import type { OrdenTaller } from "../datos/tipos";
import { usePanel } from "../contexto";
import { COLOR_INFO } from "../ui";
import { ESTADOS_ORDEN, NOMBRE_ESTADO, type EstadoOrden } from "../util/reglasOrden";
import { useCambioEstado } from "./CambioEstado";
import DetalleOrden, { ETIQUETA_PRESUPUESTO } from "./DetalleOrden";
import { Dialogo } from "../ui";
import RedactorAviso from "./RedactorAviso";
import { Boton } from "../../compartido/ui/base";

const dias = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

function Tarjeta({ o, onAbrir }: { o: OrdenTaller; onAbrir: () => void }) {
  const cerrada = o.estado === "entregado" || o.estado === "cancelado";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: o.id, data: o, disabled: cerrada });
  const p = ETIQUETA_PRESUPUESTO[o.presupuesto.estado];
  return (
    <div ref={setNodeRef} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 40 } : undefined}
      className={`relative mb-2 flex overflow-hidden rounded-xl border border-borde bg-superficie shadow-sm ${isDragging ? "ring-2 ring-marca" : ""}`}>
      {o.color && <span aria-hidden className={`w-1.5 shrink-0 ${COLOR_INFO[o.color].barra}`} />}
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 p-2 text-left text-sm">
        <span className="block text-base font-bold">{o.vehiculo.placa}</span>
        <span className="block truncate">{[o.vehiculo.marca, o.vehiculo.linea].filter(Boolean).join(" ")}</span>
        <span className="block truncate text-suave">{o.cliente.nombre.replace(/\s*\(.*\)/, "")}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          {o.autorizaPresupuestoPrevio && <span className={`rounded-full px-1.5 text-xs font-bold ${p.c}`}>{p.t.replace("Presupuesto ", "$ ")}</span>}
          {!o.autorizaPruebaRuta && <span className="rounded-full bg-fondo px-1.5 text-xs" title="El cliente no autorizó prueba de ruta">🚫 ruta</span>}
          <span className="rounded-full bg-fondo px-1.5 text-xs">{o.tecnico ? "🔧 " + o.tecnico.nombre.split(" ")[0] : "Sin técnico"}</span>
          {!cerrada && <span className="rounded-full bg-fondo px-1.5 text-xs">{dias(o.creadoEn)} d</span>}
        </span>
      </button>
      {!cerrada && <button type="button" {...listeners} {...attributes} aria-label={`Mover orden de ${o.vehiculo.placa}`} className="grid w-8 shrink-0 cursor-grab touch-none place-items-center text-suave hover:bg-marca-suave">⠿</button>}
    </div>
  );
}

function Columna({ estado, ordenes, onAbrir }: { estado: EstadoOrden; ordenes: OrdenTaller[]; onAbrir: (o: OrdenTaller) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <section ref={setNodeRef} aria-label={NOMBRE_ESTADO[estado]}
      className={`flex w-64 shrink-0 snap-start flex-col rounded-2xl border-2 p-2 sm:w-56 2xl:w-auto 2xl:flex-1 ${isOver ? "border-marca bg-marca-suave" : "border-transparent bg-fondo"}`}>
      <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-bold">{NOMBRE_ESTADO[estado]} <span className="rounded-full bg-superficie px-2">{ordenes.length}</span></h2>
      <div className="min-h-24 flex-1">{ordenes.map((o) => <Tarjeta key={o.id} o={o} onAbrir={() => onAbrir(o)} />)}</div>
    </section>
  );
}

export default function Ordenes() {
  const { usuario, ultimoCambio } = usePanel();
  const [ordenes, setOrdenes] = useState<OrdenTaller[] | null>(null);
  const [mias, setMias] = useState(usuario.rol === "tecnico");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [avisar, setAvisar] = useState<OrdenTaller | null>(null);
  const cargar = useCallback(async () => { setOrdenes(await apiTaller.ordenes().catch(() => [])); }, []);
  useEffect(() => { void cargar(); }, [cargar, ultimoCambio]);

  const { pedir, dialogos } = useCambioEstado(async (o, destino) => {
    await cargar();
    if (destino === "listo" || destino === "entregado") setAvisar({ ...o, estado: destino });
  });
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor));
  const alSoltar = (e: DragEndEvent) => { const o = e.active.data.current as OrdenTaller | undefined; if (o && e.over) pedir(o, e.over.id as EstadoOrden); };

  const visibles = useMemo(() => (ordenes ?? []).filter((o) => !mias || o.tecnico?.id === usuario.id), [ordenes, mias, usuario.id]);
  const detalle = ordenes?.find((o) => o.id === abierta) ?? null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Órdenes de trabajo</h1>
        <div role="tablist" className="inline-flex rounded-xl border border-borde bg-superficie p-1">
          {([[false, "Todas"], [true, "Mis trabajos"]] as const).map(([v, t]) => (
            <button key={t} role="tab" type="button" aria-selected={mias === v} onClick={() => setMias(v)} className={`min-h-10 rounded-lg px-3 font-bold ${mias === v ? "bg-marca text-sobre-marca" : ""}`}>{t}</button>
          ))}
        </div>
        <Link to="/taller/recepcion" className="inline-flex min-h-12 items-center rounded-xl bg-marca px-4 font-bold text-sobre-marca no-underline">+ Recibir vehículo</Link>
      </div>
      <p className="mb-2 text-sm text-suave">Arrastra con ⠿ para cambiar de estado (en el celular, mantén presionado y desliza). Las reglas de presupuesto, prueba de ruta y entrega se revisan antes de mover.</p>
      {!ordenes ? <p className="py-10 text-center text-suave">Cargando órdenes…</p> : (
        <DndContext sensors={sensores} onDragEnd={alSoltar}>
          <div className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-3 sm:mx-0 sm:px-0">
            {ESTADOS_ORDEN.map((e) => <Columna key={e} estado={e} ordenes={visibles.filter((o) => o.estado === e)} onAbrir={(o) => setAbierta(o.id)} />)}
          </div>
        </DndContext>
      )}
      {ordenes && visibles.length === 0 && <p className="text-center text-suave">{mias ? "No tienes trabajos asignados." : "No hay vehículos en el taller."}</p>}
      <DetalleOrden orden={detalle} onCerrar={() => setAbierta(null)} pedirEstado={pedir} onCambio={cargar} />
      {dialogos}
      <Dialogo titulo={avisar ? `${avisar.vehiculo.placa}: ${NOMBRE_ESTADO[avisar.estado]}` : ""} abierto={!!avisar} onCerrar={() => setAvisar(null)}>
        {avisar && <><RedactorAviso orden={avisar} /><Boton variante="fantasma" className="mt-2" onClick={() => setAvisar(null)}>Ahora no</Boton></>}
      </Dialogo>
    </>
  );
}
