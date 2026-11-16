import { useState } from "react";
import { Link } from "react-router-dom";
import type { ResultadoSolicitud } from "../compartido/datos/tipos";
import type { Borrador } from "./borrador";
import { Aviso, Marco, Tarjeta } from "../compartido/ui/base";
import { TALLER } from "../compartido/config";
import { AVISO_SEGURIDAD, MENSAJE_NEUTRO, enlaceWhatsApp, generarIcs, requiereAvisoSeguridad, textoCita } from "../compartido/util/mensajes";

export default function Confirmacion({ resultado, b }: { resultado: ResultadoSolicitud; b: Borrador }) {
  const [copiado, setCopiado] = useState(false);
  const { codigo, cita } = resultado;
  const vehiculo = [b.vehiculo.marca === "Otra" ? b.vehiculo.marcaOtra : b.vehiculo.marca, b.vehiculo.linea === "Otra" ? b.vehiculo.lineaOtra : b.vehiculo.linea].filter(Boolean).join(" ");
  // Resumen para el WhatsApp del taller: SIN semáforo ni prioridad.
  const resumen = [
    `Hola, acabo de enviar una solicitud en el portal de ${TALLER.nombre}.`,
    `Código: ${codigo}`,
    `Nombre: ${b.cliente.nombre || "(cliente registrado)"}`,
    `Placa: ${b.vehiculo.placa} ${vehiculo && "· " + vehiculo}`,
    `Cita: ${cita ? textoCita(cita.fecha, cita.franja) + " (pendiente de confirmación)" : "solo cotización o información"}`,
  ].join("\n");

  function descargarIcs() {
    if (!cita) return;
    const url = URL.createObjectURL(new Blob([generarIcs(codigo, cita.fecha, cita.franja)], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `cita-${codigo}.ics` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <Marco>
      <div className="entrar">
        <div className="mb-4 text-center">
          <div aria-hidden className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-ok-fondo text-3xl text-ok">✓</div>
          <h1 className="text-2xl font-bold">{MENSAJE_NEUTRO}</h1>
        </div>

        <Tarjeta className="mb-4 text-center">
          <p className="text-suave">Tu código de seguimiento</p>
          <p className="my-1 font-mono text-3xl font-bold tracking-widest" aria-label={`Código ${codigo.split("").join(" ")}`}>{codigo}</p>
          <button type="button" className="text-sm font-bold text-marca underline"
            onClick={async () => { try { await navigator.clipboard.writeText(codigo); setCopiado(true); } catch { /* sin portapapeles */ } }}>
            {copiado ? "Copiado ✓" : "Copiar código"}
          </button>
          <p className="mt-2 text-sm text-suave">Guárdalo: con él y los últimos 4 dígitos de tu documento puedes consultar tu vehículo.</p>
        </Tarjeta>

        <Tarjeta className="mb-4">
          <p className="font-bold">{cita ? "Cita solicitada (pendiente de confirmación)" : "Sin cita"}</p>
          <p className="first-letter:uppercase">{textoCita(cita?.fecha, cita?.franja)}</p>
          {cita && <p className="mt-1 text-sm text-suave">El taller revisará su disponibilidad y te confirmará por WhatsApp.</p>}
        </Tarjeta>

        {requiereAvisoSeguridad({ movilidad: b.movilidad, zonas: b.zonas, sintomas: b.sintomas }) && (
          <div className="mb-4"><Aviso tono="marca"><strong>{AVISO_SEGURIDAD}</strong></Aviso></div>
        )}

        <div className="grid gap-2">
          <a href={enlaceWhatsApp(TALLER.whatsapp, resumen)} target="_blank" rel="noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-marca px-5 font-bold text-sobre-marca no-underline">
            💬 Enviar resumen al WhatsApp del taller
          </a>
          {cita && (
            <button type="button" onClick={descargarIcs} className="min-h-12 rounded-xl border-2 border-borde bg-superficie px-5 font-bold">
              📅 Añadir al calendario
            </button>
          )}
          <Link to="/consultar" state={{ codigo }} className="flex min-h-12 items-center justify-center rounded-xl border-2 border-borde bg-superficie px-5 font-bold text-texto no-underline">
            Consultar mi vehículo
          </Link>
          <Link to="/" className="py-2 text-center font-bold text-marca">Volver al inicio</Link>
        </div>
      </div>
    </Marco>
  );
}
