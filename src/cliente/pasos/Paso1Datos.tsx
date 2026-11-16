import type { Borrador } from "../borrador";
import { Campo } from "../../compartido/ui/base";
import { TIPOS_DOCUMENTO } from "../../compartido/catalogo/vehiculos";
import { avisoCelular, avisoCorreo, avisoDocumento } from "../../compartido/util/validaciones";

export interface PropsPaso { b: Borrador; set: (f: (b: Borrador) => Borrador) => void }

export default function Paso1Datos({ b, set }: PropsPaso) {
  const c = b.cliente;
  const cambiar = (k: keyof Borrador["cliente"], v: string) => set((x) => ({ ...x, cliente: { ...x.cliente, [k]: v } }));
  const existente = b.esClienteExistente;

  return (
    <>
      <h2 className="mb-1 text-2xl font-bold">Tus datos</h2>
      <p className="mb-5 text-suave">
        {existente
          ? "Ya tenemos tu vehículo. Confirma tu documento y celular; si algún dato tuyo cambió, escríbelo abajo."
          : "Los usamos para crear tu orden y confirmarte la cita. No tendrás que volver a escribirlos."}
      </p>

      <div className="grid gap-x-3 sm:grid-cols-[1fr_1.4fr]">
        <Campo id="tdoc" etiqueta="Tipo de documento">
          <select id="tdoc" className="campo" value={c.tipoDocumento} onChange={(e) => cambiar("tipoDocumento", e.target.value)}>
            {TIPOS_DOCUMENTO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </Campo>
        <Campo id="ndoc" etiqueta="Número de documento" aviso={avisoDocumento(c.tipoDocumento, c.numeroDocumento, c.digitoVerificacion)}>
          <div className="flex gap-2">
            <input id="ndoc" className="campo" inputMode={c.tipoDocumento === "PAS" ? "text" : "numeric"} autoComplete="off"
              value={c.numeroDocumento} onChange={(e) => cambiar("numeroDocumento", e.target.value)} placeholder="Sin puntos" />
            {c.tipoDocumento === "NIT" && (
              <input aria-label="Dígito de verificación (opcional)" title="Dígito de verificación" className="campo !w-16 text-center"
                inputMode="numeric" maxLength={1} value={c.digitoVerificacion} placeholder="DV"
                onChange={(e) => cambiar("digitoVerificacion", e.target.value.replace(/\D/g, ""))} />
            )}
          </div>
        </Campo>
      </div>

      <Campo id="nombre" etiqueta={c.tipoDocumento === "NIT" ? "Razón social" : "Nombre completo"} opcional={existente}>
        <input id="nombre" className="campo" autoComplete={c.tipoDocumento === "NIT" ? "organization" : "name"} value={c.nombre} onChange={(e) => cambiar("nombre", e.target.value)} />
      </Campo>
      <Campo id="cel" etiqueta="Celular (WhatsApp)" aviso={avisoCelular(c.celular)}>
        <input id="cel" className="campo" type="tel" inputMode="tel" autoComplete="tel-national" value={c.celular} onChange={(e) => cambiar("celular", e.target.value)} placeholder="300 123 4567" />
      </Campo>
      <Campo id="correo" etiqueta="Correo" opcional aviso={avisoCorreo(c.correo)} ayuda="Para enviarte el acta de recepción. Si no lo tienes a mano, el taller lo pide al recibir el carro.">
        <input id="correo" className="campo" type="email" inputMode="email" autoComplete="email" value={c.correo} onChange={(e) => cambiar("correo", e.target.value)} />
      </Campo>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo id="dir" etiqueta="Dirección" opcional>
          <input id="dir" className="campo" autoComplete="street-address" value={c.direccion} onChange={(e) => cambiar("direccion", e.target.value)} />
        </Campo>
        <Campo id="barrio" etiqueta="Barrio o municipio" opcional>
          <input id="barrio" className="campo" autoComplete="address-level2" value={c.barrioMunicipio} onChange={(e) => cambiar("barrioMunicipio", e.target.value)} />
        </Campo>
      </div>

      {/* Honeypot anti-robots: invisible para personas y lectores de pantalla. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Sitio web</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={b.website} onChange={(e) => set((x) => ({ ...x, website: e.target.value }))} />
      </div>
    </>
  );
}
