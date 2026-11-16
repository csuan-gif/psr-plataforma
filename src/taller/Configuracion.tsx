import { useEffect, useState } from "react";
import { apiTaller } from "./datos/api";
import { ErrorTaller, type ConfigAgenda, type FilaDisponibilidad, type Plantillas } from "./datos/tipos";
import { usePanel } from "./contexto";
import { NOMBRES_PLANTILLA, PLANTILLAS_BASE, llenarPlantilla, revisarPlantilla } from "./util/plantillas";
import { Boton, Tarjeta } from "../compartido/ui/base";
import { FRANJAS, type Franja } from "../compartido/config";
import { fechaLarga, hoyBogota } from "../compartido/util/fechas";
import { completarFilas } from "./util/bandeja";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function Configuracion() {
  const { usuario } = usePanel();
  const admin = usuario.rol === "admin";
  const [cfg, setCfg] = useState<ConfigAgenda | null>(null);
  const [filas, setFilas] = useState<FilaDisponibilidad[]>([]);
  const [plantillas, setPlantillas] = useState<Plantillas>(PLANTILLAS_BASE);
  const [bloq, setBloq] = useState({ fecha: "", franja: "" as Franja | "", motivo: "" });
  const [msg, setMsg] = useState("");

  const cargar = async () => {
    const c = await apiTaller.configAgenda();
    setCfg(c); setFilas(completarFilas(c.disponibilidad));
    setPlantillas(await apiTaller.plantillas());
  };
  useEffect(() => { void cargar(); }, []);

  async function hacer(fn: () => Promise<void>, ok: string) {
    setMsg("");
    try { await fn(); await cargar(); setMsg("✓ " + ok); }
    catch (e) { setMsg("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo guardar.")); }
  }
  const cambiarFila = (i: number, p: Partial<FilaDisponibilidad>) => setFilas((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const ejemplo = { nombre: "Andrés Camacho", codigo: "PSR-7K3Q9M", placa: "JKL123", vehiculo: "Renault Sandero", fecha: hoyBogota(), franja: "manana" as Franja };

  if (!cfg) return <p className="py-10 text-center text-suave">Cargando…</p>;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Agenda y mensajes</h1>
      {!admin && <p className="mb-3 rounded-xl bg-aviso-fondo px-3 py-2 text-aviso">Solo el administrador puede cambiar estos ajustes. Puedes consultarlos.</p>}
      {msg && <p role="status" className="sticky top-16 z-10 mb-3 rounded-xl bg-ok-fondo px-3 py-2 text-ok">{msg}</p>}

      <Tarjeta className="mb-4">
        <h2 className="mb-1 text-lg font-bold">Horarios y cupos de recepción</h2>
        <p className="mb-3 text-sm text-suave">Cupos = cuántos vehículos puedes RECIBIR en cada franja (no cuántos reparas). Lo que ve el cliente se calcula con esto.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left"><th className="p-1">Día</th><th className="p-1">Franja</th><th className="p-1">Atiende</th><th className="p-1">Desde</th><th className="p-1">Hasta</th><th className="p-1">Cupos</th></tr></thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={`${f.diaSemana}${f.franja}`} className={`border-t border-borde ${!f.activo ? "opacity-60" : ""}`}>
                  <td className="p-1 font-bold">{f.franja === "manana" ? DIAS[f.diaSemana] : ""}</td>
                  <td className="p-1">{FRANJAS[f.franja].nombre}</td>
                  <td className="p-1"><input type="checkbox" className="h-5 w-5" aria-label={`${DIAS[f.diaSemana]} ${FRANJAS[f.franja].nombre}: atiende`} disabled={!admin} checked={f.activo} onChange={(e) => cambiarFila(i, { activo: e.target.checked })} /></td>
                  <td className="p-1"><input type="time" className="campo !min-h-9 !py-1" aria-label="Desde" disabled={!admin || !f.activo} value={f.horaInicio} onChange={(e) => cambiarFila(i, { horaInicio: e.target.value })} /></td>
                  <td className="p-1"><input type="time" className="campo !min-h-9 !py-1" aria-label="Hasta" disabled={!admin || !f.activo} value={f.horaFin} onChange={(e) => cambiarFila(i, { horaFin: e.target.value })} /></td>
                  <td className="p-1"><input type="number" min={0} max={20} className="campo !min-h-9 !w-20 !py-1" aria-label="Cupos" disabled={!admin || !f.activo} value={f.cupos} onChange={(e) => cambiarFila(i, { cupos: Math.max(0, Number(e.target.value)) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {admin && <Boton className="mt-3" onClick={() => hacer(() => apiTaller.guardarDisponibilidad(filas), "Horarios y cupos guardados.")}>Guardar horarios</Boton>}
      </Tarjeta>

      <Tarjeta className="mb-4">
        <h2 className="mb-1 text-lg font-bold">Días cerrados</h2>
        <p className="mb-3 text-sm text-suave">Vacaciones, capacitaciones o un día sin cupo. Los clientes no podrán pedir cita esos días.</p>
        {admin && (
          <div className="mb-3 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
            <label className="text-sm font-bold">Fecha<input type="date" min={hoyBogota()} className="campo" value={bloq.fecha} onChange={(e) => setBloq({ ...bloq, fecha: e.target.value })} /></label>
            <label className="text-sm font-bold">Franja<select className="campo" value={bloq.franja} onChange={(e) => setBloq({ ...bloq, franja: e.target.value as Franja | "" })}><option value="">Todo el día</option><option value="manana">Mañana</option><option value="tarde">Tarde</option></select></label>
            <label className="text-sm font-bold">Motivo (interno)<input className="campo" value={bloq.motivo} onChange={(e) => setBloq({ ...bloq, motivo: e.target.value })} placeholder="Ej.: vacaciones" /></label>
            <Boton disabled={!bloq.fecha} onClick={() => hacer(async () => { await apiTaller.bloquear(bloq.fecha, bloq.franja || null, bloq.motivo); setBloq({ fecha: "", franja: "", motivo: "" }); }, "Día cerrado.")}>Cerrar día</Boton>
          </div>
        )}
        {cfg.bloqueados.length === 0 ? <p className="text-suave">No hay días cerrados.</p> : (
          <ul className="grid gap-1">
            {cfg.bloqueados.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-borde px-3 py-2">
                <span className="first-letter:uppercase">{fechaLarga(b.fecha)} · {b.franja ? FRANJAS[b.franja].nombre : "Todo el día"}{b.motivo && <span className="text-suave"> · {b.motivo}</span>}</span>
                {admin && <button type="button" className="font-bold text-marca underline" onClick={() => hacer(() => apiTaller.desbloquear(b.id), "Día abierto de nuevo.")}>Abrir</button>}
              </li>
            ))}
          </ul>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer font-bold">Festivos de Colombia precargados ({cfg.festivos.length})</summary>
          <ul className="mt-2 grid gap-x-4 text-sm sm:grid-cols-2">{cfg.festivos.filter((f) => f.fecha >= hoyBogota()).map((f) => <li key={f.fecha}><span className="first-letter:uppercase">{fechaLarga(f.fecha)} {f.fecha.slice(0, 4)}</span> · {f.nombre}</li>)}</ul>
        </details>
      </Tarjeta>

      <Tarjeta className="mb-4">
        <h2 className="mb-1 text-lg font-bold">Plantillas de WhatsApp</h2>
        <p className="mb-3 text-sm text-suave">Usa {"{nombre} {vehiculo} {placa} {fecha} {franja} {horas} {codigo} {taller}"}. No incluyas precios ni tiempos de reparación.</p>
        {(Object.keys(NOMBRES_PLANTILLA) as (keyof Plantillas)[]).map((k) => {
          const aviso = revisarPlantilla(plantillas[k]);
          return (
            <div key={k} className="mb-4">
              <label htmlFor={`pl-${k}`} className="mb-1 block font-bold">{NOMBRES_PLANTILLA[k]}</label>
              <textarea id={`pl-${k}`} className="campo min-h-24" disabled={!admin} value={plantillas[k]} onChange={(e) => setPlantillas({ ...plantillas, [k]: e.target.value })} />
              {aviso && <p className="mt-1 rounded-lg bg-aviso-fondo px-3 py-1 text-sm text-aviso">⚠ {aviso}</p>}
              <p className="mt-1 text-sm text-suave">Vista previa: {llenarPlantilla(plantillas[k], ejemplo)}</p>
            </div>
          );
        })}
        {admin && (
          <div className="flex flex-wrap gap-2">
            <Boton disabled={Object.values(plantillas).some((t) => revisarPlantilla(t))} onClick={() => hacer(() => apiTaller.guardarPlantillas(plantillas), "Plantillas guardadas.")}>Guardar plantillas</Boton>
            <Boton variante="fantasma" onClick={() => setPlantillas(PLANTILLAS_BASE)}>Restaurar textos sugeridos</Boton>
          </div>
        )}
      </Tarjeta>

    </>
  );
}
