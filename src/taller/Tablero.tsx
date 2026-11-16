import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePanel } from "./contexto";
import { apiTaller } from "./datos/api";
import type { CitaAgenda, Color, OrdenTaller } from "./datos/tipos";
import { ESTADOS_ORDEN, NOMBRE_ESTADO } from "./util/reglasOrden";
import { COLOR_INFO } from "./ui";
import { hoyBogota, sumarDias } from "../compartido/util/fechas";
import { Tarjeta } from "../compartido/ui/base";

const ACTIVAS = ["pendiente", "confirmada", "reprogramada"];

/** Inicio del panel: qué hacer primero, en 10 segundos. */
export default function Tablero() {
  const { usuario, solicitudes, ultimoCambio } = usePanel();
  const [citas, setCitas] = useState<CitaAgenda[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenTaller[]>([]);
  const [porContactar, setPorContactar] = useState<number | null>(null);
  const hoy = hoyBogota(), manana = sumarDias(hoy, 1);
  useEffect(() => {
    apiTaller.citas(hoy, sumarDias(hoy, 30)).then(setCitas).catch(() => {});
    apiTaller.ordenes().then(setOrdenes).catch(() => {});
    apiTaller.recordatorios(7).then((l) => setPorContactar(l.filter((r) => r.estado === "pendiente" && r.cliente.aceptaRecordatorios).length)).catch(() => {});
  }, [hoy, ultimoCambio]);
  const enTaller = ordenes.filter((o) => o.estado !== "entregado" && o.estado !== "cancelado");
  const presupuestosPendientes = enTaller.filter((o) => o.presupuesto.estado === "pendiente" && o.presupuesto.enviadoEn);
  const sinPresupuesto = enTaller.filter((o) => o.autorizaPresupuestoPrevio && !o.presupuesto.enviadoEn && o.estado !== "recibido");

  const porAtender = (solicitudes ?? []).filter((s) => s.estado === "nueva" || s.estado === "en_revision");
  const deHoy = (solicitudes ?? []).filter((s) => new Date(new Date(s.creadoEn).getTime() - 5 * 3600000).toISOString().slice(0, 10) === hoy);
  const cuenta = (l: typeof porAtender, c: Color) => l.filter((s) => s.semaforo.final === c).length;
  const citasDe = (f: string) => citas.filter((c) => c.fecha === f && ACTIVAS.includes(c.estado));
  const porConfirmar = citas.filter((c) => c.estado === "pendiente" || c.estado === "reprogramada");
  const rojas = cuenta(porAtender, "rojo");
  const hora = new Date().getHours();

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">{hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"}, {usuario.nombre.split(" ")[0]}</h1>
      <p className="mb-4 text-suave">Esto es lo primero por hacer.</p>

      {rojas > 0 && (
        <Link to="/taller/bandeja?color=rojo&estado=activas" className="mb-4 flex items-center gap-3 rounded-2xl bg-red-700 p-4 text-white no-underline shadow">
          <span className="text-3xl" aria-hidden>●</span>
          <span><span className="block text-lg font-bold">{rojas} solicitud(es) urgente(s) por atender</span><span>Ábrelas primero →</span></span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta>
          <h2 className="font-bold text-suave">Por atender</h2>
          <p className="text-4xl font-bold">{porAtender.length}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(["rojo", "amarillo", "verde"] as Color[]).map((c) => (
              <Link key={c} to={`/taller/bandeja?color=${c}&estado=activas`} className={`rounded-full px-2 py-0.5 text-sm font-bold no-underline ${COLOR_INFO[c].clase}`}>{COLOR_INFO[c].corto}: {cuenta(porAtender, c)}</Link>
            ))}
          </div>
          <p className="mt-2 text-sm text-suave">Llegaron hoy: {deHoy.length}</p>
        </Tarjeta>
        <Tarjeta>
          <h2 className="font-bold text-suave">Citas por confirmar</h2>
          <p className={`text-4xl font-bold ${porConfirmar.length ? "text-aviso" : ""}`}>{porConfirmar.length}</p>
          <Link to="/taller/agenda" className="mt-2 inline-block text-sm font-bold text-marca">Ver agenda →</Link>
        </Tarjeta>
        <Tarjeta>
          <h2 className="font-bold text-suave">Citas de hoy</h2>
          <p className="text-4xl font-bold">{citasDe(hoy).length}</p>
          <ul className="mt-1 text-sm">{citasDe(hoy).slice(0, 4).map((c) => <li key={c.id}>{c.franja === "manana" ? "🌅" : "🌇"} {c.placa} · {c.vehiculo}</li>)}</ul>
        </Tarjeta>
        <Tarjeta>
          <h2 className="font-bold text-suave">Citas de mañana</h2>
          <p className="text-4xl font-bold">{citasDe(manana).length}</p>
          <ul className="mt-1 text-sm">{citasDe(manana).slice(0, 4).map((c) => <li key={c.id}>{c.franja === "manana" ? "🌅" : "🌇"} {c.placa} · {c.vehiculo}</li>)}</ul>
        </Tarjeta>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Tarjeta>
          <h2 className="font-bold text-suave">Vehículos en el taller</h2>
          <p className="text-4xl font-bold">{enTaller.length}</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 text-sm">
            {ESTADOS_ORDEN.filter((e) => e !== "entregado").map((e) => <li key={e} className="flex justify-between"><span>{NOMBRE_ESTADO[e]}</span><strong>{enTaller.filter((o) => o.estado === e).length}</strong></li>)}
          </ul>
          <Link to="/taller/ordenes" className="mt-2 inline-block text-sm font-bold text-marca">Ver tablero de órdenes →</Link>
        </Tarjeta>
        <Tarjeta>
          <h2 className="font-bold text-suave">Presupuestos</h2>
          <p className={`text-4xl font-bold ${presupuestosPendientes.length ? "text-aviso" : ""}`}>{presupuestosPendientes.length}</p>
          <p className="text-sm">esperando respuesta del cliente</p>
          {sinPresupuesto.length > 0 && <p className="mt-1 text-sm font-bold text-marca">{sinPresupuesto.length} orden(es) piden presupuesto previo y aún no se ha enviado.</p>}
          <ul className="mt-1 text-sm">{presupuestosPendientes.slice(0, 4).map((o) => <li key={o.id}>{o.vehiculo.placa} · {o.cliente.nombre.replace(/\s*\(.*\)/, "")}</li>)}</ul>
        </Tarjeta>
      </div>
      <Link to="/taller/mantenimiento" className="mt-3 flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-4 no-underline text-texto hover:border-marca">
        <span className="text-3xl" aria-hidden>⏰</span>
        <span><span className="block text-lg font-bold">{porContactar ?? "…"} recordatorio(s) de mantenimiento por enviar esta semana</span><span className="text-suave">Mensaje listo por WhatsApp, con enlace para agendar →</span></span>
      </Link>
    </>
  );
}
