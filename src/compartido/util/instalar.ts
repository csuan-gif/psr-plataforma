/** "Instalar app": guarda el aviso del navegador para mostrarlo cuando la persona toque el botón. */
import { useSyncExternalStore } from "react";

interface EventoInstalar extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let aviso: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); aviso = e as EventoInstalar; avisar(); });
  window.addEventListener("appinstalled", () => { aviso = null; avisar(); });
}

export const usarInstalable = () => useSyncExternalStore((f) => (oyentes.add(f), () => oyentes.delete(f)), () => !!aviso);
export async function instalar() {
  if (!aviso) return false;
  await aviso.prompt();
  const r = await aviso.userChoice;
  aviso = null; avisar();
  return r.outcome === "accepted";
}
export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
export const yaInstalada = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/** El panel del taller se instala como su propia app ("PSR Taller", abre en /taller). */
export function usarManifiesto(href: string, titulo: string) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  const antes = [link?.href, meta?.content];
  if (link) link.href = href;
  if (meta) meta.content = titulo;
  return () => { if (link && antes[0]) link.href = antes[0]; if (meta && antes[1]) meta.content = antes[1]; };
}
