import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../compartido/datos/api";
import { ErrorApi, type EstadoPublico } from "../compartido/datos/tipos";
import { Aviso, Boton, Campo, Marco, Tarjeta } from "../compartido/ui/base";
import { textoCita } from "../compartido/util/mensajes";
import { fechaLarga } from "../compartido/util/fechas";

const ESTADO_CITA: Record<string, string> = {
  pendiente: "Pendiente de confirmación", confirmada: "Confirmada", reprogramada: "El taller te propuso otra fecha", cancelada: "Cancelada", no_asistio: "No asististe",
};
const pesos = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function Consultar() {
  const loc = useLocation();
  const [codigo, setCodigo] = useState((loc.state as { codigo?: string } | null)?.codigo ?? "");
  const [doc4, setDoc4] = useState("");
  const [estado, setEstado] = useState<EstadoPublico | null>(null);
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(false);
  const [decidiendo, setDecidiendo] = useState<"aprobado" | "rechazado" | null>(null);

  const consultar = useCallback(async (silencioso = false) => {
    if (!codigo || doc4.length !== 4) { setMsg("Escribe el código y los últimos 4 dígitos de tu documento."); return; }
    if (!silencioso) { setCargando(true); setMsg(""); }
    try {
      const r = await api.consultarEstado(codigo.trim().toUpperCase(), doc4);
      if (!r && !silencioso) setMsg("No encontramos esa solicitud. Revisa el código y los dígitos.");
      if (r || !silencioso) setEstado(r);
    } catch (e) { if (!silencioso) setMsg(e instanceof ErrorApi ? e.message : "No pudimos consultar. Intenta de nuevo."); }
    finally { setCargando(false); }
  }, [codigo, doc4]);

  // Mientras la página esté abierta, se actualiza sola cada 2 minutos (respeta el límite de consultas).
  useEffect(() => {
    if (!estado) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && consultar(true), 120000);
    return () => window.clearInterval(t);
  }, [estado, consultar]);

  async function responder(decision: "aprobado" | "rechazado") {
    setCargando(true); setMsg("");
    try {
      const ok = await api.responderPresupuesto(codigo.trim().toUpperCase(), doc4, decision);
      setDecidiendo(null);
      setMsg(ok ? (decision === "aprobado" ? "✓ Aprobaste el presupuesto. El taller ya puede empezar la reparación." : "Rechazaste el presupuesto. El taller te contactará para la entrega.") : "No se pudo registrar tu respuesta. Puede que ya hayas respondido.");
      await consultar(true);
    } catch (e) { setMsg(e instanceof ErrorApi ? e.message : "No pudimos registrar tu respuesta."); }
    finally { setCargando(false); }
  }

  const actual = estado ? [...estado.pasos].reverse().find((p) => p.hecho) : null;

  return (
    <Marco titulo="Consultar mi vehículo">
      <h1 className="mb-1 text-2xl font-bold">Consultar mi vehículo</h1>
      <p className="mb-4 text-suave">Mira en qué va tu carro sin tener que llamar.</p>
      {!estado ? (
        <Tarjeta>
          <Campo id="codigo" etiqueta="Código de seguimiento" ayuda="Ej.: PSR-7K3Q9M">
            <input id="codigo" className="campo font-mono uppercase tracking-widest" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
          </Campo>
          <Campo id="doc4c" etiqueta="Últimos 4 dígitos de tu documento">
            <input id="doc4c" className="campo max-w-40 text-center tracking-[0.3em]" inputMode="numeric" maxLength={4} value={doc4} onChange={(e) => setDoc4(e.target.value.replace(/\D/g, ""))} />
          </Campo>
          {msg && <p role="alert" className="mb-3 text-aviso">⚠ {msg}</p>}
          <Boton onClick={() => consultar()} disabled={cargando} className="w-full">{cargando ? "Consultando…" : "Consultar"}</Boton>
        </Tarjeta>
      ) : (
        <div className="entrar">
          <Tarjeta className="mb-4">
            <p className="text-sm text-suave">{estado.codigo}</p>
            <p className="text-xl font-bold">{estado.placa} · {estado.linea}</p>
            {actual && <p className="mt-1 text-lg">Estado: <strong>{actual.nombre}</strong></p>}
            {estado.cita && !estado.pasos.find((p) => p.clave === "recibido")?.hecho && (
              <p className="mt-1">Cita: {textoCita(estado.cita.fecha, estado.cita.franja)} — <strong>{ESTADO_CITA[estado.cita.estado] ?? estado.cita.estado}</strong></p>
            )}
          </Tarjeta>

          {msg && <div className="mb-4"><Aviso tono={msg.startsWith("✓") ? "ok" : "aviso"}>{msg}</Aviso></div>}
          {estado.cancelada && <div className="mb-4"><Aviso>La orden de trabajo fue cancelada. Si tienes dudas, escríbele al taller.</Aviso></div>}

          {estado.presupuesto && (
            <Tarjeta className={`mb-4 ${estado.presupuesto.estado === "pendiente" ? "border-2 border-marca" : ""}`}>
              <h2 className="mb-2 text-lg font-bold">Presupuesto del taller</h2>
              <ul className="mb-2 list-disc pl-5">
                {estado.presupuesto.trabajos.map((t, i) => <li key={i}>{t.descripcion}{t.repuestos && <span className="text-suave"> · repuestos: {t.repuestos}</span>}</li>)}
              </ul>
              <p className="text-2xl font-bold">{pesos(estado.presupuesto.total)}</p>
              <p className="mb-3 text-sm text-suave">Enviado el {fechaLarga(estado.presupuesto.enviadoEn.slice(0, 10))}. Valor definido por el taller; si tienes dudas, escríbele antes de responder.</p>
              {estado.presupuesto.estado === "pendiente" ? (
                decidiendo ? (
                  <div className="grid gap-2 rounded-xl bg-fondo p-3">
                    <p className="font-bold">{decidiendo === "aprobado" ? `¿Confirmas que APRUEBAS el presupuesto por ${pesos(estado.presupuesto.total)}?` : "¿Confirmas que RECHAZAS el presupuesto?"}</p>
                    <p className="text-sm text-suave">Tu respuesta queda registrada con la fecha y la hora.</p>
                    <div className="flex gap-2">
                      <Boton disabled={cargando} onClick={() => responder(decidiendo)}>{cargando ? "Enviando…" : "Sí, confirmo"}</Boton>
                      <Boton variante="secundario" onClick={() => setDecidiendo(null)}>Volver</Boton>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Boton onClick={() => setDecidiendo("aprobado")}>✓ Aprobar presupuesto</Boton>
                    <Boton variante="secundario" onClick={() => setDecidiendo("rechazado")}>Rechazar</Boton>
                  </div>
                )
              ) : (
                <p className={`font-bold ${estado.presupuesto.estado === "aprobado" ? "text-ok" : "text-marca"}`}>{estado.presupuesto.estado === "aprobado" ? "✓ Aprobado" : "Rechazado"}</p>
              )}
            </Tarjeta>
          )}

          {estado.entrega && (
            <div className="mb-4"><Aviso tono="ok">Vehículo entregado el {fechaLarga(estado.entrega.fecha.slice(0, 10))}. Garantía hasta el {fechaLarga(estado.entrega.garantiaHasta)}.</Aviso></div>
          )}

          <ol className="relative ml-3 border-l-2 border-borde" aria-label="Línea de tiempo">
            {estado.pasos.map((p) => {
              const esActual = p === actual && !estado.entrega;
              return (
                <li key={p.clave} className="mb-5 ml-5">
                  <span aria-hidden className={`absolute -left-[11px] mt-1 grid h-5 w-5 place-items-center rounded-full border-2 text-xs ${p.hecho ? "border-ok bg-ok text-white" : "border-borde bg-superficie"} ${esActual ? "ring-4 ring-ok-fondo" : ""}`}>{p.hecho ? "✓" : ""}</span>
                  <p className={p.hecho ? "font-bold" : "text-suave"}>{p.nombre}{esActual && <span className="ml-2 rounded-full bg-ok-fondo px-2 text-xs text-ok">ahora</span>}</p>
                  {p.fecha && <p className="text-sm text-suave">{new Date(p.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</p>}
                  {p.nota && <p className="text-sm text-suave">{p.nota}</p>}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => consultar()} disabled={cargando}>↻ Actualizar</Boton>
            <Boton variante="fantasma" onClick={() => { setEstado(null); setMsg(""); }}>Consultar otra</Boton>
          </div>
        </div>
      )}
    </Marco>
  );
}
