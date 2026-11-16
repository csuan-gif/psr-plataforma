import { TALLER } from "./config";

/**
 * BORRADOR PARA REVISIÓN DEL TALLER. No es asesoría legal: debe revisarlo el
 * propietario (idealmente con un abogado) antes de publicarse. Ley 1581 de 2012
 * y Decreto 1074 de 2015 (que compila el Decreto 1377 de 2013).
 */
/** Se arma al mostrarse, con los datos actuales del taller (editables en Ajustes). */
export const aviso = () => ({
  version: TALLER.versionAviso,
  borrador: true,
  responsable: `${TALLER.responsableDatos}${TALLER.nit ? ` (NIT ${TALLER.nit})` : ""}. Dirección: ${TALLER.direccion}. Correo: ${TALLER.correo}. Teléfono: ${TALLER.telefono}.`,
  finalidades: [
    { datos: "Tipo y número de documento, nombre o razón social", para: "Identificarte, crear tu orden de trabajo y tu historial, y emitir cuentas de cobro o facturas." },
    { datos: "Celular, correo, dirección", para: "Confirmar o reprogramar citas, enviarte el acta de recepción, el presupuesto y el estado de tu vehículo, y avisarte cuando te corresponda un mantenimiento preventivo o un vencimiento (SOAT, revisión técnico-mecánica) si registraste esas fechas." },
    { datos: "Placa, marca, línea, año, color, VIN, combustible, kilometraje y foto de la tarjeta de propiedad", para: "Identificar el vehículo, preparar el servicio, llevar su historial, atender garantías y calcular el próximo mantenimiento." },
    { datos: "Descripción de la falla, fotos, videos y nota de voz", para: "Entender el problema antes de recibir el vehículo y dejar constancia de su estado. No se usan para identificarte ni para fines distintos." },
    { datos: "Acta de recepción: fotos, video, nivel de combustible, objetos personales y firma", para: "Dejar constancia del estado en que se recibe y entrega el vehículo y de lo que autorizas (presupuesto previo y prueba de ruta)." },
    { datos: "Autorizaciones y su fecha", para: "Probar que diste tu autorización, como exige la ley." },
  ],
  derechos: [
    "Conocer, actualizar y rectificar tus datos.",
    "Pedir prueba de la autorización que diste.",
    "Ser informado del uso que se les ha dado.",
    "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).",
    "Revocar la autorización o pedir que se borren tus datos cuando no exista un deber legal o contractual de conservarlos.",
    "Acceder gratis a tus datos.",
  ],
  procedimiento:
    "Escribe al correo del taller o por WhatsApp indicando tu nombre, documento y lo que pides. Las consultas se responden en máximo 10 días hábiles (prorrogables 5) y los reclamos en máximo 15 días hábiles (prorrogables 8).",
  encargados:
    "Los datos se guardan en servicios de computación en la nube que actúan como encargados del tratamiento (Supabase para la base de datos y archivos; Netlify o similar para publicar la página). Estos proveedores pueden almacenar la información fuera de Colombia, con medidas de seguridad y bajo contrato. " + (TALLER.regionDatos ? `Región del servidor: ${TALLER.regionDatos}.` : "// EDITAR: región elegida del servidor."),
  seguridad:
    "Solo el propietario y los técnicos del taller, con usuario y contraseña, pueden ver los datos. Cada acceso a datos personales queda registrado. Los archivos se guardan en almacenamiento privado.",
  conservacion: TALLER.conservacion || "Mientras seas cliente y por el tiempo necesario para atender garantías y cumplir obligaciones legales y contables. // EDITAR: plazo definido por el taller.",
  menores: "Este servicio no está dirigido a menores de edad.",
  vigencia: "Vigente desde noviembre de 2026. // EDITAR al publicar.",
});
