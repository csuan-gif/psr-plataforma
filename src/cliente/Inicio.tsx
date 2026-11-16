import { Link } from "react-router-dom";
import { Marco, Tarjeta } from "../compartido/ui/base";
import { ES_DEMO, TALLER } from "../compartido/config";
import { enlaceWhatsApp } from "../compartido/util/mensajes";

function BotonGrande({ to, icono, titulo, texto, primario }: { to: string; icono: string; titulo: string; texto: string; primario?: boolean }) {
  return (
    <Link to={to} className={`flex min-h-20 items-center gap-4 rounded-2xl border-2 p-4 no-underline transition hover:-translate-y-0.5 ${primario ? "border-marca bg-marca text-sobre-marca" : "border-borde bg-superficie text-texto hover:border-marca"}`}>
      <span aria-hidden className="text-3xl">{icono}</span>
      <span><span className="block text-lg font-bold">{titulo}</span><span className={primario ? "opacity-90" : "text-suave"}>{texto}</span></span>
    </Link>
  );
}

export default function Inicio() {
  return (
    <Marco>
      {ES_DEMO && (
        <p className="mb-3 rounded-xl bg-aviso-fondo px-4 py-2 text-sm text-aviso">
          <strong>Modo demostración:</strong> los datos son ficticios y se guardan solo en este navegador.
        </p>
      )}
      <section className="mb-5 pt-2">
        <h1 className="text-3xl font-bold leading-tight">Hola 👋 ¿Qué necesita tu vehículo?</h1>
        <p className="mt-2 text-suave">Cuéntanos qué le pasa, aparta tu cita y sigue el estado de tu carro desde el celular.</p>
      </section>

      <nav aria-label="Opciones principales" className="mb-6 grid gap-3">
        <BotonGrande primario to="/solicitar" icono="🔧" titulo="Solicitar revisión o cita" texto="Describe la falla y elige día" />
        <BotonGrande to="/consultar" icono="🔎" titulo="Consultar mi vehículo" texto="Con tu código de seguimiento" />
        <BotonGrande to="/ya-soy-cliente" icono="⭐" titulo="Ya soy cliente" texto="Tus datos del vehículo ya están guardados" />
      </nav>

      <Tarjeta className="mb-4">
        <h2 className="mb-2 text-lg font-bold">Contacto</h2>
        <p className="mb-1">📍 {TALLER.direccion}</p>
        <ul className="mb-3 text-suave">
          {TALLER.horarios.map((h) => <li key={h.dias}>🕑 {h.dias}: {h.horas}</li>)}
        </ul>
        <div className="flex flex-wrap gap-2">
          <a href={enlaceWhatsApp(TALLER.whatsapp, "Hola, quiero información sobre un servicio.")} target="_blank" rel="noreferrer"
            className="inline-flex min-h-12 items-center rounded-xl bg-marca px-4 font-bold text-sobre-marca no-underline">💬 WhatsApp</a>
          <a href={`tel:${TALLER.telefono.replace(/\s/g, "")}`} className="inline-flex min-h-12 items-center rounded-xl border-2 border-borde px-4 font-bold text-texto no-underline">📞 Llamar</a>
          <a href={TALLER.mapa} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded-xl border-2 border-borde px-4 font-bold text-texto no-underline">🗺 Cómo llegar</a>
        </div>
      </Tarjeta>

      <p className="text-sm text-suave">
        Mecánica preventiva y correctiva, electricidad, electrónica, mecatrónica, latonería y pintura para vehículos livianos.
      </p>
      <p className="mt-3 text-sm"><Link to="/privacidad" className="text-marca underline">Aviso de privacidad</Link> · <Link to="/mantenimiento" className="text-marca underline">Mi mantenimiento</Link> · <Link to="/taller" className="text-suave underline">Acceso taller</Link></p>
    </Marco>
  );
}
