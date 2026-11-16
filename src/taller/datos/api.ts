/** Acceso a datos del panel. En demo usa la base simulada; en producción, Supabase. */
import type { ApiTaller } from "./tipos";

export const apiTaller: ApiTaller =
  import.meta.env.VITE_DEMO === "true"
    ? (await import("../../demo/apiTallerDemo")).apiTallerDemo
    : (await import("./apiTallerSupabase")).apiTallerSupabase;
