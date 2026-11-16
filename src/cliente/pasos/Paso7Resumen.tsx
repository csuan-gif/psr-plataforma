import type { ReactNode } from "react";
import type { Borrador } from "../borrador";
import type { SintomaCat, ZonaCat } from "../../compartido/datos/tipos";
import { COMBUSTIBLES, TIPOS_DOCUMENTO } from "../../compartido/catalogo/vehiculos";
import { textoCita } from "../../compartido/util/mensajes";

const MOV: Record<string, string> = { si: "Sí", no: "No", nose: "No está seguro" };

function Bloque({ titulo, paso, ir, children }: { titulo: string; paso: number; ir: (n: number) => void; children: ReactNode }) {
  return (
    <section className="mb-3 rounded-2xl border border-borde bg-superficie p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-bold">{titulo}</h3>
        <button type="button" onClick={() => ir(paso)} className="min-h-10 rounded-lg px-3 font-bold text-marca underline">Editar</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">{children}</dl>
    </section>
  );
}
const F = ({ k, v }: { k: string; v?: ReactNode }) => (v ? <><dt className="text-suave">{k}</dt><dd className="break-words">{v}</dd></> : null);

export default function Paso7Resumen({ b, ir, zonas, sintomas }: { b: Borrador; ir: (n: number) => void; zonas: ZonaCat[]; sintomas: SintomaCat[] }) {
  const c = b.cliente, v = b.vehiculo;
  const nz = (id: string) => zonas.find((z) => z.id === id)?.nombre ?? id;
  const ns = (id: string) => sintomas.find((s) => s.id === id)?.etiqueta ?? id;
  return (
    <>
      <h2 className="mb-1 text-2xl font-bold">Revisa antes de enviar</h2>
      <p className="mb-4 text-suave">Si algo está mal, toca «Editar». Nada se envía hasta que confirmes.</p>
      <Bloque titulo="Tus datos" paso={1} ir={ir}>
        <F k="Documento" v={`${TIPOS_DOCUMENTO.find((t) => t.id === c.tipoDocumento)?.nombre} ${c.numeroDocumento}${c.digitoVerificacion ? "-" + c.digitoVerificacion : ""}`} />
        <F k="Nombre" v={c.nombre} /><F k="Celular" v={c.celular} /><F k="Correo" v={c.correo} />
        <F k="Dirección" v={[c.direccion, c.barrioMunicipio].filter(Boolean).join(", ")} />
      </Bloque>
      <Bloque titulo="Tu vehículo" paso={2} ir={ir}>
        <F k="Placa" v={v.placa} />
        <F k="Vehículo" v={[v.marca === "Otra" ? v.marcaOtra : v.marca, v.linea === "Otra" ? v.lineaOtra : v.linea, v.anio].filter(Boolean).join(" ")} />
        <F k="Color" v={v.color} /><F k="Combustible" v={COMBUSTIBLES.find((x) => x.id === v.combustible)?.nombre} />
        <F k="Kilometraje" v={v.km && `${Number(v.km).toLocaleString("es-CO")} km`} /><F k="VIN" v={v.vin} />
        <F k="Tarjeta" v={b.tarjetaPropiedad && "Foto adjunta"} />
      </Bloque>
      <Bloque titulo="El problema" paso={3} ir={ir}>
        <F k="Zona" v={b.zonas.map(nz).join(", ")} />
        <F k="Síntomas" v={b.sintomas.length ? <ul className="list-disc pl-4">{b.sintomas.map((s) => <li key={s}>{ns(s)}</li>)}</ul> : undefined} />
        <F k="Descripción" v={b.descripcion} /><F k="¿Se moviliza?" v={MOV[b.movilidad]} /><F k="Desde" v={b.desdeCuando} />
        <F k="Adjuntos" v={(b.adjuntos.length || b.notaVoz) && `${b.adjuntos.length} archivo(s)${b.notaVoz ? " + nota de voz" : ""}`} />
      </Bloque>
      <Bloque titulo="Cita" paso={5} ir={ir}>
        <F k="Cuándo" v={b.agenda.modo === "cita" ? `${textoCita(b.agenda.fecha, b.agenda.franja || null)} · pendiente de confirmación` : textoCita(null, null)} />
      </Bloque>
      <Bloque titulo="Autorizaciones" paso={6} ir={ir}>
        <F k="Presupuesto" v={b.presupuesto === "previo" ? "Solicito presupuesto previo" : "Autorizo reparar sin presupuesto previo"} />
        <F k="Prueba de ruta" v={b.pruebaRuta ? "Autorizada" : "No autorizada"} />
        <F k="Datos" v={b.datos ? "Autorizado" : "Falta"} />
      </Bloque>
    </>
  );
}
