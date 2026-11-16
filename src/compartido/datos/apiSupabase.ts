/**
 * API real contra Supabase. El rol anónimo solo usa funciones RPC (nunca lee
 * tablas con datos personales ni el semáforo). Ver supabase/migrations.
 */
import { createClient } from "@supabase/supabase-js";
import catalogoJson from "../catalogo/sintomas.json";
import { nuevoId } from "../util/almacen";
import {
  ErrorApi, type ApiCliente, type CupoDia, type EstadoPublico, type VehiculoPrecargado, type ZonaCat, type SintomaCat,
} from "./tipos";
import type { Franja } from "../config";

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string;
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = createClient(URL_SB, CLAVE, { auth: { persistSession: true } });

function traducirError(e: { message?: string; code?: string } | null): never {
  const m = e?.message ?? "";
  if (m.includes("CUPO_LLENO")) throw new ErrorApi("CUPO_LLENO", "Esa franja se acaba de llenar. Elige otra, por favor.");
  if (m.includes("DEMASIADOS_INTENTOS")) throw new ErrorApi("DEMASIADOS_INTENTOS", "Hiciste muchos intentos. Espera unos minutos y vuelve a intentar.");
  if (m.includes("DATOS_INVALIDOS")) throw new ErrorApi("DATOS_INVALIDOS", "Revisa los datos obligatorios.");
  if (m.includes("Failed to fetch") || m.includes("NetworkError")) throw new ErrorApi("SIN_CONEXION", "Sin conexión.");
  throw new ErrorApi("OTRO", "No pudimos completar la operación. Intenta de nuevo.");
}

export const apiSupabase: ApiCliente = {
  async catalogo() {
    const [z, s] = await Promise.all([
      supabase.from("zonas").select("id,nombre,ayuda").eq("activo", true).order("orden"),
      supabase.from("sintomas").select("id,zona,etiqueta").eq("activo", true).order("orden"),
    ]);
    if (z.error || s.error || !z.data?.length) return { zonas: catalogoJson.zonas, sintomas: catalogoJson.sintomas };
    return { zonas: z.data as ZonaCat[], sintomas: s.data as SintomaCat[] };
  },

  async disponibilidad(desde, hasta) {
    const { data, error } = await supabase.rpc("disponibilidad_publica", { p_desde: desde, p_hasta: hasta });
    if (error) traducirError(error);
    const porDia = new Map<string, CupoDia>();
    for (const r of data as { fecha: string; franja: Franja; disponible: boolean; motivo: string | null }[]) {
      const d = porDia.get(r.fecha) ?? { fecha: r.fecha, franjas: [], motivo: r.motivo ?? undefined };
      d.franjas.push({ franja: r.franja, disponible: r.disponible });
      porDia.set(r.fecha, d);
    }
    return [...porDia.values()].map((d) => ({ ...d, motivo: d.motivo ?? (d.franjas.every((f) => !f.disponible) ? "Sin cupo" : undefined) }));
  },

  /** Subida con barra de progreso (XHR). El anónimo solo puede ESCRIBIR en pendientes/. */
  subirAdjunto(borradorId, archivo, nombre, onProgreso) {
    const limpio = nombre.normalize("NFD").replace(/[^\w.-]/g, "_").slice(-60);
    const ruta = `pendientes/${borradorId}/${nuevoId()}-${limpio}`;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${URL_SB}/storage/v1/object/solicitudes/${ruta}`);
      xhr.setRequestHeader("apikey", CLAVE);
      xhr.setRequestHeader("Authorization", `Bearer ${CLAVE}`);
      xhr.setRequestHeader("x-upsert", "false");
      if (archivo.type) xhr.setRequestHeader("Content-Type", archivo.type);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgreso?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status < 300 ? resolve(ruta) : reject(new ErrorApi("OTRO", "No se pudo subir el archivo.")));
      xhr.onerror = () => reject(new ErrorApi("SIN_CONEXION", "Sin conexión."));
      xhr.send(archivo);
    });
  },

  async crearSolicitud(s) {
    const { data, error } = await supabase.rpc("crear_solicitud", { p: s });
    if (error) traducirError(error);
    return data as { codigo: string; cita: { fecha: string; franja: Franja; estado: "pendiente" } | null };
  },

  async precargarVehiculo(placa, doc4, cel4) {
    const { data, error } = await supabase.rpc("precargar_vehiculo", { p_placa: placa, p_doc4: doc4, p_cel4: cel4 });
    if (error) traducirError(error);
    return (data as VehiculoPrecargado | null) ?? null;
  },

  async responderPresupuesto(codigo, doc4, decision) {
    const { data, error } = await supabase.rpc("responder_presupuesto", { p_codigo: codigo, p_doc4: doc4, p_decision: decision });
    if (error) traducirError(error);
    return !!data;
  },

  async precargaRecordatorio(token) {
    const { data, error } = await supabase.rpc("precarga_recordatorio", { p_token: token });
    if (error) traducirError(error);
    return (data as never) ?? null;
  },
  async vincularRecordatorio(token, codigo) {
    const { data } = await supabase.rpc("vincular_recordatorio", { p_token: token, p_codigo: codigo });
    return !!data;
  },
  async miMantenimiento(placa, doc4, cel4) {
    const { data, error } = await supabase.rpc("mi_mantenimiento", { p_placa: placa, p_doc4: doc4, p_cel4: cel4 });
    if (error) traducirError(error);
    return (data as never) ?? null;
  },
  async registrarVencimientos(placa, doc4, cel4, soat, rtm) {
    const { data, error } = await supabase.rpc("registrar_vencimientos", { p_placa: placa, p_doc4: doc4, p_cel4: cel4, p_soat: soat, p_rtm: rtm });
    if (error) traducirError(error);
    return !!data;
  },

  async configPublica() {
    const { data } = await supabase.rpc("config_publica");
    return (data as never) ?? null;
  },

  async consultarEstado(codigo, doc4) {
    const { data, error } = await supabase.rpc("consultar_estado", { p_codigo: codigo, p_doc4: doc4 });
    if (error) traducirError(error);
    return (data as EstadoPublico | null) ?? null;
  },
};
