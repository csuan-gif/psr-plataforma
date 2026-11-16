import { useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type OrdenTaller } from "../datos/tipos";
import { usePanel } from "../contexto";
import { Dialogo } from "../ui";
import { datosRequeridos, NOMBRE_ESTADO, revisarTransicion, type DatosTransicion, type EstadoOrden, type Trabajo } from "../util/reglasOrden";
import EditorTrabajos from "./EditorTrabajos";
import { Boton, Campo } from "../../compartido/ui/base";
import { hoyBogota, sumarDias } from "../../compartido/util/fechas";

export const GARANTIA_DIAS = 90; // EDITAR: garantía por defecto que ofrece el taller

/**
 * Mover una orden de estado aplicando las reglas: explica los bloqueos y pide
 * los datos que faltan (prueba sin conducir / nueva autorización, o datos de entrega).
 */
export function useCambioEstado(alTerminar: (o: OrdenTaller, destino: EstadoOrden) => void) {
  const { usuario } = usePanel();
  const [pendiente, setPendiente] = useState<{ o: OrdenTaller; destino: EstadoOrden } | null>(null);
  const [bloqueo, setBloqueo] = useState<{ o: OrdenTaller; mensaje: string } | null>(null);
  const [d, setD] = useState<DatosTransicion & { modoPrueba?: "sin" | "nueva" }>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  async function ejecutar(o: OrdenTaller, destino: EstadoOrden, datos: DatosTransicion) {
    setOcupado(true); setError("");
    try {
      await apiTaller.cambiarEstadoOrden(o.id, destino, datos);
      setPendiente(null); alTerminar(o, destino);
    } catch (e) {
      const m = e instanceof ErrorTaller ? e.message : "No se pudo cambiar el estado.";
      if (pendiente) setError(m); else setBloqueo({ o, mensaje: m });
    } finally { setOcupado(false); }
  }

  function pedir(o: OrdenTaller, destino: EstadoOrden) {
    if (destino === o.estado) return;
    const reglas = { estado: o.estado, presupuestoEstado: o.presupuesto.estado, autorizaPresupuestoPrevio: o.autorizaPresupuestoPrevio, autorizaPruebaRuta: o.autorizaPruebaRuta, kmIngreso: o.kmIngreso, trabajos: o.trabajos };
    const req = datosRequeridos(reglas, destino);
    if (!req) {
      const b = revisarTransicion(reglas, destino, {}, { esAdmin: usuario.rol === "admin", hoy: hoyBogota() });
      if (b) { setBloqueo({ o, mensaje: b.mensaje }); return; }
      void ejecutar(o, destino, {});
      return;
    }
    // Si el bloqueo es de presupuesto, ningún dato extra lo resuelve: se explica de una vez.
    const b = revisarTransicion(reglas, destino, { pruebaSinConducir: "xxxxx", kmSalida: Number.MAX_SAFE_INTEGER, garantiaHasta: "9999-12-31", trabajos: [{ descripcion: "x", tipo: "correctivo" }] }, { esAdmin: usuario.rol === "admin", hoy: hoyBogota() });
    if (b) { setBloqueo({ o, mensaje: b.mensaje }); return; }
    setError("");
    setD(req === "entrega" ? { kmSalida: o.kmIngreso, garantiaHasta: sumarDias(hoyBogota(), GARANTIA_DIAS), trabajos: o.trabajos } : { modoPrueba: "sin" });
    setPendiente({ o, destino });
  }

  const listo = pendiente && !revisarTransicion(
    { estado: pendiente.o.estado, presupuestoEstado: pendiente.o.presupuesto.estado, autorizaPresupuestoPrevio: pendiente.o.autorizaPresupuestoPrevio, autorizaPruebaRuta: pendiente.o.autorizaPruebaRuta, kmIngreso: pendiente.o.kmIngreso, trabajos: pendiente.o.trabajos },
    pendiente.destino, d, { esAdmin: usuario.rol === "admin", hoy: hoyBogota() });

  const dialogos = (
    <>
      <Dialogo titulo="No se puede mover todavía" abierto={!!bloqueo} onCerrar={() => setBloqueo(null)}>
        <p className="mb-4 rounded-xl bg-aviso-fondo p-3 text-aviso">🔒 {bloqueo?.mensaje}</p>
        <Boton onClick={() => setBloqueo(null)}>Entendido</Boton>
      </Dialogo>

      <Dialogo titulo={pendiente ? `${pendiente.o.vehiculo.placa} → ${NOMBRE_ESTADO[pendiente.destino]}` : ""} abierto={!!pendiente} onCerrar={() => setPendiente(null)} ancho="max-w-2xl">
        {pendiente?.destino === "en_prueba" && (
          <>
            <p className="mb-3 rounded-xl bg-aviso-fondo p-3 text-aviso">⚠ El cliente <strong>NO autorizó</strong> conducir el vehículo. Elige cómo se va a probar:</p>
            <div role="radiogroup" className="mb-3 grid gap-2 sm:grid-cols-2">
              {([["sin", "Probar sin conducir", "Ej.: prueba estática, en elevador, con escáner."], ["nueva", "El cliente autorizó ahora", "Escribe cómo y cuándo lo autorizó."]] as const).map(([v, t, ayuda]) => (
                <button key={v} type="button" role="radio" aria-checked={d.modoPrueba === v} onClick={() => setD({ modoPrueba: v })}
                  className={`rounded-xl border-2 p-3 text-left ${d.modoPrueba === v ? "border-marca bg-marca-suave" : "border-borde"}`}><span className="block font-bold">{t}</span><span className="text-sm text-suave">{ayuda}</span></button>
              ))}
            </div>
            <Campo id="nota-prueba" etiqueta={d.modoPrueba === "nueva" ? "¿Cómo autorizó el cliente?" : "¿Cómo se probó?"}>
              <textarea id="nota-prueba" className="campo min-h-20" value={(d.modoPrueba === "nueva" ? d.autorizacionNueva : d.pruebaSinConducir) ?? ""}
                placeholder={d.modoPrueba === "nueva" ? "Ej.: autorizó por WhatsApp a las 3 p. m., mensaje guardado" : "Ej.: prueba en elevador y frenado estático"}
                onChange={(e) => setD(d.modoPrueba === "nueva" ? { modoPrueba: "nueva", autorizacionNueva: e.target.value } : { modoPrueba: "sin", pruebaSinConducir: e.target.value })} />
            </Campo>
          </>
        )}
        {pendiente?.destino === "entregado" && (
          <>
            <p className="mb-3 text-suave">Al entregar se cierran la orden y su historial, y se programan los próximos recordatorios de mantenimiento para los trabajos del plan.</p>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Campo id="km-salida" etiqueta={`Km de salida (ingresó con ${pendiente.o.kmIngreso?.toLocaleString("es-CO") ?? "—"})`}
                aviso={d.kmSalida != null && d.kmSalida < (pendiente.o.kmIngreso ?? 0) ? "No puede ser menor al kilometraje de ingreso." : null}>
                <input id="km-salida" className="campo" inputMode="numeric" value={d.kmSalida ?? ""} onChange={(e) => setD({ ...d, kmSalida: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} />
              </Campo>
              <Campo id="garantia" etiqueta="Garantía hasta">
                <input id="garantia" type="date" className="campo" min={hoyBogota()} value={d.garantiaHasta ?? ""} onChange={(e) => setD({ ...d, garantiaHasta: e.target.value })} />
              </Campo>
            </div>
            <p className="mb-1 font-bold">Trabajos realizados</p>
            <EditorTrabajos trabajos={d.trabajos ?? []} onCambio={(t: Trabajo[]) => setD({ ...d, trabajos: t })} />
          </>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg bg-aviso-fondo p-2 text-aviso">⚠ {error}</p>}
        <div className="mt-4 flex gap-2">
          <Boton disabled={!listo || ocupado} onClick={() => pendiente && ejecutar(pendiente.o, pendiente.destino, d.modoPrueba === "nueva" ? { autorizacionNueva: d.autorizacionNueva } : d.modoPrueba === "sin" ? { pruebaSinConducir: d.pruebaSinConducir } : { ...d, trabajos: d.trabajos?.filter((t) => t.descripcion.trim()) })}>
            {ocupado ? "Guardando…" : pendiente?.destino === "entregado" ? "Registrar entrega" : "Pasar a prueba"}
          </Boton>
          <Boton variante="fantasma" onClick={() => setPendiente(null)}>Cancelar</Boton>
        </div>
      </Dialogo>
    </>
  );
  return { pedir, dialogos };
}
