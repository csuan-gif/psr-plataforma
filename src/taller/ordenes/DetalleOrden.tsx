import { useEffect, useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type HistorialOrden, type OrdenTaller, type Usuario } from "../datos/tipos";
import { usePanel } from "../contexto";
import { Dialogo } from "../ui";
import { ESTADOS_ORDEN, NOMBRE_ESTADO, nombreCombustible, type EstadoOrden, type Trabajo } from "../util/reglasOrden";
import EditorTrabajos from "./EditorTrabajos";
import { descargarActa } from "../recepcion/ActaLista";
import { Boton } from "../../compartido/ui/base";
import { haceCuanto } from "../../compartido/util/fechas";
import { enlaceWhatsApp } from "../../compartido/util/mensajes";
import { celularE164 } from "../../compartido/util/validaciones";
import { TALLER } from "../../compartido/config";

export const pesos = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }));
export const ETIQUETA_PRESUPUESTO: Record<string, { t: string; c: string }> = {
  no_requerido: { t: "Sin presupuesto previo", c: "bg-fondo text-suave" }, pendiente: { t: "Presupuesto pendiente", c: "bg-aviso-fondo text-aviso" },
  aprobado: { t: "Presupuesto aprobado", c: "bg-ok-fondo text-ok" }, rechazado: { t: "Presupuesto rechazado", c: "bg-marca-suave text-marca" },
};

export function mensajeEstado(o: OrdenTaller) {
  const n = o.cliente.nombre.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0];
  const link = o.codigo ? ` Puedes ver el detalle en ${location.origin}/consultar con el código ${o.codigo} y los últimos 4 dígitos de tu documento.` : "";
  if (o.estado === "esperando_aprobacion" && o.presupuesto.enviadoEn)
    return `Hola ${n}, el presupuesto para tu ${o.vehiculo.marca} ${o.vehiculo.placa} está listo: ${pesos(o.presupuesto.total)}.${link} Ahí mismo lo puedes aprobar o rechazar.`;
  if (o.estado === "entregado") return `Hola ${n}, gracias por confiar en ${TALLER.nombre}. Tu ${o.vehiculo.marca} ${o.vehiculo.placa} quedó entregado${o.garantiaHasta ? ` con garantía hasta el ${o.garantiaHasta}` : ""}. Te avisaremos cuando te toque el próximo mantenimiento.`;
  if (o.estado === "listo") return `Hola ${n}, tu ${o.vehiculo.marca} ${o.vehiculo.placa} está listo para entregar en ${TALLER.nombre}. ¿A qué hora pasas?${link}`;
  return `Hola ${n}, te contamos cómo va tu ${o.vehiculo.marca} ${o.vehiculo.placa}: ${NOMBRE_ESTADO[o.estado].toLowerCase()}.${link}`;
}

export default function DetalleOrden({ orden, onCerrar, pedirEstado, onCambio }: { orden: OrdenTaller | null; onCerrar: () => void; pedirEstado: (o: OrdenTaller, e: EstadoOrden) => void; onCambio: () => void }) {
  const { usuario } = usePanel();
  const [historial, setHistorial] = useState<HistorialOrden[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [total, setTotal] = useState("");
  const [resp, setResp] = useState<{ decision: "aprobado" | "rechazado"; nota: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [pdf, setPdf] = useState(false);

  useEffect(() => {
    if (!orden) return;
    setTrabajos(orden.trabajos); setTotal(orden.presupuesto.total ? String(orden.presupuesto.total) : ""); setAviso(""); setResp(null);
    apiTaller.historialOrden(orden.id).then(setHistorial).catch(() => {});
    apiTaller.tecnicos().then(setTecnicos).catch(() => {});
  }, [orden]);

  if (!orden) return <Dialogo titulo="" abierto={false} onCerrar={onCerrar}>{null}</Dialogo>;
  const cerrada = orden.estado === "entregado" || orden.estado === "cancelado";
  const cambiaron = JSON.stringify(trabajos) !== JSON.stringify(orden.trabajos);
  async function hacer(fn: () => Promise<void>, ok: string) {
    setAviso("");
    try { await fn(); setAviso("✓ " + ok); onCambio(); } catch (e) { setAviso("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo guardar.")); }
  }
  // Sin presupuesto previo, "Esperando aprobación" no aplica: se salta en los botones.
  const pasos = ESTADOS_ORDEN.filter((e) => orden.autorizaPresupuestoPrevio || e !== "esperando_aprobacion");
  const idx = pasos.indexOf(orden.estado as (typeof ESTADOS_ORDEN)[number]);
  const p = orden.presupuesto;

  return (
    <Dialogo titulo={`${orden.vehiculo.placa} · ${NOMBRE_ESTADO[orden.estado]}`} abierto={!!orden} onCerrar={onCerrar} ancho="max-w-3xl">
      {aviso && <p role="status" className={`mb-3 rounded-xl px-3 py-2 ${aviso.startsWith("✓") ? "bg-ok-fondo text-ok" : "bg-aviso-fondo text-aviso"}`}>{aviso}</p>}
      <p className="mb-1 font-bold">{[orden.vehiculo.marca, orden.vehiculo.linea].filter(Boolean).join(" ")} · {orden.cliente.nombre} · {orden.cliente.celular}</p>
      <p className="mb-3 text-sm text-suave">
        {orden.codigo && <>Código {orden.codigo} · </>}En el taller desde {haceCuanto(orden.creadoEn)} · Km ingreso {orden.kmIngreso?.toLocaleString("es-CO") ?? "—"}
        {" · "}{orden.autorizaPresupuestoPrevio ? "Pidió presupuesto previo" : "Autorizó sin presupuesto"} · Prueba de ruta: {orden.autorizaPruebaRuta ? "sí" : "NO"}
      </p>

      {!cerrada && (
        <section className="mb-4">
          <h3 className="mb-2 font-bold text-suave">Mover a</h3>
          <div className="flex flex-wrap gap-2">
            {idx > 0 && <Boton variante="secundario" onClick={() => pedirEstado(orden, pasos[idx - 1])}>← {NOMBRE_ESTADO[pasos[idx - 1]]}</Boton>}
            {idx >= 0 && idx < pasos.length - 1 && <Boton onClick={() => pedirEstado(orden, pasos[idx + 1])}>{NOMBRE_ESTADO[pasos[idx + 1]]} →</Boton>}
            <Boton variante="fantasma" onClick={() => confirm("¿Cancelar esta orden? El vehículo sale sin trabajos.") && pedirEstado(orden, "cancelado")}>Cancelar orden</Boton>
          </div>
        </section>
      )}

      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="font-bold">Técnico asignado
          <select className="campo mt-1" value={orden.tecnico?.id ?? ""} disabled={cerrada} onChange={(e) => hacer(() => apiTaller.asignarTecnico(orden.id, e.target.value || null), "Técnico asignado.")}>
            <option value="">Sin asignar</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <Boton variante="secundario" disabled={pdf} onClick={async () => { setPdf(true); try { await descargarActa(orden.recepcionId); } finally { setPdf(false); } }}>{pdf ? "Generando…" : "📄 Acta PDF"}</Boton>
          <a href={enlaceWhatsApp(celularE164(orden.cliente.celular), mensajeEstado(orden))} target="_blank" rel="noreferrer"
            className="inline-flex min-h-12 items-center rounded-xl bg-[#1f7a43] px-4 font-bold text-white no-underline">💬 Avisar al cliente</a>
        </div>
      </section>

      <section className="mb-4">
        <h3 className="mb-2 font-bold text-suave">Trabajos</h3>
        <EditorTrabajos trabajos={trabajos} onCambio={setTrabajos} soloLectura={cerrada} />
        {cambiaron && <Boton className="mt-2" onClick={() => hacer(() => apiTaller.guardarTrabajos(orden.id, trabajos.filter((t) => t.descripcion.trim())), "Trabajos guardados.")}>Guardar trabajos</Boton>}
      </section>

      {orden.autorizaPresupuestoPrevio && (
        <section className="mb-4 rounded-xl border border-borde p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="font-bold">Presupuesto</h3>
            <span className={`rounded-full px-2 text-sm font-bold ${ETIQUETA_PRESUPUESTO[p.estado].c}`}>{ETIQUETA_PRESUPUESTO[p.estado].t}</span>
            {p.enviadoEn && <span className="text-sm text-suave">enviado {haceCuanto(p.enviadoEn)}{p.aprobadoPor && ` · ${p.aprobadoPor === "cliente_portal" ? "respondió el cliente en el portal" : p.aprobadoPor}`}</span>}
          </div>
          {!cerrada && (
            <>
              <p className="mb-2 text-sm text-suave">El valor lo define el taller. Al enviarlo, el cliente lo ve en el portal con los trabajos de arriba y lo aprueba o rechaza con un botón.</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="font-bold">Total (COP)
                  <input className="campo mt-1 !w-48" inputMode="numeric" value={total ? Number(total).toLocaleString("es-CO") : ""} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} placeholder="0" />
                </label>
                <Boton disabled={!Number(total) || !trabajos.some((t) => t.descripcion.trim())}
                  onClick={() => hacer(() => apiTaller.enviarPresupuesto(orden.id, Number(total), trabajos.filter((t) => t.descripcion.trim())), "Presupuesto enviado. Avísale al cliente por WhatsApp.")}>
                  {p.enviadoEn ? "Reenviar presupuesto" : "Enviar presupuesto al cliente"}
                </Boton>
              </div>
              {p.estado === "pendiente" && p.enviadoEn && (
                <div className="mt-3">
                  {!resp ? (
                    <button type="button" className="text-sm font-bold text-marca underline" onClick={() => setResp({ decision: "aprobado", nota: "" })}>¿El cliente respondió por teléfono o en persona? Regístralo aquí</button>
                  ) : (
                    <div className="grid gap-2 rounded-lg bg-fondo p-2">
                      <div className="flex gap-2">{(["aprobado", "rechazado"] as const).map((x) => (
                        <button key={x} type="button" aria-pressed={resp.decision === x} onClick={() => setResp({ ...resp, decision: x })} className={`rounded-lg border-2 px-3 py-1 font-bold ${resp.decision === x ? "border-marca bg-marca-suave" : "border-borde"}`}>{x === "aprobado" ? "Aprobó" : "Rechazó"}</button>
                      ))}</div>
                      <input aria-label="¿Cómo respondió?" className="campo" placeholder="Ej.: aprobó por llamada a las 10 a. m." value={resp.nota} onChange={(e) => setResp({ ...resp, nota: e.target.value })} />
                      <Boton disabled={resp.nota.trim().length < 5} onClick={() => hacer(() => apiTaller.registrarRespuestaPresupuesto(orden.id, resp.decision, resp.nota), "Respuesta registrada.").then(() => setResp(null))}>Registrar respuesta</Boton>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {cerrada && <p>Total: <strong>{pesos(p.total)}</strong></p>}
        </section>
      )}

      {orden.estado === "entregado" && (
        <p className="mb-4 rounded-xl bg-ok-fondo p-3 text-ok">Entregado {orden.fechaEntrega && haceCuanto(orden.fechaEntrega)} · Km salida {orden.kmSalida?.toLocaleString("es-CO")}{orden.nivelCombustibleSalida != null && ` · Combustible ${nombreCombustible(orden.nivelCombustibleSalida)}`} · Garantía hasta {orden.garantiaHasta}</p>
      )}

      <section>
        <h3 className="mb-2 font-bold text-suave">Historial</h3>
        <ol className="relative ml-2 border-l-2 border-borde">
          {historial.map((h, i) => (
            <li key={i} className="mb-3 ml-4">
              <span aria-hidden className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-marca" />
              <p className="font-bold">{NOMBRE_ESTADO[h.estado as EstadoOrden] ?? h.estado} <span className="font-normal text-suave">· {new Date(h.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })} · {h.usuario}</span></p>
              {h.nota && <p className="text-sm">{h.nota}</p>}
            </li>
          ))}
        </ol>
        {usuario.rol !== "admin" && cerrada && <p className="text-sm text-suave">Orden cerrada: solo el administrador puede reabrirla.</p>}
      </section>
    </Dialogo>
  );
}
