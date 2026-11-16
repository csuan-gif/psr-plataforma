import { useCallback, useEffect, useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type FichaCliente as Ficha, type VehiculoFicha } from "../datos/tipos";
import { usePanel } from "../contexto";
import { Dialogo, nombreSintoma, nombreZona } from "../ui";
import { NOMBRE_ESTADO, type EstadoOrden } from "../util/reglasOrden";
import { pesos } from "../ordenes/DetalleOrden";
import { descargarActa } from "../recepcion/ActaLista";
import { Boton } from "../../compartido/ui/base";
import { cuandoTexto } from "../../compartido/util/mantenimiento";
import { fechaLarga, hoyBogota } from "../../compartido/util/fechas";

const fecha = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Vehiculo({ v, puedeEditar, onCambio }: { v: VehiculoFicha; puedeEditar: boolean; onCambio: (m: string) => void }) {
  const [soat, setSoat] = useState(v.fechaSoat ?? "");
  const [rtm, setRtm] = useState(v.fechaTecnomecanica ?? "");
  const hoy = hoyBogota();
  const cambiado = soat !== (v.fechaSoat ?? "") || rtm !== (v.fechaTecnomecanica ?? "");
  // Ayuda (no es una regla): particulares nuevos tienen la primera RTM al 5.º año de matrícula; luego es anual.
  const ayudaRtm = !v.fechaTecnomecanica && v.anio ? `Si es particular, la primera revisión es al 5.º año de matrícula (aprox. ${v.anio + 5}); luego cada año. Verifícalo en la tarjeta o el RUNT.` : null;

  return (
    <details open className="mb-3 rounded-2xl border border-borde">
      <summary className="cursor-pointer px-4 py-3 text-lg font-bold">{v.placa} · {[v.marca, v.linea, v.anio].filter(Boolean).join(" ")}</summary>
      <div className="grid gap-3 border-t border-borde px-4 py-3">
        <p className="text-sm">
          {v.color && <>Color {v.color} · </>}{v.vin && <>VIN {v.vin} · </>}
          Km {v.km?.toLocaleString("es-CO") ?? "—"} {v.kmFecha && `(${fecha(v.kmFecha)})`} · {v.kmDia ? <strong>~{v.kmDia.toLocaleString("es-CO")} km/día</strong> : <span className="text-suave">km/día: falta historial</span>}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-bold">Vence SOAT
            <input type="date" className="campo mt-1" value={soat} disabled={!puedeEditar} onChange={(e) => setSoat(e.target.value)} />
          </label>
          <label className="text-sm font-bold">Vence técnico-mecánica
            <input type="date" className="campo mt-1" value={rtm} disabled={!puedeEditar} onChange={(e) => setRtm(e.target.value)} />
          </label>
        </div>
        {ayudaRtm && <p className="text-xs text-suave">{ayudaRtm}</p>}
        {cambiado && <Boton className="justify-self-start" onClick={async () => {
          try { await apiTaller.actualizarVehiculo(v.id, { fechaSoat: soat || null, fechaTecnomecanica: rtm || null }); onCambio("Vencimientos guardados; los recordatorios se actualizaron."); }
          catch { onCambio("⚠ No se pudieron guardar las fechas."); }
        }}>Guardar vencimientos</Boton>}

        <div>
          <h4 className="mb-1 font-bold text-suave">Próximos mantenimientos</h4>
          {v.recordatorios.length === 0 ? <p className="text-sm text-suave">Ninguno programado.</p> : (
            <ul className="text-sm">{v.recordatorios.map((r) => (
              <li key={r.id}>⏰ {r.servicio} — {r.fechaObjetivo ? `${fecha(r.fechaObjetivo)} (${cuandoTexto(r.fechaObjetivo, hoy)})` : "sin fecha"}{r.kmEstimado && ` o ${r.kmEstimado.toLocaleString("es-CO")} km`} · <span className="text-suave">{r.estado}</span></li>
            ))}</ul>
          )}
        </div>

        <div>
          <h4 className="mb-1 font-bold text-suave">Órdenes de trabajo y garantías</h4>
          {v.ordenes.length === 0 ? <p className="text-sm text-suave">Sin órdenes.</p> : (
            <ul className="grid gap-2">{v.ordenes.map((o) => {
              const vigente = o.garantiaHasta && o.garantiaHasta >= hoy;
              return (
                <li key={o.id} className="rounded-xl bg-fondo p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{fecha(o.fechaEntrega ?? o.creadoEn)}</strong>
                    <span className="rounded-full border border-borde px-2">{NOMBRE_ESTADO[o.estado as EstadoOrden] ?? o.estado}</span>
                    {o.garantiaHasta && <span className={`rounded-full px-2 font-bold ${vigente ? "bg-ok-fondo text-ok" : "bg-borde text-suave"}`}>Garantía {vigente ? "vigente" : "vencida"} hasta {fecha(o.garantiaHasta)}</span>}
                    <button type="button" className="ml-auto font-bold text-marca underline" onClick={() => descargarActa(o.recepcionId)}>Acta PDF</button>
                  </div>
                  <p>Km {o.kmIngreso?.toLocaleString("es-CO") ?? "—"}{o.kmSalida && ` → ${o.kmSalida.toLocaleString("es-CO")}`}{o.presupuestoTotal != null && ` · Presupuesto ${pesos(o.presupuestoTotal)} (${o.presupuestoEstado})`}</p>
                  {o.trabajos.length > 0 && <ul className="list-disc pl-5">{o.trabajos.map((t, i) => <li key={i}>{t.descripcion}{t.repuestos && <span className="text-suave"> · {t.repuestos}</span>}</li>)}</ul>}
                </li>
              );
            })}</ul>
          )}
        </div>

        <div>
          <h4 className="mb-1 font-bold text-suave">Solicitudes</h4>
          {v.solicitudes.length === 0 ? <p className="text-sm text-suave">Sin solicitudes.</p> : (
            <ul className="text-sm">{v.solicitudes.map((s) => (
              <li key={s.id}>{fecha(s.creadoEn)} · <span className="font-mono">{s.codigo}</span> · {s.zonas.map(nombreZona).join(", ")}{s.sintomas.length > 0 && ": " + s.sintomas.slice(0, 2).map(nombreSintoma).join("; ")}</li>
            ))}</ul>
          )}
        </div>
      </div>
    </details>
  );
}

export default function FichaCliente({ id, onCerrar, onCambio }: { id: string | null; onCerrar: () => void; onCambio: () => void }) {
  const { usuario } = usePanel();
  const admin = usuario.rol === "admin";
  const [f, setF] = useState<Ficha | null>(null);
  const [edit, setEdit] = useState({ celular: "", correo: "", direccion: "" });
  const [msg, setMsg] = useState("");
  const [supr, setSupr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    const r = await apiTaller.fichaCliente(id); // queda en auditoría
    setF(r); setEdit({ celular: r.celular, correo: r.correo ?? "", direccion: r.direccion ?? "" });
  }, [id]);
  useEffect(() => { setF(null); setMsg(""); setSupr(null); void cargar(); }, [cargar]);

  async function hacer(fn: () => Promise<void>, ok: string) {
    setMsg("");
    try { await fn(); await cargar(); onCambio(); setMsg("✓ " + ok); } catch (e) { setMsg("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo guardar.")); }
  }
  const cambio = f && (edit.celular !== f.celular || edit.correo !== (f.correo ?? "") || edit.direccion !== (f.direccion ?? ""));

  return (
    <Dialogo titulo={f ? f.nombre : "Cliente"} abierto={!!id} onCerrar={onCerrar} ancho="max-w-3xl">
      {!f ? <p className="text-suave">Cargando…</p> : (
        <>
          {msg && <p role="status" className={`mb-3 rounded-xl px-3 py-2 ${msg.startsWith("✓") ? "bg-ok-fondo text-ok" : "bg-aviso-fondo text-aviso"}`}>{msg}</p>}
          {f.anonimizadoEn && <p className="mb-3 rounded-xl bg-fondo p-3">Datos personales suprimidos el {fecha(f.anonimizadoEn)}. Se conserva el historial del vehículo sin identificar a la persona.</p>}
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-borde px-2">{f.tipoDocumento} {f.numeroDocumento}</span>
            <span className={`rounded-full px-2 font-bold ${f.autorizaDatos ? "bg-ok-fondo text-ok" : "bg-aviso-fondo text-aviso"}`}>
              {f.autorizaDatos ? `Autorizó datos ${f.autorizaFecha ? "el " + fechaLarga(f.autorizaFecha.slice(0, 10)) : ""}` : "Sin autorización de datos registrada"}
            </span>
            {f.origen === "importado" && <span className="rounded-full bg-fondo px-2">Importado de Excel</span>}
            {f.verificado && <span className="rounded-full bg-fondo px-2">✓ Verificado en recepción</span>}
          </div>
          {!f.anonimizadoEn && (
            <section className="mb-4 grid gap-2 sm:grid-cols-3">
              <label className="text-sm font-bold">Celular<input className="campo mt-1" inputMode="tel" value={edit.celular} onChange={(e) => setEdit({ ...edit, celular: e.target.value })} /></label>
              <label className="text-sm font-bold">Correo<input className="campo mt-1" type="email" value={edit.correo} onChange={(e) => setEdit({ ...edit, correo: e.target.value })} /></label>
              <label className="text-sm font-bold">Dirección<input className="campo mt-1" value={edit.direccion} onChange={(e) => setEdit({ ...edit, direccion: e.target.value })} /></label>
              {cambio && <Boton className="sm:col-span-3 justify-self-start" onClick={() => hacer(() => apiTaller.actualizarCliente(f.id, edit), "Datos de contacto actualizados.")}>Guardar contacto</Boton>}
              <label className="flex items-center gap-2 sm:col-span-3">
                <input type="checkbox" className="h-5 w-5" checked={f.aceptaRecordatorios} onChange={(e) => hacer(() => apiTaller.actualizarCliente(f.id, { aceptaRecordatorios: e.target.checked }), e.target.checked ? "Recibirá recordatorios." : "No se le enviarán más recordatorios.")} />
                Acepta recordatorios de mantenimiento por WhatsApp
              </label>
            </section>
          )}

          <h3 className="mb-2 text-lg font-bold">Vehículos e historial</h3>
          {f.vehiculos.length === 0 && <p className="text-suave">Sin vehículos.</p>}
          {f.vehiculos.map((v) => <Vehiculo key={v.id} v={v} puedeEditar={!f.anonimizadoEn} onCambio={(m) => { setMsg(m.startsWith("⚠") ? m : "✓ " + m); void cargar(); }} />)}

          {admin && !f.anonimizadoEn && (
            <section className="mt-4 rounded-xl border border-marca/40 p-3">
              <h3 className="font-bold">Derecho de supresión (Ley 1581)</h3>
              <p className="mb-2 text-sm text-suave">Si el titular pide borrar sus datos, se anonimizan: se quitan nombre, documento, contacto y firmas, y se conserva el historial técnico del vehículo (garantías y deberes contables). No se puede deshacer.</p>
              {supr === null ? <Boton variante="secundario" onClick={() => setSupr("")}>Suprimir datos personales…</Boton> : (
                <div className="grid gap-2">
                  <input className="campo" placeholder="Motivo y canal de la solicitud (ej.: pidió por correo el 15/11)" value={supr} onChange={(e) => setSupr(e.target.value)} />
                  <div className="flex gap-2">
                    <Boton disabled={supr.trim().length < 5} onClick={() => confirm(`¿Seguro? Se borrarán para siempre los datos personales de ${f.nombre}.`) && hacer(() => apiTaller.anonimizarCliente(f.id, supr), "Datos suprimidos y registrados en la auditoría.")}>Confirmar supresión</Boton>
                    <Boton variante="fantasma" onClick={() => setSupr(null)}>Cancelar</Boton>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </Dialogo>
  );
}
