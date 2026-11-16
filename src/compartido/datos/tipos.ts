import type { Franja } from "../config";

export type Movilidad = "si" | "no" | "nose";

export interface Adjunto {
  ruta: string; // ruta en Storage (o id local en demo)
  tipo: "foto" | "video" | "audio" | "tarjeta";
  nombre: string;
  tamano: number;
}

/** Lo que el cliente envía. NO incluye ningún campo de semáforo. */
export interface SolicitudNueva {
  borradorId: string;
  esClienteExistente: boolean;
  cliente: {
    tipoDocumento: string;
    numeroDocumento: string;
    digitoVerificacion?: string;
    nombre: string;
    celular: string;
    correo?: string;
    direccion?: string;
    barrioMunicipio?: string;
  };
  vehiculo: {
    placa: string;
    marca: string;
    linea: string;
    anio?: number | null;
    color?: string;
    vin?: string;
    combustible?: string;
    km?: number | null;
  };
  zonas: string[];
  sintomas: string[];
  descripcion: string;
  movilidad: Movilidad;
  desdeCuando?: string;
  adjuntos: Adjunto[];
  cita: { fecha: string; franja: Franja } | null; // null = solo cotización/información
  autorizaciones: {
    presupuesto: "previo" | "sin_presupuesto";
    pruebaRuta: boolean;
    datos: boolean;
    versionAviso: string;
  };
  canal: "portal" | "qr" | "recordatorio";
  website?: string; // honeypot: debe ir vacío
}

/** Respuesta neutra al cliente: nunca trae color ni prioridad. */
export interface ResultadoSolicitud {
  codigo: string;
  cita: { fecha: string; franja: Franja; estado: "pendiente" } | null;
}

export interface CupoDia {
  fecha: string;
  franjas: { franja: Franja; disponible: boolean }[];
  motivo?: string; // "Festivo", "Cerrado"... (sin datos de otros clientes)
}

export interface VehiculoPrecargado {
  placa: string;
  marca: string;
  linea: string;
  anio: number | null;
  color: string;
  combustible: string;
  km: number | null;
}

export interface EstadoPublico {
  codigo: string;
  placa: string;
  linea: string;
  pasos: { clave: string; nombre: string; fecha: string | null; hecho: boolean; nota?: string | null }[];
  cita: { fecha: string; franja: Franja; estado: string } | null;
  cancelada?: boolean;
  /** Presupuesto que el taller envió (lo escribe el taller; la plataforma no calcula precios). */
  presupuesto?: { total: number; estado: "pendiente" | "aprobado" | "rechazado" | "no_requerido"; enviadoEn: string; trabajos: { descripcion: string; repuestos?: string | null }[] } | null;
  entrega?: { fecha: string; garantiaHasta: string } | null;
}

export interface ZonaCat { id: string; nombre: string; ayuda: string }
export interface SintomaCat { id: string; zona: string; etiqueta: string }

export interface ApiCliente {
  catalogo(): Promise<{ zonas: ZonaCat[]; sintomas: SintomaCat[] }>;
  disponibilidad(desde: string, hasta: string): Promise<CupoDia[]>;
  subirAdjunto(borradorId: string, archivo: Blob, nombre: string, onProgreso?: (p: number) => void): Promise<string>;
  crearSolicitud(s: SolicitudNueva): Promise<ResultadoSolicitud>;
  precargarVehiculo(placa: string, doc4: string, cel4: string): Promise<VehiculoPrecargado | null>;
  consultarEstado(codigo: string, doc4: string): Promise<EstadoPublico | null>;
  responderPresupuesto(codigo: string, doc4: string, decision: "aprobado" | "rechazado"): Promise<boolean>;
  precargaRecordatorio(token: string): Promise<(VehiculoPrecargado & { servicio: string; tipo: string }) | null>;
  vincularRecordatorio(token: string, codigo: string): Promise<boolean>;
  miMantenimiento(placa: string, doc4: string, cel4: string): Promise<MiMantenimiento | null>;
  registrarVencimientos(placa: string, doc4: string, cel4: string, soat: string | null, rtm: string | null): Promise<boolean>;
  configPublica(): Promise<Partial<import("../config").DatosTaller> | null>;
}

export interface MiMantenimiento {
  placa: string; marca: string; linea: string; anio: number | null; color: string; combustible: string; km: number | null; kmFecha: string | null;
  fechaSoat: string | null; fechaTecnomecanica: string | null;
  proximos: { servicio: string; tipo: string; fecha: string | null; km: number | null }[];
  ultimoServicio: { fecha: string; km: number | null; trabajos: string[] } | null;
}

export class ErrorApi extends Error {
  constructor(public codigo: "CUPO_LLENO" | "DEMASIADOS_INTENTOS" | "DATOS_INVALIDOS" | "SIN_CONEXION" | "OTRO", mensaje: string) {
    super(mensaje);
  }
}
