import { useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type AltaRapida as Datos } from "../datos/tipos";
import { Boton, Campo, Tarjeta } from "../../compartido/ui/base";
import { TIPOS_DOCUMENTO, LISTA_MARCAS } from "../../compartido/catalogo/vehiculos";
import { avisoCelular, avisoDocumento, avisoPlaca } from "../../compartido/util/validaciones";

/** Cliente que llega sin solicitud: se registra en 1 minuto y se abre el acta. */
export default function AltaRapida({ placa, onListo }: { placa: string; onListo: (solicitudId: string) => void }) {
  const [d, setD] = useState<Datos>({ tipoDocumento: "CC", numeroDocumento: "", nombre: "", celular: "", correo: "", placa, marca: "", linea: "", anio: "", motivo: "", autorizaDatos: false });
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof Datos, v: string | boolean) => setD({ ...d, [k]: v });
  const listo = d.numeroDocumento.trim() && d.nombre.trim().length >= 2 && d.celular.replace(/\D/g, "").length >= 7 && d.placa.trim() && d.marca.trim() && d.autorizaDatos;

  async function guardar() {
    setOcupado(true); setMsg("");
    try { onListo(await apiTaller.altaRapida(d)); }
    catch (e) { setMsg(e instanceof ErrorTaller ? e.message : "No se pudo registrar."); }
    finally { setOcupado(false); }
  }

  return (
    <Tarjeta className="max-w-2xl">
      <h2 className="mb-1 text-xl font-bold">Cliente nuevo (llegó sin solicitud)</h2>
      <p className="mb-3 text-sm text-suave">Solo lo indispensable; el resto se completa en el acta.</p>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo id="ar-tipo" etiqueta="Tipo de documento">
          <select id="ar-tipo" className="campo" value={d.tipoDocumento} onChange={(e) => set("tipoDocumento", e.target.value)}>{TIPOS_DOCUMENTO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
        </Campo>
        <Campo id="ar-doc" etiqueta="Número" aviso={avisoDocumento(d.tipoDocumento, d.numeroDocumento)}><input id="ar-doc" className="campo" inputMode="numeric" value={d.numeroDocumento} onChange={(e) => set("numeroDocumento", e.target.value)} /></Campo>
        <Campo id="ar-nombre" etiqueta="Nombre o razón social"><input id="ar-nombre" className="campo" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} /></Campo>
        <Campo id="ar-cel" etiqueta="Celular (WhatsApp)" aviso={avisoCelular(d.celular)}><input id="ar-cel" className="campo" inputMode="tel" value={d.celular} onChange={(e) => set("celular", e.target.value)} /></Campo>
        <Campo id="ar-placa" etiqueta="Placa" aviso={avisoPlaca(d.placa)}><input id="ar-placa" className="campo uppercase" maxLength={7} value={d.placa} onChange={(e) => set("placa", e.target.value.toUpperCase())} /></Campo>
        <Campo id="ar-marca" etiqueta="Marca">
          <input id="ar-marca" className="campo" list="ar-marcas" value={d.marca} onChange={(e) => set("marca", e.target.value)} />
          <datalist id="ar-marcas">{LISTA_MARCAS.map((m) => <option key={m} value={m} />)}</datalist>
        </Campo>
        <Campo id="ar-linea" etiqueta="Línea" opcional><input id="ar-linea" className="campo" value={d.linea} onChange={(e) => set("linea", e.target.value)} /></Campo>
        <Campo id="ar-anio" etiqueta="Año" opcional><input id="ar-anio" className="campo" inputMode="numeric" maxLength={4} value={d.anio} onChange={(e) => set("anio", e.target.value.replace(/\D/g, ""))} /></Campo>
      </div>
      <Campo id="ar-motivo" etiqueta="¿A qué viene?" opcional><input id="ar-motivo" className="campo" value={d.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder="Ej.: ruido en la suspensión delantera" /></Campo>
      <label className="mb-3 flex items-start gap-3 rounded-xl border-2 border-borde p-3">
        <input type="checkbox" className="mt-1 h-6 w-6" checked={d.autorizaDatos} onChange={(e) => set("autorizaDatos", e.target.checked)} />
        <span>El cliente <strong>autoriza</strong> el tratamiento de sus datos según el <a href="/privacidad" target="_blank" className="font-bold text-marca underline">aviso de privacidad</a> (Ley 1581). Se lo leí o se lo mostré. <strong>(obligatoria)</strong></span>
      </label>
      {msg && <p role="alert" className="mb-2 font-bold text-marca">{msg}</p>}
      <Boton disabled={!listo || ocupado} onClick={guardar}>{ocupado ? "Registrando…" : "Registrar y abrir el acta"}</Boton>
    </Tarjeta>
  );
}
