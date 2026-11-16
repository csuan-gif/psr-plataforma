import type { PropsPaso } from "./Paso1Datos";
import type { Borrador } from "../borrador";
import { Campo, Grupo, Opcion } from "../../compartido/ui/base";
import { COLORES, COMBUSTIBLES, LISTA_MARCAS, MARCAS } from "../../compartido/catalogo/vehiculos";
import { avisoPlaca, avisoVin } from "../../compartido/util/validaciones";
import SubirArchivo from "../media/SubirArchivo";

const ANIO_ACTUAL = new Date().getFullYear();

export default function Paso2Vehiculo({ b, set }: PropsPaso) {
  const v = b.vehiculo;
  const cambiar = (k: keyof Borrador["vehiculo"], val: string) => set((x) => ({ ...x, vehiculo: { ...x.vehiculo, [k]: val } }));
  const lineas = MARCAS[v.marca] ?? [];
  const km = Number(v.km) || 0;

  return (
    <>
      <h2 className="mb-1 text-2xl font-bold">Tu vehículo</h2>
      <p className="mb-5 text-suave">Si no sabes algún dato, déjalo en blanco: el taller lo completa al recibirlo.</p>

      <Campo id="placa" etiqueta="Placa" aviso={avisoPlaca(v.placa)}>
        <input id="placa" className="campo max-w-48 text-center text-xl font-bold uppercase tracking-[0.2em]" maxLength={7} autoCapitalize="characters"
          value={v.placa} onChange={(e) => cambiar("placa", e.target.value.toUpperCase())} placeholder="ABC123" />
      </Campo>

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo id="marca" etiqueta="Marca">
          <input id="marca" className="campo" list="lista-marcas" value={v.marca} placeholder="Escribe o elige"
            onChange={(e) => set((x) => ({ ...x, vehiculo: { ...x.vehiculo, marca: e.target.value, linea: "" } }))} />
          <datalist id="lista-marcas">
            {LISTA_MARCAS.map((m) => <option key={m} value={m} />)}
            <option value="Otra" />
          </datalist>
        </Campo>
        {v.marca === "Otra" ? (
          <Campo id="marcaOtra" etiqueta="¿Cuál marca?">
            <input id="marcaOtra" className="campo" value={v.marcaOtra} onChange={(e) => cambiar("marcaOtra", e.target.value)} />
          </Campo>
        ) : (
          <Campo id="linea" etiqueta="Línea o modelo" opcional>
            <input id="linea" className="campo" list="lista-lineas" value={v.linea} placeholder={lineas[0] ? `Ej.: ${lineas[0]}` : "Ej.: Sandero"}
              onChange={(e) => cambiar("linea", e.target.value)} />
            <datalist id="lista-lineas">{lineas.map((l) => <option key={l} value={l} />)}</datalist>
          </Campo>
        )}
      </div>

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo id="anio" etiqueta="Año (modelo)" opcional>
          <select id="anio" className="campo" value={v.anio} onChange={(e) => cambiar("anio", e.target.value)}>
            <option value="">No sé / elegir…</option>
            {Array.from({ length: 45 }, (_, i) => ANIO_ACTUAL + 1 - i).map((a) => <option key={a}>{a}</option>)}
          </select>
        </Campo>
        <Campo id="km" etiqueta="Kilometraje aproximado" opcional>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Restar 1.000 km" className="campo !w-14 shrink-0 font-bold" onClick={() => cambiar("km", String(Math.max(0, km - 1000)))}>−</button>
            <input id="km" className="campo text-center" inputMode="numeric" value={v.km ? Number(v.km).toLocaleString("es-CO") : ""}
              onChange={(e) => cambiar("km", e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="45.000" />
            <button type="button" aria-label="Sumar 1.000 km" className="campo !w-14 shrink-0 font-bold" onClick={() => cambiar("km", String(km + 1000))}>+</button>
          </div>
        </Campo>
      </div>

      <Grupo titulo="Color" opcional>
        <div className="flex flex-wrap gap-2">
          {COLORES.map((c) => (
            <button key={c.nombre} type="button" aria-pressed={v.color === c.nombre} onClick={() => cambiar("color", v.color === c.nombre ? "" : c.nombre)}
              className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 ${v.color === c.nombre ? "border-marca bg-marca-suave font-bold" : "border-borde bg-superficie"}`}>
              <span aria-hidden className="h-6 w-6 rounded-full border border-borde" style={{ background: c.hex }} />
              {c.nombre}
            </button>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Combustible" opcional>
        <div className="flex flex-wrap gap-2">
          {COMBUSTIBLES.map((c) => <Opcion key={c.id} activo={v.combustible === c.id} onClick={() => cambiar("combustible", v.combustible === c.id ? "" : c.id)}>{c.nombre}</Opcion>)}
        </div>
      </Grupo>

      <Campo id="vin" etiqueta="VIN (número de chasis)" opcional aviso={avisoVin(v.vin)} ayuda="Son 17 letras y números; está en la tarjeta de propiedad. Si no lo sabes, toma una foto de la tarjeta.">
        <input id="vin" className="campo font-mono uppercase tracking-wider" maxLength={20} autoCapitalize="characters" value={v.vin} onChange={(e) => cambiar("vin", e.target.value.toUpperCase())} />
      </Campo>
      <SubirArchivo
        borradorId={b.id} tipo="tarjeta" etiqueta="📷 Tomar foto de la tarjeta de propiedad" acepta="image/*"
        valor={b.tarjetaPropiedad} onCambio={(a) => set((x) => ({ ...x, tarjetaPropiedad: a }))}
      />
    </>
  );
}
