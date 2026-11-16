import { useCallback, useEffect, useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type Color, type SintomaAdmin, type ZonaAdmin } from "../datos/tipos";
import { COLOR_INFO } from "../ui";
import { Boton, Tarjeta } from "../../compartido/ui/base";

/** Lista de síntomas por zona en lenguaje del cliente: renombrar, ocultar o agregar. */
export default function Sintomas() {
  const [cat, setCat] = useState<{ zonas: ZonaAdmin[]; sintomas: SintomaAdmin[] }>({ zonas: [], sintomas: [] });
  const [zona, setZona] = useState("frenos");
  const [nuevo, setNuevo] = useState({ etiqueta: "", color: "amarillo" as Color });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const cargar = useCallback(async () => setCat(await apiTaller.catalogoAdmin()), []);
  useEffect(() => { void cargar(); }, [cargar]);
  async function hacer(fn: () => Promise<void>, ok: string) {
    setMsg("");
    try { await fn(); await cargar(); setMsg("✓ " + ok); } catch (e) { setMsg("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo guardar.")); }
  }
  const lista = cat.sintomas.filter((s) => s.zona === zona);

  return (
    <Tarjeta>
      <h2 className="mb-1 text-lg font-bold">Síntomas por zona</h2>
      <p className="mb-3 text-sm text-suave">Escríbelos como los diría un cliente («chilla al frenar», no «pastillas cristalizadas»). Ocultar un síntoma no borra las solicitudes que ya lo usaron.</p>
      {msg && <p role="status" className={`mb-2 rounded-lg px-3 py-2 ${msg.startsWith("✓") ? "bg-ok-fondo text-ok" : "bg-aviso-fondo text-aviso"}`}>{msg}</p>}
      <select aria-label="Zona" className="campo mb-3 !w-auto" value={zona} onChange={(e) => setZona(e.target.value)}>
        {cat.zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
      </select>
      <ul className="mb-4 grid gap-2">
        {lista.map((s) => {
          const v = edit[s.id] ?? s.etiqueta;
          return (
            <li key={s.id} className={`flex flex-wrap items-center gap-2 ${s.activo ? "" : "opacity-50"}`}>
              <input aria-label={`Texto de ${s.etiqueta}`} className="campo min-w-0 flex-1" value={v} onChange={(e) => setEdit({ ...edit, [s.id]: e.target.value })} />
              {v !== s.etiqueta && <Boton onClick={() => hacer(() => apiTaller.guardarSintoma({ ...s, etiqueta: v }), "Texto actualizado.")}>Guardar</Boton>}
              <Boton variante="fantasma" onClick={() => hacer(() => apiTaller.guardarSintoma({ ...s, activo: !s.activo }), s.activo ? "Síntoma oculto." : "Síntoma visible de nuevo.")}>{s.activo ? "Ocultar" : "Mostrar"}</Boton>
            </li>
          );
        })}
      </ul>
      <h3 className="mb-1 font-bold">Agregar síntoma a esta zona</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Nuevo síntoma" className="campo min-w-0 flex-1" placeholder="Ej.: suena como un tambor al frenar" value={nuevo.etiqueta} onChange={(e) => setNuevo({ ...nuevo, etiqueta: e.target.value })} />
        <select aria-label="Color del semáforo para este síntoma" className="campo !w-auto" value={nuevo.color} onChange={(e) => setNuevo({ ...nuevo, color: e.target.value as Color })}>
          {(["rojo", "amarillo", "verde"] as Color[]).map((c) => <option key={c} value={c}>{COLOR_INFO[c].nombre}</option>)}
        </select>
        <Boton disabled={nuevo.etiqueta.trim().length < 4} onClick={() => hacer(async () => { await apiTaller.crearSintoma({ zona, etiqueta: nuevo.etiqueta }, nuevo.color); setNuevo({ etiqueta: "", color: "amarillo" }); }, "Síntoma agregado; ya aparece en el portal.")}>Agregar</Boton>
      </div>
    </Tarjeta>
  );
}
