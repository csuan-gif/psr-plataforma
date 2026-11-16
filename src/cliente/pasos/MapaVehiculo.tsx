import type { KeyboardEvent, ReactNode } from "react";

interface Props { seleccion: string[]; onToggle: (zona: string) => void; nombres: Record<string, string> }

function Z({ id, children, p, etiqueta }: { id: string; children: ReactNode; p: Props; etiqueta?: string }) {
  const activo = p.seleccion.includes(id);
  const tecla = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onToggle(id); } };
  return (
    <g className="grupo-zona" role="button" tabIndex={0} aria-pressed={activo} aria-label={etiqueta ?? p.nombres[id] ?? id}
      onClick={() => p.onToggle(id)} onKeyDown={tecla}>
      {children}
    </g>
  );
}

/** Vista superior (frente arriba). */
export function VistaSuperior(p: Props) {
  return (
    <svg viewBox="0 0 240 470" className="mx-auto h-auto w-full max-w-[300px]" role="group" aria-label="Vehículo visto desde arriba, frente hacia arriba">
      <text x="120" y="12" textAnchor="middle" fontSize="11" fill="var(--suave)">▲ Frente</text>
      <rect x="40" y="18" width="160" height="430" rx="46" fill="var(--superficie)" stroke="var(--suave)" strokeWidth="2.5" />
      {[[16, 70], [202, 70], [16, 330], [202, 330]].map(([x, y], i) => (
        <Z key={i} id="llantas" p={p} etiqueta={`Llantas (${["delantera izquierda", "delantera derecha", "trasera izquierda", "trasera derecha"][i]})`}>
          <rect className="zona" x={x} y={y} width="22" height="62" rx="7" />
        </Z>
      ))}
      <Z id="refrigeracion" p={p}><rect className="zona" x="62" y="24" width="116" height="30" rx="14" /><text className="zona-txt" x="120" y="40">Radiador</text></Z>
      <Z id="motor" p={p}><rect className="zona" x="62" y="58" width="116" height="74" rx="10" /><text className="zona-txt" x="120" y="96">Motor</text></Z>
      <Z id="direccion" p={p}><rect className="zona" x="62" y="136" width="116" height="26" rx="6" /><text className="zona-txt" x="120" y="150">Dirección</text></Z>
      <Z id="electrico" p={p}><rect className="zona" x="66" y="166" width="108" height="28" rx="6" /><text className="zona-txt" x="120" y="181">Tablero</text></Z>
      <Z id="aire" p={p}><rect className="zona" x="66" y="198" width="108" height="118" rx="10" /><text className="zona-txt" x="120" y="252">Cabina</text><text className="zona-txt" x="120" y="266">y A.C.</text></Z>
      <Z id="carroceria" p={p} etiqueta="Carrocería y pintura (lados y baúl)">
        <rect className="zona" x="43" y="166" width="20" height="186" rx="6" />
        <rect className="zona" x="177" y="166" width="20" height="186" rx="6" />
        <rect className="zona" x="66" y="320" width="108" height="78" rx="12" />
        <text className="zona-txt" x="120" y="354">Latas</text><text className="zona-txt" x="120" y="368">y pintura</text>
      </Z>
      <Z id="escape" p={p} etiqueta="Escape (exosto)"><rect className="zona" x="128" y="410" width="50" height="30" rx="8" /><text className="zona-txt" x="153" y="425">Exosto</text></Z>
    </svg>
  );
}

/** Vista lateral (frente a la izquierda). */
export function VistaLateral(p: Props) {
  return (
    <svg viewBox="0 0 460 215" className="mx-auto h-auto w-full max-w-[520px]" role="group" aria-label="Vehículo visto de lado, frente a la izquierda">
      <text x="10" y="14" fontSize="11" fill="var(--suave)">◀ Frente</text>
      <path d="M22 150 L22 112 Q24 98 44 96 L118 94 L168 42 L326 42 L384 94 L424 98 Q440 102 440 118 L440 150 Z" fill="var(--superficie)" stroke="var(--suave)" strokeWidth="2.5" />
      <Z id="aire" p={p} etiqueta="Cabina y aire acondicionado"><path className="zona" d="M132 94 L172 50 L320 50 L366 94 Z" /><text className="zona-txt" x="250" y="76">Cabina y A.C.</text></Z>
      <Z id="refrigeracion" p={p}><rect className="zona" x="25" y="104" width="26" height="40" rx="6" /><text className="zona-txt" x="38" y="124" fontSize="9">Rad.</text></Z>
      <Z id="motor" p={p}><rect className="zona" x="55" y="100" width="80" height="44" rx="8" /><text className="zona-txt" x="95" y="122">Motor</text></Z>
      <Z id="carroceria" p={p} etiqueta="Carrocería y pintura">
        <rect className="zona" x="140" y="100" width="190" height="44" rx="8" />
        <rect className="zona" x="336" y="100" width="100" height="44" rx="8" />
        <text className="zona-txt" x="235" y="122">Puertas y latas</text>
      </Z>
      <Z id="transmision" p={p} etiqueta="Transmisión y embrague"><rect className="zona" x="150" y="152" width="164" height="22" rx="6" /><text className="zona-txt" x="232" y="163">Caja / embrague</text></Z>
      <Z id="escape" p={p} etiqueta="Escape (exosto)"><rect className="zona" x="396" y="152" width="56" height="22" rx="6" /><text className="zona-txt" x="424" y="163">Exosto</text></Z>
      {[110, 352].map((cx) => (
        <g key={cx}>
          <Z id="llantas" p={p}><circle className="zona" cx={cx} cy="166" r="40" /></Z>
          <Z id="frenos" p={p}><circle className="zona" cx={cx} cy="166" r="22" /><text className="zona-txt" x={cx} y="166" fontSize="10">Freno</text></Z>
        </g>
      ))}
    </svg>
  );
}
