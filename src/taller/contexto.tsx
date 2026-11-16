/**
 * Estado compartido del panel: sesión, solicitudes en vivo, contador de nuevas y presencia.
 * Las solicitudes se recargan con cada evento de tiempo real (pocas filas: un taller pequeño).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiTaller } from "./datos/api";
import type { EstadoPresencia, SolicitudTaller, Usuario } from "./datos/tipos";
import { notificar, sonar, tituloConContador } from "./avisos";
import { almacen } from "../compartido/util/almacen";

interface Ctx {
  usuario: Usuario;
  salir(): Promise<void>;
  solicitudes: SolicitudTaller[] | null;
  error: string;
  recargar(): Promise<void>;
  noVistas: Set<string>;
  marcarVista(id: string): void;
  otros: EstadoPresencia[];
  verSolicitud(id: string | null): void;
  ultimoCambio: number;
}
const C = createContext<Ctx | null>(null);
export const usePanel = () => {
  const c = useContext(C);
  if (!c) throw new Error("usePanel fuera del panel");
  return c;
};

const CLAVE_VISTAS = "psr-taller-vistas";

export function ProveedorPanel({ usuario, onSalir, children }: { usuario: Usuario; onSalir: () => void; children: ReactNode }) {
  const [solicitudes, setSolicitudes] = useState<SolicitudTaller[] | null>(null);
  const [error, setError] = useState("");
  const [vistas, setVistas] = useState<Set<string>>(() => new Set(almacen.leer<string[]>(CLAVE_VISTAS, [])));
  const [otros, setOtros] = useState<EstadoPresencia[]>([]);
  const [ultimoCambio, setUltimoCambio] = useState(Date.now());
  const presencia = useRef<ReturnType<typeof apiTaller.presencia> | null>(null);

  const recargar = useCallback(async () => {
    try { setSolicitudes(await apiTaller.solicitudes()); setError(""); setUltimoCambio(Date.now()); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar la bandeja."); }
  }, []);

  useEffect(() => {
    void recargar();
    const quitar = apiTaller.alCambiar((ev) => {
      void recargar();
      if (ev.tipo === "nueva") { sonar(); notificar(ev.codigo); }
    });
    const t = window.setInterval(recargar, 60000); // respaldo si se pierde la conexión en vivo
    return () => { quitar(); window.clearInterval(t); };
  }, [recargar]);

  useEffect(() => {
    presencia.current = apiTaller.presencia(usuario, setOtros);
    return () => presencia.current?.salir();
  }, [usuario]);

  // Primera carga: lo existente cuenta como visto (solo cuentan las que lleguen después o sigan "nuevas" sin abrir).
  const inicial = useRef(true);
  useEffect(() => {
    if (!solicitudes) return;
    if (inicial.current && almacen.leer<string[] | null>(CLAVE_VISTAS, null) === null) {
      const todas = new Set(solicitudes.map((s) => s.id));
      setVistas(todas); almacen.guardar(CLAVE_VISTAS, [...todas]);
    }
    inicial.current = false;
  }, [solicitudes]);

  const noVistas = new Set((solicitudes ?? []).filter((s) => s.estado === "nueva" && !vistas.has(s.id)).map((s) => s.id));
  useEffect(() => { tituloConContador(noVistas.size); }, [noVistas.size]);

  const marcarVista = (id: string) => setVistas((v) => {
    const n = new Set(v); n.add(id); almacen.guardar(CLAVE_VISTAS, [...n].slice(-1000)); return n;
  });

  return (
    <C.Provider value={{
      usuario, salir: async () => { presencia.current?.salir(); await apiTaller.cerrarSesion(); onSalir(); },
      solicitudes, error, recargar, noVistas, marcarVista, otros, ultimoCambio,
      verSolicitud: (id) => presencia.current?.ver(id),
    }}>
      {children}
    </C.Provider>
  );
}
