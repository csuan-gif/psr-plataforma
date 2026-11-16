import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../compartido/datos/api";
import { ErrorApi } from "../compartido/datos/tipos";
import { Boton, Campo, Marco, Tarjeta } from "../compartido/ui/base";
import { borradorVacio, guardarBorrador } from "./borrador";

/**
 * Precarga SOLO los datos del vehículo con placa + 4 dígitos del documento +
 * 4 dígitos del celular. Nunca devuelve datos personales.
 */
export default function YaSoyCliente() {
  const nav = useNavigate();
  const [placa, setPlaca] = useState("");
  const [doc4, setDoc4] = useState("");
  const [cel4, setCel4] = useState("");
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(false);

  async function buscar() {
    if (!placa || doc4.length !== 4 || cel4.length !== 4) { setMsg("Completa la placa y los 4 dígitos de cada campo."); return; }
    setCargando(true); setMsg("");
    try {
      const v = await api.precargarVehiculo(placa, doc4, cel4);
      if (!v) { setMsg("No encontramos esos datos. Revisa o haz la solicitud como cliente nuevo."); return; }
      const b = borradorVacio();
      b.esClienteExistente = true;
      b.vehiculo = { ...b.vehiculo, placa: v.placa, marca: v.marca, linea: v.linea, anio: v.anio ? String(v.anio) : "", color: v.color, combustible: v.combustible, km: v.km ? String(v.km) : "" };
      guardarBorrador(b); // el asistente lo retoma desde el almacenamiento local
      nav("/solicitar");
    } catch (e) {
      setMsg(e instanceof ErrorApi ? e.message : "No pudimos buscar. Intenta de nuevo.");
    } finally { setCargando(false); }
  }

  return (
    <Marco titulo="Ya soy cliente">
      <h1 className="mb-1 text-2xl font-bold">Ya soy cliente</h1>
      <p className="mb-4 text-suave">Te ahorramos escribir los datos de tu vehículo. Por seguridad, no mostramos tus datos personales.</p>
      <Tarjeta>
        <Campo id="placa" etiqueta="Placa">
          <input id="placa" className="campo max-w-48 text-center text-xl font-bold uppercase tracking-[0.2em]" maxLength={7} value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="doc4" etiqueta="Últimos 4 del documento">
            <input id="doc4" className="campo text-center tracking-[0.3em]" inputMode="numeric" maxLength={4} value={doc4} onChange={(e) => setDoc4(e.target.value.replace(/\D/g, ""))} />
          </Campo>
          <Campo id="cel4" etiqueta="Últimos 4 del celular">
            <input id="cel4" className="campo text-center tracking-[0.3em]" inputMode="numeric" maxLength={4} value={cel4} onChange={(e) => setCel4(e.target.value.replace(/\D/g, ""))} />
          </Campo>
        </div>
        {msg && <p role="alert" className="mb-3 text-aviso">⚠ {msg}</p>}
        <Boton onClick={buscar} disabled={cargando} className="w-full">{cargando ? "Buscando…" : "Continuar"}</Boton>
      </Tarjeta>
    </Marco>
  );
}
