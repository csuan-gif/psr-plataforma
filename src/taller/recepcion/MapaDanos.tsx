import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { Dano, TipoDano } from "../datos/tipos";
import { Dialogo } from "../ui";
import { Boton } from "../../compartido/ui/base";

export const PANELES: Record<string, string> = {
  parachoques_del: "Parachoques delantero", capo: "Capó", parabrisas: "Parabrisas", techo: "Techo", vidrio_trasero: "Vidrio trasero",
  baul: "Baúl / compuerta", parachoques_tras: "Parachoques trasero",
  guardabarros_del_izq: "Guardabarros delantero izquierdo", guardabarros_del_der: "Guardabarros delantero derecho",
  puerta_del_izq: "Puerta delantera izquierda", puerta_del_der: "Puerta delantera derecha",
  puerta_tras_izq: "Puerta trasera izquierda", puerta_tras_der: "Puerta trasera derecha",
  guardabarros_tras_izq: "Guardabarros trasero izquierdo", guardabarros_tras_der: "Guardabarros trasero derecho",
  espejo_izq: "Espejo izquierdo", espejo_der: "Espejo derecho",
  rin_del_izq: "Rin / llanta delantera izquierda", rin_del_der: "Rin / llanta delantera derecha",
  rin_tras_izq: "Rin / llanta trasera izquierda", rin_tras_der: "Rin / llanta trasera derecha",
};
export const TIPOS_DANO: Record<TipoDano, { nombre: string; icono: string }> = {
  golpe: { nombre: "Golpe", icono: "💥" }, rayon: { nombre: "Rayón", icono: "〰️" }, abolladura: { nombre: "Abolladura", icono: "◐" },
  vidrio_roto: { nombre: "Vidrio roto", icono: "🔨" }, pintura: { nombre: "Pintura dañada", icono: "🎨" },
};

/** Mapa de daños: el técnico toca un panel y marca el tipo de daño, con nota y foto opcional. */
export default function MapaDanos({ danos, onCambio, subirFoto }: { danos: Dano[]; onCambio: (d: Dano[]) => void; subirFoto: (f: File) => Promise<string> }) {
  const [zona, setZona] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoDano>("rayon");
  const [nota, setNota] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const cuenta = (z: string) => danos.filter((d) => d.zona === z).length;

  const P = ({ id, children }: { id: string; children: ReactNode }) => {
    const n = cuenta(id);
    const tecla = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setZona(id); } };
    return (
      <g role="button" tabIndex={0} aria-label={`${PANELES[id]}${n ? `: ${n} daño(s) marcado(s)` : ": sin daños"}`} onClick={() => setZona(id)} onKeyDown={tecla}
        className="cursor-pointer [&>*]:transition-colors" style={{ outline: "none" }}>
        <g fill={n ? "#f59e0b" : "var(--superficie)"} stroke="var(--suave)" strokeWidth="1.5" className="hover:[&>*]:fill-[var(--marca-suave)]">{children}</g>
      </g>
    );
  };

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_1fr]">
        <svg viewBox="0 0 240 470" className="mx-auto w-full max-w-[300px]" role="group" aria-label="Carrocería vista desde arriba, frente hacia arriba">
          <text x="120" y="11" textAnchor="middle" fontSize="11" fill="var(--suave)">▲ Frente</text>
          <P id="parachoques_del"><rect x="50" y="16" width="140" height="22" rx="10" /></P>
          <P id="capo"><path d="M54 42 H186 L180 120 H60 Z" /></P>
          <P id="parabrisas"><path d="M62 124 H178 L168 160 H72 Z" /></P>
          <P id="techo"><rect x="72" y="164" width="96" height="120" rx="6" /></P>
          <P id="vidrio_trasero"><path d="M72 288 H168 L176 318 H64 Z" /></P>
          <P id="baul"><path d="M62 322 H178 L184 410 H56 Z" /></P>
          <P id="parachoques_tras"><rect x="50" y="414" width="140" height="22" rx="10" /></P>
          <P id="guardabarros_del_izq"><path d="M30 46 H52 L58 140 H30 Z" /></P>
          <P id="guardabarros_del_der"><path d="M188 46 H210 V140 H182 Z" /></P>
          <P id="puerta_del_izq"><rect x="30" y="144" width="38" height="78" rx="4" /></P>
          <P id="puerta_del_der"><rect x="172" y="144" width="38" height="78" rx="4" /></P>
          <P id="puerta_tras_izq"><rect x="30" y="226" width="38" height="78" rx="4" /></P>
          <P id="puerta_tras_der"><rect x="172" y="226" width="38" height="78" rx="4" /></P>
          <P id="guardabarros_tras_izq"><path d="M30 308 H60 L54 408 H30 Z" /></P>
          <P id="guardabarros_tras_der"><path d="M180 308 H210 V408 H186 Z" /></P>
          <P id="espejo_izq"><rect x="6" y="148" width="22" height="16" rx="5" /></P>
          <P id="espejo_der"><rect x="212" y="148" width="22" height="16" rx="5" /></P>
          <P id="rin_del_izq"><circle cx="18" cy="90" r="12" /></P>
          <P id="rin_del_der"><circle cx="222" cy="90" r="12" /></P>
          <P id="rin_tras_izq"><circle cx="18" cy="360" r="12" /></P>
          <P id="rin_tras_der"><circle cx="222" cy="360" r="12" /></P>
          {Object.keys(PANELES).map((z) => {
            const n = cuenta(z);
            if (!n) return null;
            const el = { parachoques_del: [120, 27], capo: [120, 80], parabrisas: [120, 142], techo: [120, 224], vidrio_trasero: [120, 303], baul: [120, 366], parachoques_tras: [120, 425], guardabarros_del_izq: [42, 92], guardabarros_del_der: [198, 92], puerta_del_izq: [49, 183], puerta_del_der: [191, 183], puerta_tras_izq: [49, 265], puerta_tras_der: [191, 265], guardabarros_tras_izq: [42, 358], guardabarros_tras_der: [198, 358], espejo_izq: [17, 156], espejo_der: [223, 156], rin_del_izq: [18, 90], rin_del_der: [222, 90], rin_tras_izq: [18, 360], rin_tras_der: [222, 360] }[z]!;
            return <g key={z} pointerEvents="none"><circle cx={el[0]} cy={el[1]} r="9" fill="#b91c1c" /><text x={el[0]} y={el[1] + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{n}</text></g>;
          })}
        </svg>
        <div>
          <p className="mb-2 text-sm text-suave">Toca la parte del carro donde hay un golpe, rayón, abolladura, vidrio roto o pintura dañada. Si no hay ninguno, sigue al siguiente paso.</p>
          {danos.length === 0 ? <p className="rounded-xl bg-ok-fondo px-3 py-2 text-ok">Sin daños marcados.</p> : (
            <ul className="grid gap-1">
              {danos.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-borde px-3 py-2">
                  <span>{TIPOS_DANO[d.tipo].icono} <strong>{TIPOS_DANO[d.tipo].nombre}</strong> · {PANELES[d.zona]}{d.nota && <span className="text-suave"> · {d.nota}</span>}{d.foto && " 📷"}</span>
                  <button type="button" aria-label="Quitar daño" className="font-bold text-marca" onClick={() => onCambio(danos.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialogo titulo={zona ? PANELES[zona] : ""} abierto={!!zona} onCerrar={() => { setZona(null); setNota(""); setFoto(null); }}>
        <div role="radiogroup" aria-label="Tipo de daño" className="mb-3 grid grid-cols-2 gap-2">
          {(Object.keys(TIPOS_DANO) as TipoDano[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)}
              className={`min-h-12 rounded-xl border-2 px-3 text-left font-bold ${tipo === t ? "border-marca bg-marca-suave" : "border-borde"}`}>{TIPOS_DANO[t].icono} {TIPOS_DANO[t].nombre}</button>
          ))}
        </div>
        <label htmlFor="nota-dano" className="mb-1 block font-bold">Nota <span className="font-normal text-suave">(opcional)</span></label>
        <input id="nota-dano" className="campo mb-3" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: rayón de 10 cm, ya traía" />
        <label className="mb-3 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-borde font-bold">
          {subiendo ? "Subiendo…" : foto ? "✓ Foto adjunta (cambiar)" : "📷 Foto del daño (opcional)"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setSubiendo(true); try { setFoto(await subirFoto(f)); } finally { setSubiendo(false); }
          }} />
        </label>
        <Boton className="w-full" disabled={subiendo} onClick={() => { onCambio([...danos, { zona: zona!, tipo, nota: nota.trim() || undefined, foto }]); setZona(null); setNota(""); setFoto(null); }}>
          Marcar daño
        </Boton>
      </Dialogo>
    </div>
  );
}
