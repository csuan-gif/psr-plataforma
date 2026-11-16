import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiTaller } from "./datos/api";
import { ErrorTaller, type Color, type DetalleSolicitud as Detalle, type Plantillas } from "./datos/tipos";
import { usePanel } from "./contexto";
import { ChipColor, COLOR_INFO, Dialogo, ESTADO_CITA, MOVILIDAD, nombreSintoma, nombreZona } from "./ui";
import RedactorWhatsApp from "./RedactorWhatsApp";
import SelectorFranja from "./SelectorFranja";
import { Boton } from "../compartido/ui/base";
import { haceCuanto } from "../compartido/util/fechas";
import { textoCita } from "../compartido/util/mensajes";
import type { Adjunto } from "../compartido/datos/tipos";
import type { Franja } from "../compartido/config";

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="mb-4"><h3 className="mb-2 font-bold text-suave">{titulo}</h3>{children}</section>;
}
const F = ({ k, v }: { k: string; v?: ReactNode }) => (v ? <><dt className="text-suave">{k}</dt><dd className="break-words">{v}</dd></> : null);

export function Archivos({ adjuntos }: { adjuntos: Adjunto[] }) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let vivo = true;
    Promise.all(adjuntos.map(async (a) => [a.ruta, await apiTaller.urlArchivo(a.ruta).catch(() => null)] as const))
      .then((l) => vivo && setUrls(Object.fromEntries(l)));
    return () => { vivo = false; };
  }, [adjuntos]);
  if (!adjuntos.length) return <p className="text-suave">Sin archivos.</p>;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {adjuntos.map((a) => {
        const u = urls[a.ruta];
        return (
          <li key={a.ruta} className="overflow-hidden rounded-xl border border-borde">
            {!u ? <div className="p-3 text-sm text-suave">{a.tipo === "audio" ? "🎙" : a.tipo === "video" ? "🎬" : "🖼"} {a.nombre}{u === null && " (no disponible en este navegador)"}</div>
              : a.tipo === "video" ? <video src={u} controls preload="metadata" className="w-full" />
              : a.tipo === "audio" ? <div className="p-2"><p className="mb-1 text-sm">🎙 Nota de voz</p><audio src={u} controls className="w-full" /></div>
              : <a href={u} target="_blank" rel="noreferrer"><img src={u} alt={a.tipo === "tarjeta" ? "Tarjeta de propiedad" : `Foto: ${a.nombre}`} className="aspect-square w-full object-cover" /></a>}
          </li>
        );
      })}
    </ul>
  );
}

export default function DetalleSolicitud({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { otros, verSolicitud, marcarVista, recargar, ultimoCambio } = usePanel();
  const nav = useNavigate();
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState("");
  const [modo, setModo] = useState<"" | "color" | "reprogramar" | "agendar">("");
  const [color, setColor] = useState<Color>("amarillo");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<keyof Plantillas>("recibida");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    if (!id) return;
    try { setD(await apiTaller.detalle(id)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo abrir."); }
  }, [id]);

  useEffect(() => {
    if (!id) { setD(null); return; }
    setModo(""); setAviso(""); setMsg("recibida");
    void cargar(); marcarVista(id); verSolicitud(id);
    return () => verSolicitud(null);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si otro usuario cambia algo, se refresca la ficha abierta.
  useEffect(() => { if (id && d) void cargar(); }, [ultimoCambio]); // eslint-disable-line react-hooks/exhaustive-deps

  async function hacer(fn: () => Promise<void>, ok: string, siguienteMensaje?: keyof Plantillas) {
    setOcupado(true); setAviso("");
    try {
      await fn(); await recargar(); await cargar(); setModo("");
      setAviso(ok); if (siguienteMensaje) setMsg(siguienteMensaje);
    } catch (e) { setAviso("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo completar.")); }
    finally { setOcupado(false); }
  }

  const mirando = otros.filter((o) => o.viendo === id);
  const cita = d?.cita && !["cancelada"].includes(d.cita.estado) ? d.cita : null;
  const datosMsg = d && {
    nombre: d.cliente.nombre, codigo: d.codigo, placa: d.vehiculo.placa,
    vehiculo: [d.vehiculo.marca, d.vehiculo.linea].filter(Boolean).join(" "), fecha: d.cita?.fecha, franja: d.cita?.franja as Franja | undefined,
  };
  const rep = d?.datosReportados;
  const difiere = !!d && !!rep?.esClienteExistente && !!(rep?.cliente && (rep.cliente.celular !== d.cliente.celular || (rep.cliente.nombre && rep.cliente.nombre !== d.cliente.nombre)));

  return (
    <Dialogo titulo={d ? `${d.vehiculo.placa} · ${d.codigo}` : "Solicitud"} abierto={!!id} onCerrar={onCerrar} ancho="max-w-3xl">
      {error && <p role="alert" className="text-marca">{error}</p>}
      {!d && !error && <p className="text-suave">Cargando…</p>}
      {d && datosMsg && (
        <>
          {mirando.length > 0 && (
            <p role="status" className="mb-3 rounded-xl bg-aviso-fondo px-3 py-2 font-bold text-aviso">👀 {mirando.map((m) => m.nombre).join(" y ")} {mirando.length > 1 ? "están" : "está"} viendo esta solicitud. Coordinen para no responder dos veces.</p>
          )}
          {aviso && <p role="status" className="mb-3 rounded-xl bg-ok-fondo px-3 py-2 text-ok">{aviso}</p>}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ChipColor color={d.semaforo.final} ajustado={d.semaforo.auto !== d.semaforo.final} />
            <span className="text-sm text-suave">Llegó {haceCuanto(d.creadoEn)} · {new Date(d.creadoEn).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="rounded-full border border-borde px-2 text-sm">{{ nueva: "Nueva", en_revision: "En revisión", atendida: "Atendida", convertida: "En taller", descartada: "Descartada" }[d.estado]}</span>
          </div>

          <div className="grid gap-x-6 md:grid-cols-2">
            <Seccion titulo="Cliente">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <F k="Nombre" v={d.cliente.nombre} />
                <F k="Documento" v={`${d.cliente.tipoDocumento} ${d.cliente.numeroDocumento}${d.cliente.digitoVerificacion ? "-" + d.cliente.digitoVerificacion : ""}`} />
                <F k="Celular" v={<a href={`tel:${d.cliente.celular}`} className="text-marca underline">{d.cliente.celular}</a>} />
                <F k="Correo" v={d.cliente.correo} /><F k="Dirección" v={d.cliente.direccion} />
              </dl>
              {difiere && (
                <p className="mt-2 rounded-lg bg-aviso-fondo p-2 text-sm text-aviso">
                  Cliente registrado. En esta solicitud escribió: {String(rep!.cliente!.nombre ?? "")} · {String(rep!.cliente!.celular ?? "")}. Verifica en la recepción antes de actualizar su ficha.
                </p>
              )}
            </Seccion>
            <Seccion titulo="Vehículo">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <F k="Placa" v={<strong>{d.vehiculo.placa}</strong>} />
                <F k="Vehículo" v={[d.vehiculo.marca, d.vehiculo.linea, d.vehiculo.anio].filter(Boolean).join(" ")} />
                <F k="Color" v={d.vehiculo.color} /><F k="Combustible" v={d.vehiculo.combustible} />
                <F k="Km" v={(d.kmReportado ?? d.vehiculo.km)?.toLocaleString("es-CO")} /><F k="VIN" v={d.vehiculo.vin} />
              </dl>
            </Seccion>
          </div>

          <Seccion titulo="Lo que reporta el cliente">
            <p className="mb-1"><strong>Zonas:</strong> {d.zonas.map(nombreZona).join(", ")}</p>
            {d.sintomas.length > 0 && <ul className="mb-1 list-disc pl-5">{d.sintomas.map((s) => <li key={s}>{nombreSintoma(s)}</li>)}</ul>}
            {d.descripcion && <p className="mb-1 rounded-lg bg-fondo p-2">«{d.descripcion}»</p>}
            <p className={d.movilidad === "si" ? "" : "font-bold text-marca"}>{MOVILIDAD[d.movilidad]}{d.desdeCuando && ` · Desde: ${d.desdeCuando.toLowerCase()}`}</p>
            <p className="text-sm text-suave">Presupuesto: {d.presupuesto === "previo" ? "pide presupuesto previo" : "autoriza reparar sin presupuesto"} · Prueba de ruta: {d.pruebaRuta ? "autorizada" : "NO autorizada"}</p>
          </Seccion>

          <Seccion titulo="Fotos, video y voz"><Archivos adjuntos={d.adjuntos} /></Seccion>

          <Seccion titulo="Cita">
            <p className="mb-2">{cita ? <>{textoCita(cita.fecha, cita.franja as Franja)} · <strong>{ESTADO_CITA[cita.estado]}</strong></> : "Sin cita activa (cotización, información o cancelada)."}</p>
            <div className="flex flex-wrap gap-2">
              {cita && cita.estado !== "confirmada" && <Boton disabled={ocupado} onClick={() => hacer(() => apiTaller.estadoCita(cita.id, "confirmada"), "Cita confirmada. Avísale al cliente por WhatsApp 👇", "confirmar")}>✓ Confirmar</Boton>}
              {cita && <Boton variante="secundario" disabled={ocupado} onClick={() => setModo(modo === "reprogramar" ? "" : "reprogramar")}>Proponer otra fecha</Boton>}
              {cita && <Boton variante="secundario" disabled={ocupado} onClick={() => confirm("¿Rechazar o cancelar esta cita? El cupo queda libre.") && hacer(() => apiTaller.estadoCita(cita.id, "cancelada", "Rechazada por el taller"), "Cita cancelada. Avísale al cliente 👇", "rechazar")}>Rechazar</Boton>}
              {cita?.estado === "confirmada" && <Boton variante="fantasma" disabled={ocupado} onClick={() => hacer(() => apiTaller.estadoCita(cita.id, "no_asistio"), "Marcada como no asistió.")}>No asistió</Boton>}
              {!cita && <Boton variante="secundario" disabled={ocupado} onClick={() => setModo(modo === "agendar" ? "" : "agendar")}>Agendar cita</Boton>}
            </div>
            {modo === "reprogramar" && cita && (
              <div className="mt-3"><SelectorFranja textoBoton="Mover la cita aquí" ocupado={ocupado}
                onElegir={(f, fr, forzar) => hacer(() => apiTaller.reprogramarCita(cita.id, f, fr, forzar), "Cita movida. Proponle la nueva fecha al cliente 👇", "reprogramar")} /></div>
            )}
            {modo === "agendar" && (
              <div className="mt-3"><SelectorFranja textoBoton="Agendar (queda confirmada)" ocupado={ocupado}
                onElegir={(f, fr, forzar) => hacer(() => apiTaller.crearCita(d.id, f, fr, forzar), "Cita agendada. Avísale al cliente 👇", "confirmar")} /></div>
            )}
          </Seccion>

          <Seccion titulo="Responder">
            <RedactorWhatsApp celular={d.cliente.celular} datos={datosMsg} inicial={msg} />
          </Seccion>

          <Seccion titulo="Semáforo interno (solo lo ve el taller)">
            <p className="mb-1 text-sm">Calculado: <strong>{COLOR_INFO[d.semaforo.auto].nombre}</strong>{d.semaforo.auto !== d.semaforo.final && <> · Ajustado a <strong>{COLOR_INFO[d.semaforo.final].nombre}</strong></>}</p>
            <details className="mb-2 text-sm"><summary className="cursor-pointer text-suave">¿Por qué este color?</summary><ul className="list-disc pl-5">{d.semaforo.razones.map((r) => <li key={r}>{r.replace(/Síntoma marcado: (\S+)/, (_, s) => "Síntoma: " + nombreSintoma(s))}</li>)}</ul></details>
            {d.cambios.length > 0 && <ul className="mb-2 text-sm">{d.cambios.map((c, i) => <li key={i}>✎ {COLOR_INFO[c.de].corto} → {COLOR_INFO[c.a].corto} · «{c.motivo}» · {c.usuario ?? "—"} · {haceCuanto(c.fecha)}</li>)}</ul>}
            {modo !== "color" ? <Boton variante="secundario" onClick={() => { setModo("color"); setColor(d.semaforo.final); setMotivo(""); }}>Cambiar color</Boton> : (
              <div className="grid gap-2 rounded-xl border border-borde p-3">
                <div role="radiogroup" aria-label="Nuevo color" className="flex flex-wrap gap-2">
                  {(["rojo", "amarillo", "verde"] as Color[]).map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={color === c} onClick={() => setColor(c)}
                      className={`rounded-full border-2 p-0.5 ${color === c ? "border-texto" : "border-transparent"}`}><ChipColor color={c} /></button>
                  ))}
                </div>
                <label htmlFor="motivo" className="font-bold">Motivo (obligatorio)</label>
                <input id="motivo" className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: hablé con el cliente, son pastillas gastadas" />
                <div className="flex gap-2">
                  <Boton disabled={ocupado || motivo.trim().length < 5 || color === d.semaforo.final} onClick={() => hacer(() => apiTaller.cambiarSemaforo(d.id, color, motivo), "Color actualizado y registrado.")}>Guardar</Boton>
                  <Boton variante="fantasma" onClick={() => setModo("")}>Cancelar</Boton>
                </div>
              </div>
            )}
          </Seccion>

          <div className="flex flex-wrap gap-2 border-t border-borde pt-3">
            {d.estado !== "convertida" && <Boton onClick={() => nav("/taller/recepcion/" + d.id)}>🚗 Recibir vehículo (acta)</Boton>}
            {d.estado !== "atendida" && d.estado !== "convertida" && <Boton variante="secundario" disabled={ocupado} onClick={() => hacer(() => apiTaller.marcarSolicitud(d.id, "atendida"), "Marcada como atendida.")}>Marcar como atendida</Boton>}
            {d.estado === "atendida" && <Boton variante="secundario" disabled={ocupado} onClick={() => hacer(() => apiTaller.marcarSolicitud(d.id, "en_revision"), "Volvió a la bandeja.")}>Volver a la bandeja</Boton>}
            {d.estado !== "descartada" && <Boton variante="fantasma" disabled={ocupado} onClick={() => confirm("¿Descartar esta solicitud (spam, duplicada o de prueba)?") && hacer(() => apiTaller.marcarSolicitud(d.id, "descartada"), "Solicitud descartada.")}>Descartar</Boton>}
          </div>
        </>
      )}
    </Dialogo>
  );
}
