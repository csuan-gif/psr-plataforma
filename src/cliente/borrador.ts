import { useEffect, useState } from "react";
import { almacen, nuevoId } from "../compartido/util/almacen";
import type { Adjunto, Movilidad, SolicitudNueva } from "../compartido/datos/tipos";
import type { Franja } from "../compartido/config";
import { TALLER } from "../compartido/config";
import { limpiarPlaca, limpiarVin } from "../compartido/util/validaciones";

export interface Borrador {
  id: string;
  paso: number;
  esClienteExistente: boolean;
  cliente: { tipoDocumento: string; numeroDocumento: string; digitoVerificacion: string; nombre: string; celular: string; correo: string; direccion: string; barrioMunicipio: string };
  vehiculo: { placa: string; marca: string; marcaOtra: string; linea: string; lineaOtra: string; anio: string; color: string; vin: string; combustible: string; km: string };
  tarjetaPropiedad: Adjunto | null;
  zonas: string[];
  sintomas: string[];
  descripcion: string;
  movilidad: Movilidad | "";
  desdeCuando: string;
  adjuntos: Adjunto[];
  notaVoz: Adjunto | null;
  agenda: { modo: "cita" | "info" | ""; fecha: string; franja: Franja | "" };
  presupuesto: "previo" | "sin_presupuesto" | "";
  pruebaRuta: boolean;
  datos: boolean;
  website: string; // honeypot
  canal: SolicitudNueva["canal"];
  recordatorioToken?: string; // si llegó desde el enlace de un recordatorio
}

export const borradorVacio = (): Borrador => ({
  id: nuevoId(), paso: 1, esClienteExistente: false,
  cliente: { tipoDocumento: "CC", numeroDocumento: "", digitoVerificacion: "", nombre: "", celular: "", correo: "", direccion: "", barrioMunicipio: "" },
  vehiculo: { placa: "", marca: "", marcaOtra: "", linea: "", lineaOtra: "", anio: "", color: "", vin: "", combustible: "", km: "" },
  tarjetaPropiedad: null, zonas: [], sintomas: [], descripcion: "", movilidad: "", desdeCuando: "",
  adjuntos: [], notaVoz: null, agenda: { modo: "", fecha: "", franja: "" },
  presupuesto: "", pruebaRuta: false, datos: false, website: "", canal: "portal",
});

const CLAVE = "psr-borrador-v1";
export const leerBorrador = () => almacen.leer<Borrador | null>(CLAVE, null);
export const borrarBorrador = () => almacen.borrar(CLAVE);
export const guardarBorrador = (b: Borrador) => almacen.guardar(CLAVE, b);

/** Estado del asistente con guardado automático. */
export function useBorrador(inicial: () => Borrador) {
  const [b, setB] = useState<Borrador>(inicial);
  useEffect(() => { guardarBorrador(b); }, [b]);
  return [b, setB] as const;
}

/** Errores que BLOQUEAN avanzar (lo demás son advertencias). */
export function validarPaso(paso: number, b: Borrador): string | null {
  const c = b.cliente, v = b.vehiculo;
  switch (paso) {
    case 1:
      if (!c.numeroDocumento.trim()) return "Escribe tu número de documento.";
      if (!c.celular.trim()) return "Escribe tu celular para poder confirmarte.";
      if (!b.esClienteExistente && !c.nombre.trim()) return "Escribe tu nombre o la razón social.";
      return null;
    case 2:
      if (!limpiarPlaca(v.placa)) return "Escribe la placa del vehículo.";
      if (!v.marca || (v.marca === "Otra" && !v.marcaOtra.trim())) return "Elige o escribe la marca.";
      return null;
    case 3:
      return b.zonas.length ? null : "Toca una zona del vehículo o elige «No sé».";
    case 4:
      if (!b.sintomas.length && !b.descripcion.trim()) return "Marca al menos una opción o cuéntanos con tus palabras.";
      if (!b.movilidad) return "Dinos si el vehículo puede movilizarse.";
      return null;
    case 5:
      if (!b.agenda.modo) return "Elige un día y una franja, o la opción de solo cotización.";
      if (b.agenda.modo === "cita" && (!b.agenda.fecha || !b.agenda.franja)) return "Elige un día y una franja disponibles.";
      return null;
    case 6:
      if (!b.presupuesto) return "Elige una opción sobre el presupuesto.";
      if (!b.datos) return "Para enviar tu solicitud necesitamos tu autorización de datos.";
      return null;
    default:
      return null;
  }
}

export function aSolicitud(b: Borrador): SolicitudNueva {
  const v = b.vehiculo;
  return {
    borradorId: b.id,
    esClienteExistente: b.esClienteExistente,
    cliente: {
      tipoDocumento: b.cliente.tipoDocumento,
      numeroDocumento: b.cliente.numeroDocumento.trim(),
      digitoVerificacion: b.cliente.digitoVerificacion || undefined,
      nombre: b.cliente.nombre.trim(),
      celular: b.cliente.celular.replace(/\D/g, ""),
      correo: b.cliente.correo.trim() || undefined,
      direccion: b.cliente.direccion.trim() || undefined,
      barrioMunicipio: b.cliente.barrioMunicipio.trim() || undefined,
    },
    vehiculo: {
      placa: limpiarPlaca(v.placa),
      marca: v.marca === "Otra" ? v.marcaOtra.trim() : v.marca,
      linea: v.linea === "Otra" ? v.lineaOtra.trim() : v.linea,
      anio: v.anio ? Number(v.anio) : null,
      color: v.color || undefined,
      vin: limpiarVin(v.vin) || undefined,
      combustible: v.combustible || undefined,
      km: v.km ? Number(v.km) : null,
    },
    zonas: b.zonas,
    sintomas: b.sintomas,
    descripcion: b.descripcion.trim(),
    movilidad: b.movilidad as Movilidad,
    desdeCuando: b.desdeCuando || undefined,
    adjuntos: [...b.adjuntos, ...(b.notaVoz ? [b.notaVoz] : []), ...(b.tarjetaPropiedad ? [b.tarjetaPropiedad] : [])],
    cita: b.agenda.modo === "cita" && b.agenda.fecha && b.agenda.franja ? { fecha: b.agenda.fecha, franja: b.agenda.franja } : null,
    autorizaciones: { presupuesto: b.presupuesto as "previo", pruebaRuta: b.pruebaRuta, datos: b.datos, versionAviso: TALLER.versionAviso },
    canal: b.canal,
    website: b.website || undefined,
  };
}
