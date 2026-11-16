/** localStorage con respaldo en memoria (si el navegador lo bloquea, no falla). */
const memoria: Record<string, string> = {};

export const almacen = {
  leer<T>(clave: string, porDefecto: T): T {
    try {
      const v = localStorage.getItem(clave);
      if (v !== null) return JSON.parse(v) as T;
    } catch { /* sin almacenamiento */ }
    return clave in memoria ? (JSON.parse(memoria[clave]) as T) : porDefecto;
  },
  guardar(clave: string, valor: unknown) {
    const s = JSON.stringify(valor);
    memoria[clave] = s;
    try { localStorage.setItem(clave, s); } catch { /* queda en memoria */ }
  },
  borrar(clave: string) {
    delete memoria[clave];
    try { localStorage.removeItem(clave); } catch { /* nada */ }
  },
};

const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sin 0/O, 1/I/L
export function codigoSeguimiento(prefijo = "PSR", n = 6) {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return prefijo + "-" + Array.from(a, (x) => ALFABETO[x % ALFABETO.length]).join("");
}

export const nuevoId = () => crypto.randomUUID();
