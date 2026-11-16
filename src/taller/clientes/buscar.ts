import type { ClienteLista } from "../datos/tipos";
import { normalizarTexto } from "../util/texto";

/** Búsqueda instantánea por nombre, documento, celular o placa. */
export function buscarClientes(l: ClienteLista[], q: string) {
  const t = normalizarTexto(q), d = q.replace(/\D/g, ""), p = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!t) return l;
  return l.filter((c) => normalizarTexto(c.nombre).includes(t) || (d.length >= 3 && (c.numeroDocumento.includes(d) || c.celular.includes(d))) || (p.length >= 2 && c.placas.some((x) => x.includes(p))));
}

