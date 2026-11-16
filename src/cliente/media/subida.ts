import { useSyncExternalStore } from "react";
import { api } from "../../compartido/datos/api";
import type { Adjunto } from "../../compartido/datos/tipos";
import { comprimirImagen } from "../../compartido/util/imagen";

export const LIMITES = {
  fotoLadoMax: 1600,
  fotoMB: 0.6,
  videoMB: 50, // límite por archivo del plan gratuito de Supabase
  videoSegundos: 90,
  audioSegundos: 60,
  maxArchivos: 8,
};

/** Contador global de cargas en curso (para no enviar con archivos a medias). */
let pendientes = 0;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
export const usarCargasPendientes = () =>
  useSyncExternalStore((f) => (oyentes.add(f), () => oyentes.delete(f)), () => pendientes);


export function duracionVideo(f: File): Promise<number> {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); res(v.duration || 0); };
    v.onerror = () => res(0);
    v.src = URL.createObjectURL(f);
  });
}

/** Valida, comprime (fotos) y sube con reintentos automáticos. */
export async function subir(
  borradorId: string, archivo: File | Blob, nombre: string, tipo: Adjunto["tipo"], onProgreso: (p: number) => void,
): Promise<Adjunto> {
  pendientes++; avisar();
  try {
    let cuerpo: Blob = archivo;
    if (tipo === "foto" || tipo === "tarjeta") cuerpo = await comprimirImagen(archivo, LIMITES.fotoLadoMax, LIMITES.fotoMB);
    let ultimoError: unknown;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const ruta = await api.subirAdjunto(borradorId, cuerpo, nombre, onProgreso);
        return { ruta, tipo, nombre, tamano: cuerpo.size };
      } catch (e) {
        ultimoError = e;
        await new Promise((r) => setTimeout(r, 1200 * (intento + 1)));
      }
    }
    throw ultimoError;
  } finally {
    pendientes--; avisar();
  }
}

export const mb = (n: number) => (n / 1024 / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " MB";
