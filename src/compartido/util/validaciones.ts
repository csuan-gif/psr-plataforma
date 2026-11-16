/** Validaciones que ADVIERTEN, no bloquean (salvo lo marcado como obligatorio). */

export const limpiarPlaca = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function avisoPlaca(p: string): string | null {
  const v = limpiarPlaca(p);
  if (!v) return null;
  if (/^[A-Z]{3}\d{3}$/.test(v)) return null; // carro particular / público: ABC123
  if (/^[A-Z]{3}\d{2}[A-Z]?$/.test(v)) return "Parece una placa de moto. Revísala si es un carro.";
  if (/^[A-Z]\d{4,5}$/.test(v)) return null; // remolques y especiales
  return "La placa no tiene el formato usual (ej.: ABC123). Puedes continuar si es correcta.";
}

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
export const limpiarVin = (v: string) => v.toUpperCase().replace(/\s/g, "");
export function avisoVin(v: string): string | null {
  const x = limpiarVin(v);
  if (!x) return null;
  if (x.length !== 17) return `El VIN tiene 17 caracteres; escribiste ${x.length}.`;
  if (/[IOQ]/.test(x)) return "El VIN no usa las letras I, O ni Q. Revisa si es 1 o 0.";
  if (!VIN_RE.test(x)) return "El VIN solo tiene letras y números.";
  return null;
}

/** Dígito de verificación del NIT (DIAN, módulo 11). */
export function digitoVerificacionNit(nit: string): number | null {
  const d = nit.replace(/\D/g, "");
  if (!d || d.length > 15) return null;
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let suma = 0;
  for (let i = 0; i < d.length; i++) suma += Number(d[d.length - 1 - i]) * pesos[i];
  const r = suma % 11;
  return r > 1 ? 11 - r : r;
}

export function avisoDocumento(tipo: string, numero: string, dv?: string): string | null {
  const n = numero.replace(/\D/g, "");
  if (!numero) return null;
  if (tipo === "PAS") return /^[A-Z0-9]{5,15}$/i.test(numero) ? null : "Revisa el número de pasaporte.";
  if (n !== numero.replace(/[.\s-]/g, "")) return "Escribe solo números, sin puntos ni guiones.";
  if (tipo === "CC" && (n.length < 5 || n.length > 10)) return "La cédula suele tener entre 5 y 10 dígitos.";
  if (tipo === "NIT") {
    if (n.length < 8 || n.length > 10) return "El NIT suele tener 9 dígitos (sin el dígito de verificación).";
    if (dv !== undefined && dv !== "") {
      const ok = digitoVerificacionNit(n);
      if (ok !== null && String(ok) !== dv) return `El dígito de verificación no coincide (debería ser ${ok}).`;
    }
  }
  return null;
}

export function avisoCelular(c: string): string | null {
  const d = c.replace(/\D/g, "").replace(/^57/, "");
  if (!c) return null;
  if (!/^3\d{9}$/.test(d)) return "Un celular en Colombia tiene 10 dígitos y empieza por 3.";
  return null;
}
export const celularE164 = (c: string) => "57" + c.replace(/\D/g, "").replace(/^57/, "");

export function avisoCorreo(c: string): string | null {
  if (!c) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c) ? null : "Revisa el correo (ej.: nombre@correo.com).";
}

export const ultimos4 = (s: string) => s.replace(/\D/g, "").slice(-4);
