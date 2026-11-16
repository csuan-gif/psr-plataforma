import type { Franja } from "../../compartido/config";
import type { Adjunto } from "../../compartido/datos/tipos";
import type { DatosTransicion, EstadoOrden, EstadoPresupuesto, Trabajo } from "../util/reglasOrden";

export type Color = "rojo" | "amarillo" | "verde";
export type Rol = "admin" | "tecnico";
export interface Usuario { id: string; nombre: string; rol: Rol; correo?: string }

export interface CitaResumen { id: string; fecha: string; franja: Franja; estado: string; notas?: string | null }

export interface SolicitudTaller {
  id: string;
  codigo: string;
  creadoEn: string;
  estado: "nueva" | "en_revision" | "atendida" | "convertida" | "descartada";
  canal: string;
  cliente: { id: string; nombre: string; celular: string; numeroDocumento?: string };
  vehiculo: { id: string; placa: string; marca: string; linea: string | null; anio: number | null; color: string | null; km: number | null };
  zonas: string[];
  sintomas: string[];
  descripcion: string;
  movilidad: string;
  desdeCuando: string | null;
  adjuntos: Adjunto[];
  presupuesto: string;
  pruebaRuta: boolean;
  semaforo: { auto: Color; final: Color; razones: string[]; motivo: string | null };
  cita: CitaResumen | null;
}

export interface DetalleSolicitud extends Omit<SolicitudTaller, "cliente"> {
  cliente: { id: string; tipoDocumento: string; numeroDocumento: string; digitoVerificacion: string | null; nombre: string; celular: string; correo: string | null; direccion: string | null; verificado: boolean };
  vehiculo: SolicitudTaller["vehiculo"] & { vin: string | null; combustible: string | null; tarjeta: string | null };
  datosReportados: { cliente?: Record<string, unknown>; vehiculo?: Record<string, unknown>; esClienteExistente?: boolean };
  kmReportado: number | null;
  cambios: { de: Color; a: Color; motivo: string; fecha: string; usuario: string | null }[];
}

export interface CupoTaller { fecha: string; franja: Franja; cupos: number; usados: number; motivo: string | null }

export interface CitaAgenda extends CitaResumen {
  solicitudId: string;
  codigo: string;
  nombre: string;
  celular: string;
  placa: string;
  vehiculo: string;
  color: Color;
}

export interface FilaDisponibilidad { diaSemana: number; franja: Franja; horaInicio: string; horaFin: string; cupos: number; activo: boolean }
export interface ConfigAgenda {
  disponibilidad: FilaDisponibilidad[];
  bloqueados: { id: string; fecha: string; franja: Franja | null; motivo: string | null }[];
  festivos: { fecha: string; nombre: string }[];
}

export type Plantillas = Record<"recibida" | "confirmar" | "reprogramar" | "rechazar" | "info", string>;

export interface EstadoPresencia { usuarioId: string; nombre: string; viendo: string | null }

export interface EventoCambio { tipo: "nueva" | "cambio"; codigo?: string }

export interface ApiTaller {
  sesionActual(): Promise<Usuario | null>;
  iniciarSesion(correo: string, clave: string): Promise<Usuario>;
  cerrarSesion(): Promise<void>;
  /** Solo demo: usuarios de ejemplo para entrar sin contraseña. */
  usuariosDemo?: Usuario[];

  solicitudes(): Promise<SolicitudTaller[]>;
  detalle(id: string): Promise<DetalleSolicitud>;
  alCambiar(cb: (e: EventoCambio) => void): () => void;
  urlArchivo(ruta: string): Promise<string | null>;
  cambiarSemaforo(id: string, color: Color, motivo: string): Promise<void>;
  marcarSolicitud(id: string, estado: "nueva" | "en_revision" | "atendida" | "descartada"): Promise<void>;

  cupos(desde: string, hasta: string): Promise<CupoTaller[]>;
  citas(desde: string, hasta: string): Promise<CitaAgenda[]>;
  estadoCita(citaId: string, estado: "confirmada" | "cancelada" | "no_asistio" | "pendiente", nota?: string): Promise<void>;
  reprogramarCita(citaId: string, fecha: string, franja: Franja, forzar?: boolean): Promise<void>;
  crearCita(solicitudId: string, fecha: string, franja: Franja, forzar?: boolean): Promise<void>;

  configAgenda(): Promise<ConfigAgenda>;
  guardarDisponibilidad(filas: FilaDisponibilidad[]): Promise<void>;
  bloquear(fecha: string, franja: Franja | null, motivo: string): Promise<void>;
  desbloquear(id: string): Promise<void>;
  plantillas(): Promise<Plantillas>;
  guardarPlantillas(p: Plantillas): Promise<void>;

  presencia(yo: Usuario, cb: (otros: EstadoPresencia[]) => void): { ver(solicitudId: string | null): void; salir(): void };

  // Fase 3
  precargaDesdeSolicitud(solicitudId: string): Promise<PrecargaRecepcion>;
  buscarVehiculo(placa: string): Promise<PrecargaRecepcion | null>;
  subirArchivoActa(actaId: string, archivo: Blob, nombre: string): Promise<string>;
  crearRecepcion(r: NuevaRecepcion): Promise<{ recepcionId: string; ordenId: string; codigo: string | null }>;
  acta(recepcionId: string): Promise<Acta>;
  ordenes(): Promise<OrdenTaller[]>;
  historialOrden(ordenId: string): Promise<HistorialOrden[]>;
  cambiarEstadoOrden(ordenId: string, estado: EstadoOrden, datos?: DatosTransicion): Promise<void>;
  guardarTrabajos(ordenId: string, trabajos: Trabajo[]): Promise<void>;
  asignarTecnico(ordenId: string, tecnicoId: string | null): Promise<void>;
  enviarPresupuesto(ordenId: string, total: number, trabajos: Trabajo[]): Promise<void>;
  registrarRespuestaPresupuesto(ordenId: string, decision: "aprobado" | "rechazado", nota: string): Promise<void>;
  tecnicos(): Promise<Usuario[]>;
  planes(): Promise<PlanMantenimiento[]>;

  // Fase 4
  clientes(): Promise<ClienteLista[]>;
  fichaCliente(id: string): Promise<FichaCliente>;
  actualizarCliente(id: string, c: { celular?: string; correo?: string | null; direccion?: string | null; aceptaRecordatorios?: boolean }): Promise<void>;
  actualizarVehiculo(id: string, v: { fechaSoat?: string | null; fechaTecnomecanica?: string | null }): Promise<void>;
  anonimizarCliente(id: string, motivo: string): Promise<void>;
  registrarExportacion(filas: number, formato: "xlsx" | "csv"): Promise<void>;
  importarClientes(filas: FilaImportacion[]): Promise<ResultadoImportacion>;
  recordatorios(dias: number): Promise<RecordatorioTaller[]>;
  marcarRecordatorio(id: string, estado: EstadoRecordatorio): Promise<void>;
  indicadorRecordatorios(dias: number): Promise<IndicadorRecordatorios>;
  guardarPlan(p: PlanMantenimiento & { activo?: boolean }): Promise<void>;
  crearPlan(p: Omit<PlanMantenimiento, "id">): Promise<void>;

  // Fase 5
  guardarConfigPublica(d: Partial<import("../../compartido/config").DatosTaller>): Promise<void>;
  usuarios(): Promise<UsuarioAdmin[]>;
  agregarUsuario(correo: string, nombre: string, rol: Rol): Promise<void>;
  actualizarUsuario(id: string, rol: Rol, activo: boolean): Promise<void>;
  reglas(): Promise<Regla[]>;
  guardarRegla(r: Regla): Promise<void>;
  crearRegla(r: Omit<Regla, "id" | "activo">): Promise<void>;
  probarSemaforo(e: { zonas: string[]; sintomas: string[]; descripcion: string; movilidad: string }): Promise<{ color: Color; razones: string[] }>;
  catalogoAdmin(): Promise<{ zonas: ZonaAdmin[]; sintomas: SintomaAdmin[] }>;
  guardarSintoma(s: SintomaAdmin): Promise<void>;
  crearSintoma(s: Omit<SintomaAdmin, "id" | "orden" | "activo">, color: Color): Promise<void>;
  altaRapida(d: AltaRapida): Promise<string>;
}

// ---------- Fase 3: recepción y órdenes ----------
export type EstadoChecklist = "bien" | "novedad" | "na";
export interface ItemChecklist { estado: EstadoChecklist; nota?: string }
export type TipoDano = "golpe" | "rayon" | "abolladura" | "vidrio_roto" | "pintura";
export interface Dano { zona: string; tipo: TipoDano; nota?: string; foto?: string | null }
export type TipoFotoActa = "frente" | "lateral_izq" | "lateral_der" | "tablero" | "extra" | "dano";
export interface FotoActa { tipo: TipoFotoActa; ruta: string; nota?: string }

/** Datos para abrir un acta (desde la solicitud o buscando la placa). */
export interface PrecargaRecepcion {
  solicitudId: string | null;
  codigo: string | null;
  ordenAbierta: boolean;
  vehiculo: { id: string; placa: string; marca: string; linea: string | null; anio: number | null; color: string | null; vin: string | null; combustible: string | null; km: number | null };
  cliente: { id: string; tipoDocumento: string; numeroDocumento: string; nombre: string; celular: string; correo: string | null; direccion: string | null };
  presupuesto: "previo" | "sin_presupuesto" | null;
  pruebaRuta: boolean | null;
  reporte: { zonas: string[]; sintomas: string[]; descripcion: string } | null;
}

export interface NuevaRecepcion {
  solicitudId: string | null;
  vehiculoId: string;
  kmIngreso: number;
  nivelCombustible: number;
  checklist: Record<string, ItemChecklist>;
  mapaDanos: Dano[];
  objetosPersonales: string;
  accesorios: string;
  fotos: FotoActa[];
  videoInspeccion: string | null;
  autorizaPresupuestoPrevio: boolean;
  autorizaPruebaRuta: boolean;
  observaciones: string;
  firmaCliente: string;
  firmadoPor: string;
  vehiculo: { color?: string; vin?: string; combustible?: string };
  cliente: { correo?: string; direccion?: string };
}

export interface OrdenTaller {
  id: string;
  estado: EstadoOrden;
  creadoEn: string;
  codigo: string | null;
  solicitudId: string | null;
  recepcionId: string;
  vehiculo: { id: string; placa: string; marca: string; linea: string | null };
  cliente: { nombre: string; celular: string };
  tecnico: { id: string; nombre: string } | null;
  trabajos: Trabajo[];
  presupuesto: { total: number | null; estado: EstadoPresupuesto; enviadoEn: string | null; aprobadoPor: string | null };
  autorizaPresupuestoPrevio: boolean;
  autorizaPruebaRuta: boolean;
  kmIngreso: number | null;
  kmSalida: number | null;
  garantiaHasta: string | null;
  fechaEntrega: string | null;
  color: Color | null; // semáforo de la solicitud original (interno)
}
export interface HistorialOrden { estado: string; fecha: string; usuario: string | null; nota: string | null }

export interface Acta extends Omit<NuevaRecepcion, "vehiculo" | "cliente"> {
  id: string;
  ordenId: string | null;
  fechaHora: string;
  recibidoPor: string | null;
  codigo: string | null;
  vehiculo: PrecargaRecepcion["vehiculo"];
  cliente: PrecargaRecepcion["cliente"];
}

export interface PlanMantenimiento { id: number; servicio: string; intervaloKm: number | null; intervaloMeses: number | null; aplicaA: string }

// ---------- Fase 4: clientes y mantenimiento ----------
export interface ClienteLista {
  id: string; nombre: string; tipoDocumento: string; numeroDocumento: string; celular: string; correo: string | null;
  origen: "portal" | "importado" | "taller"; autorizaDatos: boolean; anonimizado: boolean; placas: string[]; creadoEn: string;
}
export interface OrdenHistorial {
  id: string; estado: string; creadoEn: string; fechaEntrega: string | null; recepcionId: string; kmIngreso: number | null; kmSalida: number | null;
  trabajos: { descripcion: string; tipo?: string; repuestos?: string }[]; presupuestoTotal: number | null; presupuestoEstado: string; garantiaHasta: string | null;
}
export interface VehiculoFicha {
  id: string; placa: string; marca: string; linea: string | null; anio: number | null; color: string | null; vin: string | null; combustible: string | null;
  km: number | null; kmFecha: string | null; kmDia: number | null; fechaSoat: string | null; fechaTecnomecanica: string | null;
  solicitudes: { id: string; codigo: string; creadoEn: string; estado: string; zonas: string[]; sintomas: string[]; descripcion: string }[];
  ordenes: OrdenHistorial[];
  recordatorios: { id: string; servicio: string; tipo: string; estado: string; fechaObjetivo: string | null; kmEstimado: number | null }[];
}
export interface FichaCliente {
  id: string; tipoDocumento: string; numeroDocumento: string; digitoVerificacion: string | null; nombre: string; celular: string; correo: string | null;
  direccion: string | null; barrioMunicipio: string | null; autorizaDatos: boolean; autorizaFecha: string | null; autorizaVersion: string | null;
  verificado: boolean; origen: string; aceptaRecordatorios: boolean; anonimizadoEn: string | null; creadoEn: string; vehiculos: VehiculoFicha[];
}
export type EstadoRecordatorio = "pendiente" | "enviado" | "agendado" | "descartado";
export interface RecordatorioTaller {
  id: string; token: string; tipo: "mantenimiento" | "soat" | "tecnomecanica"; servicio: string; estado: EstadoRecordatorio;
  fechaEstimada: string | null; kmEstimado: number | null; fechaPorKm: string | null; fechaObjetivo: string | null; kmDia: number | null; kmHoy: number | null;
  enviadoEn: string | null;
  vehiculo: { id: string; placa: string; marca: string; linea: string | null };
  cliente: { id: string; nombre: string; celular: string; autorizaDatos: boolean; aceptaRecordatorios: boolean; origen: string };
}
export interface IndicadorRecordatorios { dias: number; enviados: number; agendados: number; conversion: number | null }
export interface FilaImportacion {
  tipoDocumento?: string; numeroDocumento?: string; nombre?: string; celular?: string; correo?: string; direccion?: string;
  placa?: string; marca?: string; linea?: string; anio?: string; color?: string; km?: string;
  fechaUltimoServicio?: string; ultimoServicio?: string; fechaSoat?: string; fechaTecnomecanica?: string;
}
export interface ResultadoImportacion {
  filas: number; clientesNuevos: number; clientesActualizados: number; vehiculosNuevos: number; vehiculosActualizados: number; recordatorios: number;
  errores: { fila: number; motivo: string }[];
}

// ---------- Fase 5: configuración del administrador ----------
export interface UsuarioAdmin { id: string; nombre: string; rol: Rol; especialidad: string | null; activo: boolean; correo: string | null }
export interface Regla { id: number; tipo: "sintoma" | "palabra" | "movilidad" | "movilidad_zona"; valor: string; zona: string | null; color: Color; activo: boolean }
export interface SintomaAdmin { id: string; zona: string; etiqueta: string; orden: number; activo: boolean }
export interface ZonaAdmin { id: string; nombre: string; ayuda: string; orden: number; activo: boolean }
export interface AltaRapida { tipoDocumento: string; numeroDocumento: string; nombre: string; celular: string; correo?: string; placa: string; marca: string; linea?: string; anio?: string; motivo?: string; autorizaDatos: boolean }

export class ErrorTaller extends Error {
  constructor(public codigo: "CUPO_LLENO" | "NO_AUTORIZADO" | "MOTIVO_OBLIGATORIO" | "CREDENCIALES" | "SIN_PERFIL" | "ORDEN_ABIERTA" | "FALTAN_FOTOS" | "PRESUPUESTO_NO_APROBADO" | "PRUEBA_RUTA_NO_AUTORIZADA" | "DATOS_ENTREGA" | "ORDEN_CERRADA" | "ULTIMO_ADMIN" | "USUARIO_NO_EXISTE" | "OTRO", mensaje: string) {
    super(mensaje);
  }
}
