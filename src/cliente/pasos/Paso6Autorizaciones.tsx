import { Link } from "react-router-dom";
import type { PropsPaso } from "./Paso1Datos";
import { Grupo } from "../../compartido/ui/base";
import { TALLER } from "../../compartido/config";

function Radio({ activo, onClick, titulo, texto }: { activo: boolean; onClick: () => void; titulo: string; texto: string }) {
  return (
    <button type="button" role="radio" aria-checked={activo} onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition ${activo ? "border-marca bg-marca-suave" : "border-borde bg-superficie hover:border-marca"}`}>
      <span aria-hidden className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${activo ? "border-marca" : "border-suave"}`}>
        {activo && <span className="h-2.5 w-2.5 rounded-full bg-marca" />}
      </span>
      <span><span className="block font-bold">{titulo}</span><span className="text-sm text-suave">{texto}</span></span>
    </button>
  );
}

function Casilla({ marcado, onChange, children, id }: { marcado: boolean; onChange: (v: boolean) => void; children: React.ReactNode; id: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border-2 p-4 ${marcado ? "border-marca bg-marca-suave" : "border-borde bg-superficie"}`}>
      <input id={id} type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-[var(--marca)]" />
      <label htmlFor={id} className="cursor-pointer">{children}</label>
    </div>
  );
}

export default function Paso6Autorizaciones({ b, set }: PropsPaso) {
  return (
    <>
      <h2 className="mb-1 text-2xl font-bold">Autorizaciones</h2>
      <p className="mb-5 text-suave">Quedan registradas en tu orden y las confirmas de nuevo al entregar el vehículo.</p>

      <Grupo titulo="Sobre el presupuesto">
        <div role="radiogroup" aria-label="Sobre el presupuesto" className="grid gap-2">
          <Radio activo={b.presupuesto === "previo"} onClick={() => set((x) => ({ ...x, presupuesto: "previo" }))}
            titulo="Solicito presupuesto previo" texto="El taller no hace la reparación hasta que yo apruebe el presupuesto." />
          <Radio activo={b.presupuesto === "sin_presupuesto"} onClick={() => set((x) => ({ ...x, presupuesto: "sin_presupuesto" }))}
            titulo="Autorizo la reparación sin presupuesto previo" texto="El taller puede avanzar con lo que encuentre necesario." />
        </div>
      </Grupo>

      <div className="mb-3">
        <Casilla id="ruta" marcado={b.pruebaRuta} onChange={(v) => set((x) => ({ ...x, pruebaRuta: v }))}>
          Autorizo al taller a <strong>conducir mi vehículo</strong> para efectos de prueba. <span className="text-suave">(opcional)</span>
        </Casilla>
      </div>
      <Casilla id="datos" marcado={b.datos} onChange={(v) => set((x) => ({ ...x, datos: v }))}>
        Autorizo a {TALLER.nombre} a tratar mis datos personales para atender mi solicitud, gestionar la orden de trabajo, el historial del vehículo
        y enviarme recordatorios de mantenimiento, según el{" "}
        <Link to="/privacidad" target="_blank" className="font-bold text-marca underline">aviso de privacidad</Link> (Ley 1581 de 2012). <strong>(obligatoria)</strong>
      </Casilla>
    </>
  );
}
