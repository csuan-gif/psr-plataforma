import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropsPaso } from "./Paso1Datos";
import type { CupoDia } from "../../compartido/datos/tipos";
import { api } from "../../compartido/datos/api";
import { Aviso, Opcion } from "../../compartido/ui/base";
import { FRANJAS, TALLER, type Franja } from "../../compartido/config";
import { diaSemana, fechaLarga, hoyBogota, nombreMes, sumarDias } from "../../compartido/util/fechas";
import { AVISO_SEGURIDAD, enlaceWhatsApp, requiereAvisoSeguridad } from "../../compartido/util/mensajes";

const DIAS_AGENDA = 30; // EDITAR: cuántos días hacia adelante se pueden pedir

export default function Paso5Agenda({ b, set }: PropsPaso) {
  const [dias, setDias] = useState<CupoDia[] | null>(null);
  const [error, setError] = useState("");
  const desde = sumarDias(hoyBogota(), 1), hasta = sumarDias(desde, DIAS_AGENDA - 1);

  const cargar = useCallback(async () => {
    try { setDias(await api.disponibilidad(desde, hasta)); setError(""); }
    catch { setError("No pudimos cargar la agenda. Revisa tu conexión."); }
  }, [desde, hasta]);

  // "En vivo": se refresca cada 30 s y al volver a la pestaña.
  useEffect(() => {
    void cargar();
    const t = window.setInterval(cargar, 30000);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", alVolver); };
  }, [cargar]);

  // Si la franja elegida se llenó mientras tanto, se libera la selección.
  useEffect(() => {
    if (!dias || b.agenda.modo !== "cita" || !b.agenda.fecha) return;
    const d = dias.find((x) => x.fecha === b.agenda.fecha);
    const ok = d?.franjas.find((f) => f.franja === b.agenda.franja)?.disponible;
    if (!ok && b.agenda.franja) set((x) => ({ ...x, agenda: { ...x.agenda, franja: "" } }));
  }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const semanas = useMemo(() => {
    if (!dias) return [];
    const relleno = (diaSemana(desde) + 6) % 7; // lunes primero
    const celdas: (CupoDia | null)[] = [...Array(relleno).fill(null), ...dias];
    const out: (CupoDia | null)[][] = [];
    for (let i = 0; i < celdas.length; i += 7) out.push(celdas.slice(i, i + 7));
    return out;
  }, [dias, desde]);

  const urgente = b.movilidad !== "" && requiereAvisoSeguridad({ movilidad: b.movilidad, zonas: b.zonas, sintomas: b.sintomas });
  const diaSel = dias?.find((d) => d.fecha === b.agenda.fecha);
  const elegirDia = (f: string) => set((x) => ({ ...x, agenda: { modo: "cita", fecha: f, franja: "" } }));
  const elegirFranja = (fr: Franja) => set((x) => ({ ...x, agenda: { ...x.agenda, modo: "cita", franja: fr } }));

  return (
    <>
      <h2 className="mb-1 text-2xl font-bold">Agenda tu cita</h2>
      <p className="mb-4 text-suave">Elige un día y una franja con cupo. Tu cita queda <strong>pendiente</strong> hasta que el taller la confirme.</p>

      {urgente && (
        <div className="mb-4">
          <Aviso tono="marca">
            <p className="mb-2"><strong>{AVISO_SEGURIDAD}</strong> Si lo necesitas antes, comunícate con el taller:</p>
            <div className="flex flex-wrap gap-2">
              <a className="inline-flex min-h-12 items-center rounded-xl bg-marca px-4 font-bold text-sobre-marca no-underline" href={`tel:${TALLER.telefono.replace(/\s/g, "")}`}>📞 Llamar al taller</a>
              <a className="inline-flex min-h-12 items-center rounded-xl border-2 border-marca bg-superficie px-4 font-bold text-texto no-underline" target="_blank" rel="noreferrer"
                href={enlaceWhatsApp(TALLER.whatsapp, `Hola, necesito ayuda con mi vehículo ${b.vehiculo.placa}.`)}>💬 Escribir por WhatsApp</a>
            </div>
          </Aviso>
        </div>
      )}

      {error && <p role="alert" className="mb-3 text-aviso">⚠ {error} <button type="button" className="font-bold underline" onClick={cargar}>Reintentar</button></p>}
      {!dias && !error && <p aria-live="polite" className="py-10 text-center text-suave">Cargando cupos disponibles…</p>}

      {dias && (
        <div className="mb-4 rounded-2xl border border-borde bg-superficie p-3">
          <p className="mb-2 text-center font-bold capitalize">
            {nombreMes(Number(desde.slice(5, 7)) - 1)}{desde.slice(5, 7) !== hasta.slice(5, 7) && ` – ${nombreMes(Number(hasta.slice(5, 7)) - 1)}`}
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-suave" aria-hidden>
            {["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div role="grid" aria-label="Días disponibles" className="mt-1 grid gap-1">
            {semanas.map((s, i) => (
              <div role="row" key={i} className="grid grid-cols-7 gap-1">
                {s.map((d, j) => {
                  if (!d) return <span key={j} role="gridcell" />;
                  const libre = d.franjas.some((f) => f.disponible);
                  const sel = b.agenda.fecha === d.fecha && b.agenda.modo === "cita";
                  return (
                    <span role="gridcell" key={d.fecha}>
                      <button type="button" disabled={!libre} onClick={() => elegirDia(d.fecha)} aria-pressed={sel}
                        aria-label={`${fechaLarga(d.fecha)}${libre ? "" : `, ${d.motivo ?? "sin cupo"}`}`}
                        className={`flex aspect-square w-full flex-col items-center justify-center rounded-lg border-2 text-sm transition ${sel ? "border-marca bg-marca font-bold text-sobre-marca" : libre ? "border-borde hover:border-marca" : "border-transparent text-suave line-through opacity-50"}`}>
                        {Number(d.fecha.slice(8))}
                        {d.fecha.slice(8) === "01" && <span className="text-[10px] no-underline">{nombreMes(Number(d.fecha.slice(5, 7)) - 1).slice(0, 3)}</span>}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-suave">Los días tachados no tienen cupo, son festivos o el taller está cerrado.</p>
        </div>
      )}

      {diaSel && b.agenda.modo === "cita" && (
        <div className="entrar mb-4">
          <p className="mb-2 font-bold first-letter:uppercase">{fechaLarga(diaSel.fecha)}: elige la franja</p>
          <div className="grid grid-cols-2 gap-2">
            {diaSel.franjas.map((f) => (
              <button key={f.franja} type="button" disabled={!f.disponible} aria-pressed={b.agenda.franja === f.franja} onClick={() => elegirFranja(f.franja)}
                className={`min-h-16 rounded-xl border-2 px-3 py-2 text-left transition disabled:opacity-40 ${b.agenda.franja === f.franja ? "border-marca bg-marca-suave" : "border-borde bg-superficie hover:border-marca"}`}>
                <span className="block font-bold">{b.agenda.franja === f.franja && "✓ "}{FRANJAS[f.franja].nombre}</span>
                <span className="text-sm text-suave">{f.disponible ? FRANJAS[f.franja].horas : "Sin cupo"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Opcion activo={b.agenda.modo === "info"} className="w-full"
        onClick={() => set((x) => ({ ...x, agenda: { modo: x.agenda.modo === "info" ? "" : "info", fecha: "", franja: "" } }))}>
        Solo quiero una cotización o información (sin cita)
      </Opcion>
    </>
  );
}
