/**
 * Punto único de acceso a datos. La rama que no se usa se elimina al compilar:
 * en producción (VITE_DEMO=false) el motor del semáforo demo no llega al navegador.
 */
import type { ApiCliente } from "./tipos";

export const api: ApiCliente =
  import.meta.env.VITE_DEMO === "true"
    ? (await import("../../demo/apiDemo")).apiDemo
    : (await import("./apiSupabase")).apiSupabase;
