import { useState } from "react";
import { Link } from "react-router-dom";
import { apiTaller } from "../datos/api";
import { ErrorTaller } from "../datos/tipos";
import { Boton, Campo, Tarjeta } from "../../compartido/ui/base";
import { TALLER, aplicarConfig, type DatosTaller as Datos } from "../../compartido/config";
import { avisoCelular, avisoCorreo } from "../../compartido/util/validaciones";

/** Datos que ve el cliente en el portal (contacto, horarios) y los del aviso de privacidad. */
export default function DatosTaller() {
  const inicial = (): Datos => ({ nombre: TALLER.nombre, whatsapp: TALLER.whatsapp, telefono: TALLER.telefono, correo: TALLER.correo, direccion: TALLER.direccion, mapa: TALLER.mapa,
    horarios: TALLER.horarios.map((h) => ({ ...h })), responsableDatos: TALLER.responsableDatos, nit: TALLER.nit, conservacion: TALLER.conservacion, regionDatos: TALLER.regionDatos });
  const [d, setD] = useState<Datos>(inicial);
  const [msg, setMsg] = useState("");
  const set = (k: keyof Datos, v: string) => setD({ ...d, [k]: v });
  const wa = d.whatsapp.replace(/\D/g, "");

  async function guardar() {
    setMsg("");
    try {
      const datos = { ...d, whatsapp: wa.startsWith("57") ? wa : "57" + wa, horarios: d.horarios.filter((h) => h.dias.trim() && h.horas.trim()) };
      await apiTaller.guardarConfigPublica(datos);
      aplicarConfig(datos);
      setMsg("✓ Guardado. El portal ya muestra los datos nuevos.");
    } catch (e) { setMsg("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo guardar.")); }
  }

  return (
    <Tarjeta>
      <h2 className="mb-1 text-lg font-bold">Datos del taller</h2>
      <p className="mb-3 text-sm text-suave">Es lo que ven los clientes en el portal (inicio, botón de WhatsApp, cómo llegar) y lo que aparece en el aviso de privacidad y en el acta.</p>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo id="t-nombre" etiqueta="Nombre del taller"><input id="t-nombre" className="campo" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} /></Campo>
        <Campo id="t-wa" etiqueta="WhatsApp del taller" ayuda="Con indicativo 57, solo números." aviso={avisoCelular(wa.replace(/^57/, ""))}>
          <input id="t-wa" className="campo" inputMode="tel" value={d.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </Campo>
        <Campo id="t-tel" etiqueta="Teléfono para llamar"><input id="t-tel" className="campo" inputMode="tel" value={d.telefono} onChange={(e) => set("telefono", e.target.value)} /></Campo>
        <Campo id="t-correo" etiqueta="Correo" aviso={avisoCorreo(d.correo)}><input id="t-correo" type="email" className="campo" value={d.correo} onChange={(e) => set("correo", e.target.value)} /></Campo>
        <Campo id="t-dir" etiqueta="Dirección"><input id="t-dir" className="campo" value={d.direccion} onChange={(e) => set("direccion", e.target.value)} /></Campo>
        <Campo id="t-mapa" etiqueta="Enlace de Google Maps" opcional ayuda="En Google Maps: Compartir → Copiar vínculo."><input id="t-mapa" className="campo" inputMode="url" value={d.mapa} onChange={(e) => set("mapa", e.target.value)} /></Campo>
      </div>
      <p className="mb-1 font-bold">Horarios de atención</p>
      {d.horarios.map((h, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
          <input aria-label="Días" className="campo" value={h.dias} placeholder="Lunes a viernes" onChange={(e) => setD({ ...d, horarios: d.horarios.map((x, j) => (j === i ? { ...x, dias: e.target.value } : x)) })} />
          <input aria-label="Horas" className="campo" value={h.horas} placeholder="7:30 a. m. – 5:30 p. m." onChange={(e) => setD({ ...d, horarios: d.horarios.map((x, j) => (j === i ? { ...x, horas: e.target.value } : x)) })} />
          <button type="button" aria-label="Quitar horario" className="rounded-lg border border-borde px-3 font-bold text-marca" onClick={() => setD({ ...d, horarios: d.horarios.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button type="button" className="mb-4 font-bold text-marca underline" onClick={() => setD({ ...d, horarios: [...d.horarios, { dias: "", horas: "" }] })}>+ Agregar horario</button>

      <h3 className="mb-1 mt-2 font-bold">Para el aviso de privacidad (Ley 1581)</h3>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo id="t-resp" etiqueta="Responsable (nombre o razón social)"><input id="t-resp" className="campo" value={d.responsableDatos} onChange={(e) => set("responsableDatos", e.target.value)} /></Campo>
        <Campo id="t-nit" etiqueta="NIT" opcional><input id="t-nit" className="campo" value={d.nit} onChange={(e) => set("nit", e.target.value)} /></Campo>
        <Campo id="t-cons" etiqueta="Plazo de conservación de los datos" opcional ayuda="Ej.: 10 años después del último servicio, por deberes contables."><input id="t-cons" className="campo" value={d.conservacion} onChange={(e) => set("conservacion", e.target.value)} /></Campo>
        <Campo id="t-reg" etiqueta="Región del servidor" opcional ayuda="La que elegiste al crear el proyecto en Supabase."><input id="t-reg" className="campo" value={d.regionDatos} onChange={(e) => set("regionDatos", e.target.value)} placeholder="São Paulo (Brasil)" /></Campo>
      </div>
      <p className="mb-3 text-sm">Revisa cómo queda: <Link to="/privacidad" target="_blank" className="font-bold text-marca underline">ver aviso de privacidad</Link>. El texto es un borrador para revisar con un abogado.</p>
      {msg && <p role="status" className={`mb-2 rounded-lg px-3 py-2 ${msg.startsWith("✓") ? "bg-ok-fondo text-ok" : "bg-aviso-fondo text-aviso"}`}>{msg}</p>}
      <Boton onClick={guardar}>Guardar datos del taller</Boton>
    </Tarjeta>
  );
}
