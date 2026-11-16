import { aviso } from "../compartido/avisoPrivacidad";
import { Marco, Tarjeta } from "../compartido/ui/base";

export default function Privacidad() {
  const AVISO = aviso();
  return (
    <Marco titulo="Aviso de privacidad">
      <article className="grid gap-4">
        <h1 className="text-2xl font-bold">Aviso de privacidad y tratamiento de datos</h1>
        {AVISO.borrador && (
          <p className="rounded-xl bg-aviso-fondo px-4 py-2 text-sm text-aviso">
            <strong>Borrador para revisión del taller</strong> (versión {AVISO.version}). Debe revisarse antes de publicarse.
          </p>
        )}
        <Tarjeta><h2 className="mb-1 font-bold">Responsable</h2><p>{AVISO.responsable}</p></Tarjeta>
        <Tarjeta>
          <h2 className="mb-2 font-bold">Qué datos pedimos y para qué</h2>
          <ul className="grid gap-3">
            {AVISO.finalidades.map((f) => (
              <li key={f.datos}><p className="font-bold">{f.datos}</p><p className="text-suave">{f.para}</p></li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta>
          <h2 className="mb-2 font-bold">Tus derechos (Ley 1581 de 2012)</h2>
          <ul className="list-disc pl-5">{AVISO.derechos.map((d) => <li key={d}>{d}</li>)}</ul>
          <p className="mt-2">{AVISO.procedimiento}</p>
        </Tarjeta>
        <Tarjeta><h2 className="mb-1 font-bold">Dónde se guardan</h2><p>{AVISO.encargados.replace(/\s*\/\/ EDITAR.*$/, "")}</p></Tarjeta>
        <Tarjeta><h2 className="mb-1 font-bold">Seguridad</h2><p>{AVISO.seguridad}</p></Tarjeta>
        <Tarjeta><h2 className="mb-1 font-bold">Tiempo de conservación</h2><p>{AVISO.conservacion.replace(/\s*\/\/ EDITAR.*$/, "")}</p></Tarjeta>
        <p className="text-sm text-suave">{AVISO.menores} {AVISO.vigencia.replace(/\s*\/\/ EDITAR.*$/, "")}</p>
      </article>
    </Marco>
  );
}
