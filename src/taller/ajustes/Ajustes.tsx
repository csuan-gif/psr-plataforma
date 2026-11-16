import { useSearchParams } from "react-router-dom";
import { usePanel } from "../contexto";
import Configuracion from "../Configuracion";
import DatosTaller from "./DatosTaller";
import Usuarios from "./Usuarios";
import ReglasSemaforo from "./ReglasSemaforo";
import Sintomas from "./Sintomas";
import CartelQR from "./CartelQR";

const PESTANAS = [
  { id: "agenda", t: "Agenda y mensajes", admin: false },
  { id: "taller", t: "Datos del taller", admin: true },
  { id: "usuarios", t: "Usuarios", admin: true },
  { id: "semaforo", t: "Semáforo", admin: true },
  { id: "sintomas", t: "Síntomas", admin: true },
  { id: "qr", t: "Cartel QR", admin: false },
] as const;

export default function Ajustes() {
  const { usuario } = usePanel();
  const [p, setP] = useSearchParams();
  const visibles = PESTANAS.filter((x) => !x.admin || usuario.rol === "admin");
  const actual = visibles.find((x) => x.id === p.get("seccion"))?.id ?? "agenda";
  return (
    <>
      <div role="tablist" aria-label="Secciones de ajustes" className="mb-4 flex gap-1 overflow-x-auto pb-1 print:hidden">
        {visibles.map((x) => (
          <button key={x.id} role="tab" type="button" aria-selected={actual === x.id} onClick={() => setP({ seccion: x.id }, { replace: true })}
            className={`min-h-10 shrink-0 rounded-lg px-3 font-bold ${actual === x.id ? "bg-marca text-sobre-marca" : "border border-borde bg-superficie"}`}>{x.t}</button>
        ))}
      </div>
      {actual === "agenda" && <Configuracion />}
      {actual === "taller" && <DatosTaller />}
      {actual === "usuarios" && <Usuarios />}
      {actual === "semaforo" && <ReglasSemaforo />}
      {actual === "sintomas" && <Sintomas />}
      {actual === "qr" && <CartelQR />}
    </>
  );
}
