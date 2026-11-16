import { useCallback, useEffect, useMemo, useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type Color, type Regla, type SintomaAdmin, type ZonaAdmin } from "../datos/tipos";
import { ChipColor, COLOR_INFO } from "../ui";
import { Boton, Tarjeta } from "../../compartido/ui/base";

const COLORES: Color[] = ["rojo", "amarillo", "verde"];

function SelectorColor({ valor, onCambio, etiqueta }: { valor: Color; onCambio: (c: Color) => void; etiqueta: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex gap-1">
      {COLORES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={valor === c} title={COLOR_INFO[c].nombre} onClick={() => onCambio(c)}
          className={`h-8 w-8 rounded-full border-2 ${COLOR_INFO[c].barra} ${valor === c ? "border-texto ring-2 ring-offset-1" : "border-transparent opacity-40"}`}>
          <span className="sr-only">{COLOR_INFO[c].nombre}</span>
        </button>
      ))}
    </div>
  );
}

/** Editor visual de las reglas (sin tocar código) y probador con una solicitud de ejemplo. */
export default function ReglasSemaforo() {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [cat, setCat] = useState<{ zonas: ZonaAdmin[]; sintomas: SintomaAdmin[] }>({ zonas: [], sintomas: [] });
  const [zona, setZona] = useState("frenos");
  const [palabra, setPalabra] = useState({ valor: "", color: "amarillo" as Color });
  const [prueba, setPrueba] = useState({ zonas: [] as string[], sintomas: [] as string[], descripcion: "", movilidad: "si" });
  const [resultado, setResultado] = useState<{ color: Color; razones: string[] } | null>(null);
  const [msg, setMsg] = useState("");
  const cargar = useCallback(async () => {
    const [r, c] = await Promise.all([apiTaller.reglas(), apiTaller.catalogoAdmin()]);
    setReglas(r); setCat(c);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  const etiqueta = useMemo(() => new Map(cat.sintomas.map((s) => [s.id, s.etiqueta])), [cat]);
  async function hacer(fn: () => Promise<void>) {
    setMsg("");
    try { await fn(); await cargar(); setResultado(null); } catch (e) { setMsg("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo guardar.")); }
  }
  const sintomasZona = reglas.filter((r) => r.tipo === "sintoma" && r.valor.startsWith(zona + "."));
  const palabras = reglas.filter((r) => r.tipo === "palabra");
  const movilidad = reglas.filter((r) => r.tipo === "movilidad" || r.tipo === "movilidad_zona");

  return (
    <div className="grid gap-4">
      <Tarjeta>
        <h2 className="mb-1 text-lg font-bold">Semáforo interno</h2>
        <p className="mb-3 text-sm text-suave">Gana el color más grave que encuentre. El cliente nunca ve el color. Un cambio aquí aplica a las solicitudes nuevas; las que ya llegaron conservan su color.</p>
        {msg && <p role="alert" className="mb-2 text-aviso">{msg}</p>}
        <h3 className="mb-1 font-bold">Movilidad</h3>
        <ul className="mb-4 grid gap-1">
          {movilidad.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-fondo px-3 py-2">
              <span>{r.tipo === "movilidad" ? `Si responde «${r.valor === "no" ? "No puede movilizarse" : r.valor}»` : `Si responde «No estoy seguro» y marcó ${cat.zonas.find((z) => z.id === r.zona)?.nombre ?? r.zona}`}</span>
              <SelectorColor etiqueta="Color" valor={r.color} onCambio={(c) => hacer(() => apiTaller.guardarRegla({ ...r, color: c }))} />
            </li>
          ))}
        </ul>
        <h3 className="mb-1 font-bold">Síntomas que marca el cliente</h3>
        <select aria-label="Zona" className="campo mb-2 !w-auto" value={zona} onChange={(e) => setZona(e.target.value)}>
          {cat.zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
        <ul className="mb-4 grid gap-1">
          {sintomasZona.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg bg-fondo px-3 py-2 ${r.activo ? "" : "opacity-50"}`}>
              <span>{etiqueta.get(r.valor) ?? r.valor}</span>
              <SelectorColor etiqueta={`Color de ${etiqueta.get(r.valor) ?? r.valor}`} valor={r.color} onCambio={(c) => hacer(() => apiTaller.guardarRegla({ ...r, color: c }))} />
            </li>
          ))}
          {sintomasZona.length === 0 && <li className="text-sm text-suave">Esta zona no tiene síntomas con regla.</li>}
        </ul>
        <h3 className="mb-1 font-bold">Palabras en la descripción</h3>
        <p className="mb-2 text-sm text-suave">Se buscan sin importar mayúsculas ni tildes. Ej.: «humo», «pedal blando».</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {palabras.map((r) => (
            <span key={r.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${r.activo ? "" : "line-through opacity-50"}`}>
              <span aria-hidden className={`h-3 w-3 rounded-full ${COLOR_INFO[r.color].barra}`} />{r.valor}
              <button type="button" aria-label={`${r.activo ? "Quitar" : "Restaurar"} «${r.valor}»`} className="font-bold text-marca" onClick={() => hacer(() => apiTaller.guardarRegla({ ...r, activo: !r.activo }))}>{r.activo ? "×" : "↺"}</button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Nueva palabra" className="campo !w-56" placeholder="Nueva palabra o frase" value={palabra.valor} onChange={(e) => setPalabra({ ...palabra, valor: e.target.value })} />
          <SelectorColor etiqueta="Color de la palabra nueva" valor={palabra.color} onCambio={(c) => setPalabra({ ...palabra, color: c })} />
          <Boton disabled={palabra.valor.trim().length < 3} onClick={() => hacer(async () => { await apiTaller.crearRegla({ tipo: "palabra", valor: palabra.valor, zona: null, color: palabra.color }); setPalabra({ valor: "", color: "amarillo" }); })}>Agregar</Boton>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-1 text-lg font-bold">Probar el semáforo</h2>
        <p className="mb-3 text-sm text-suave">Arma una solicitud de ejemplo y mira qué color le daría, antes de que llegue un cliente real.</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {cat.zonas.filter((z) => z.activo).map((z) => (
            <button key={z.id} type="button" aria-pressed={prueba.zonas.includes(z.id)} onClick={() => setPrueba({ ...prueba, zonas: prueba.zonas.includes(z.id) ? prueba.zonas.filter((x) => x !== z.id) : [...prueba.zonas, z.id] })}
              className={`rounded-full border-2 px-3 py-1 text-sm ${prueba.zonas.includes(z.id) ? "border-marca bg-marca-suave font-bold" : "border-borde"}`}>{z.nombre}</button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {cat.sintomas.filter((s) => s.activo && prueba.zonas.includes(s.zona)).map((s) => (
            <button key={s.id} type="button" aria-pressed={prueba.sintomas.includes(s.id)} onClick={() => setPrueba({ ...prueba, sintomas: prueba.sintomas.includes(s.id) ? prueba.sintomas.filter((x) => x !== s.id) : [...prueba.sintomas, s.id] })}
              className={`rounded-lg border px-2 py-1 text-sm ${prueba.sintomas.includes(s.id) ? "border-marca bg-marca-suave font-bold" : "border-borde"}`}>{s.etiqueta}</button>
          ))}
        </div>
        <input aria-label="Descripción de prueba" className="campo mb-2" placeholder="Descripción como la escribiría el cliente" value={prueba.descripcion} onChange={(e) => setPrueba({ ...prueba, descripcion: e.target.value })} />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select aria-label="¿Se moviliza?" className="campo !w-auto" value={prueba.movilidad} onChange={(e) => setPrueba({ ...prueba, movilidad: e.target.value })}>
            <option value="si">Se moviliza</option><option value="no">No se moviliza</option><option value="nose">No está seguro</option>
          </select>
          <Boton onClick={async () => setResultado(await apiTaller.probarSemaforo(prueba))}>Probar</Boton>
        </div>
        {resultado && (
          <div className="rounded-xl bg-fondo p-3" role="status">
            <ChipColor color={resultado.color} />
            <ul className="mt-1 list-disc pl-5 text-sm">{resultado.razones.map((r) => <li key={r}>{r.replace(/Síntoma marcado: (\S+)/, (_, s) => "Síntoma: " + (etiqueta.get(s) ?? s))}</li>)}</ul>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
