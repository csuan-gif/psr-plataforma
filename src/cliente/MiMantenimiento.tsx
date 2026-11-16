import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../compartido/datos/api";
import { ErrorApi, type MiMantenimiento as Datos } from "../compartido/datos/tipos";
import { Aviso, Boton, Campo, Marco, Tarjeta } from "../compartido/ui/base";
import { fechaLarga, hoyBogota } from "../compartido/util/fechas";
import { cuandoTexto } from "../compartido/util/mantenimiento";
import { borradorVacio, guardarBorrador } from "./borrador";

/** Vista del cliente: próximos mantenimientos, SOAT y técnico-mecánica, y agendar con un toque. */
export default function MiMantenimiento() {
  const nav = useNavigate();
  const [placa, setPlaca] = useState("");
  const [doc4, setDoc4] = useState("");
  const [cel4, setCel4] = useState("");
  const [d, setD] = useState<Datos | null>(null);
  const [soat, setSoat] = useState("");
  const [rtm, setRtm] = useState("");
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(false);
  const hoy = hoyBogota();

  async function consultar() {
    if (!placa || doc4.length !== 4 || cel4.length !== 4) { setMsg("Completa la placa y los 4 dígitos de cada campo."); return; }
    setCargando(true); setMsg("");
    try {
      const r = await api.miMantenimiento(placa, doc4, cel4);
      if (!r) setMsg("No encontramos esos datos. Revisa la placa y los dígitos.");
      else { setD(r); setSoat(r.fechaSoat ?? ""); setRtm(r.fechaTecnomecanica ?? ""); }
    } catch (e) { setMsg(e instanceof ErrorApi ? e.message : "No pudimos consultar. Intenta de nuevo."); }
    finally { setCargando(false); }
  }

  async function guardarFechas() {
    setCargando(true); setMsg("");
    try {
      const ok = await api.registrarVencimientos(placa, doc4, cel4, soat || null, rtm || null);
      setMsg(ok ? "✓ Guardamos tus fechas. Te avisaremos antes del vencimiento." : "No se pudieron guardar las fechas.");
      if (ok) setD(await api.miMantenimiento(placa, doc4, cel4));
    } catch (e) { setMsg(e instanceof ErrorApi ? e.message : "Revisa las fechas."); }
    finally { setCargando(false); }
  }

  function agendar(servicio?: string) {
    if (!d) return;
    const b = borradorVacio();
    b.esClienteExistente = true;
    b.vehiculo = { ...b.vehiculo, placa: d.placa, marca: d.marca, linea: d.linea, anio: d.anio ? String(d.anio) : "", color: d.color, combustible: d.combustible, km: d.km ? String(d.km) : "" };
    b.zonas = ["general"]; b.sintomas = ["general.mantenimiento"];
    b.descripcion = servicio ? `Mantenimiento: ${servicio}` : "Mantenimiento preventivo";
    guardarBorrador(b);
    nav("/solicitar");
  }

  return (
    <Marco titulo="Mi mantenimiento">
      <h1 className="mb-1 text-2xl font-bold">Mi mantenimiento</h1>
      <p className="mb-4 text-suave">Mira qué le toca a tu carro y cuándo vencen el SOAT y la técnico-mecánica.</p>
      {!d ? (
        <Tarjeta>
          <Campo id="mm-placa" etiqueta="Placa">
            <input id="mm-placa" className="campo max-w-48 text-center text-xl font-bold uppercase tracking-[0.2em]" maxLength={7} value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="mm-doc4" etiqueta="Últimos 4 del documento"><input id="mm-doc4" className="campo text-center tracking-[0.3em]" inputMode="numeric" maxLength={4} value={doc4} onChange={(e) => setDoc4(e.target.value.replace(/\D/g, ""))} /></Campo>
            <Campo id="mm-cel4" etiqueta="Últimos 4 del celular"><input id="mm-cel4" className="campo text-center tracking-[0.3em]" inputMode="numeric" maxLength={4} value={cel4} onChange={(e) => setCel4(e.target.value.replace(/\D/g, ""))} /></Campo>
          </div>
          {msg && <p role="alert" className="mb-3 text-aviso">⚠ {msg}</p>}
          <Boton onClick={consultar} disabled={cargando} className="w-full">{cargando ? "Consultando…" : "Consultar"}</Boton>
        </Tarjeta>
      ) : (
        <div className="entrar grid gap-4">
          <Tarjeta>
            <p className="text-xl font-bold">{d.placa} · {[d.marca, d.linea, d.anio].filter(Boolean).join(" ")}</p>
            {d.km != null && <p className="text-suave">Último kilometraje registrado: {d.km.toLocaleString("es-CO")} km{d.kmFecha && ` (${fechaLarga(d.kmFecha)})`}</p>}
          </Tarjeta>
          {msg && <Aviso tono={msg.startsWith("✓") ? "ok" : "aviso"}>{msg}</Aviso>}

          <Tarjeta>
            <h2 className="mb-2 text-lg font-bold">Próximos mantenimientos sugeridos</h2>
            {d.proximos.filter((p) => p.tipo === "mantenimiento").length === 0 ? <p className="text-suave">Aún no tenemos mantenimientos programados para tu vehículo.</p> : (
              <ul className="grid gap-2">
                {d.proximos.filter((p) => p.tipo === "mantenimiento").map((p, i) => (
                  <li key={i} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 ${p.fecha && p.fecha <= hoy ? "bg-aviso-fondo" : "bg-fondo"}`}>
                    <span><strong>{p.servicio}</strong><br /><span className="text-sm">{p.fecha ? `${fechaLarga(p.fecha)} (${cuandoTexto(p.fecha, hoy)})` : ""}{p.km && ` · o a los ${p.km.toLocaleString("es-CO")} km`}</span></span>
                    <Boton variante="secundario" onClick={() => agendar(p.servicio)}>Agendar</Boton>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-suave">Son sugerencias según el plan del taller y tu kilometraje; no son un diagnóstico. Lo que llegue primero: la fecha o el kilometraje.</p>
            <Boton className="mt-3 w-full" onClick={() => agendar()}>🔧 Agendar mantenimiento</Boton>
          </Tarjeta>

          <Tarjeta>
            <h2 className="mb-1 text-lg font-bold">SOAT y revisión técnico-mecánica</h2>
            <p className="mb-3 text-sm text-suave">Si nos dices cuándo vencen, te avisamos un mes antes. Están en tus documentos o en el RUNT.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="mm-soat" etiqueta="Vence el SOAT" opcional><input id="mm-soat" type="date" className="campo" value={soat} onChange={(e) => setSoat(e.target.value)} /></Campo>
              <Campo id="mm-rtm" etiqueta="Vence la técnico-mecánica" opcional><input id="mm-rtm" type="date" className="campo" value={rtm} onChange={(e) => setRtm(e.target.value)} /></Campo>
            </div>
            {(soat !== (d.fechaSoat ?? "") || rtm !== (d.fechaTecnomecanica ?? "")) && <Boton onClick={guardarFechas} disabled={cargando}>Guardar fechas</Boton>}
            <p className="mt-2 text-xs text-suave">Carros particulares nuevos: la primera técnico-mecánica es al 5.º año de matrícula y después cada año.</p>
          </Tarjeta>

          {d.ultimoServicio && (
            <Tarjeta>
              <h2 className="mb-1 text-lg font-bold">Último servicio en el taller</h2>
              <p className="text-sm">{fechaLarga(d.ultimoServicio.fecha.slice(0, 10))}{d.ultimoServicio.km != null && ` · ${d.ultimoServicio.km.toLocaleString("es-CO")} km`}</p>
              <ul className="list-disc pl-5 text-sm">{d.ultimoServicio.trabajos.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </Tarjeta>
          )}
          <Boton variante="fantasma" onClick={() => { setD(null); setMsg(""); }}>Consultar otro vehículo</Boton>
        </div>
      )}
    </Marco>
  );
}
