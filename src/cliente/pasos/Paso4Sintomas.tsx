import type { PropsPaso } from "./Paso1Datos";
import type { SintomaCat, ZonaCat } from "../../compartido/datos/tipos";
import { Aviso, Campo, Grupo, Opcion } from "../../compartido/ui/base";
import { AVISO_SEGURIDAD, requiereAvisoSeguridad } from "../../compartido/util/mensajes";
import { SubirMultiple } from "../media/SubirArchivo";
import NotaVoz from "../media/NotaVoz";

const DESDE = ["Hoy", "Esta semana", "Más de una semana", "Siempre"];

export default function Paso4Sintomas({ b, set, zonas, sintomas }: PropsPaso & { zonas: ZonaCat[]; sintomas: SintomaCat[] }) {
  const toggle = (id: string) => set((x) => ({ ...x, sintomas: x.sintomas.includes(id) ? x.sintomas.filter((s) => s !== id) : [...x.sintomas, id] }));
  const grupos = [...b.zonas.filter((z) => z !== "general"), "general"];

  return (
    <>
      <h2 className="mb-1 text-2xl font-bold">¿Qué le pasa?</h2>
      <p className="mb-5 text-suave">Marca lo que notas. Usa tus palabras: no necesitas saber de mecánica.</p>

      {grupos.map((zid) => {
        const lista = sintomas.filter((s) => s.zona === zid);
        if (!lista.length) return null;
        const z = zonas.find((x) => x.id === zid);
        return (
          <Grupo key={zid} titulo={zid === "general" ? "¿Es algo de esto?" : z?.nombre ?? zid}>
            <div className="grid gap-2 sm:grid-cols-2">
              {lista.map((s) => <Opcion key={s.id} activo={b.sintomas.includes(s.id)} onClick={() => toggle(s.id)}>{s.etiqueta}</Opcion>)}
            </div>
          </Grupo>
        );
      })}

      <Campo id="desc" etiqueta="Cuéntanos con tus palabras" opcional ayuda="Por ejemplo: «chilla al frenar por las mañanas», «el pedal se siente blando».">
        <textarea id="desc" className="campo min-h-28" value={b.descripcion} maxLength={1500} onChange={(e) => set((x) => ({ ...x, descripcion: e.target.value }))} />
      </Campo>

      <Grupo titulo="¿Puede movilizarse por sus propios medios?">
        <div className="grid grid-cols-3 gap-2">
          {([["si", "Sí"], ["no", "No"], ["nose", "No estoy seguro"]] as const).map(([v, t]) => (
            <Opcion key={v} activo={b.movilidad === v} onClick={() => set((x) => ({ ...x, movilidad: v }))} className="text-center">{t}</Opcion>
          ))}
        </div>
      </Grupo>

      {b.movilidad && requiereAvisoSeguridad({ movilidad: b.movilidad, zonas: b.zonas, sintomas: b.sintomas }) && (
        <div className="mb-5"><Aviso tono="marca"><strong>Importante:</strong> {AVISO_SEGURIDAD}</Aviso></div>
      )}

      <Grupo titulo="¿Desde cuándo?" opcional>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DESDE.map((d) => <Opcion key={d} activo={b.desdeCuando === d} onClick={() => set((x) => ({ ...x, desdeCuando: x.desdeCuando === d ? "" : d }))} className="text-center">{d}</Opcion>)}
        </div>
      </Grupo>

      <SubirMultiple borradorId={b.id} valor={b.adjuntos} onCambio={(f) => set((x) => ({ ...x, adjuntos: f(x.adjuntos) }))} />
      <NotaVoz borradorId={b.id} valor={b.notaVoz} onCambio={(a) => set((x) => ({ ...x, notaVoz: a }))} />
    </>
  );
}
