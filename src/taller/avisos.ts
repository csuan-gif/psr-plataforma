/** Avisos de solicitudes nuevas: sonido, notificación del navegador y contador en la pestaña. */
import { almacen } from "../compartido/util/almacen";

const CLAVE = "psr-avisos";
export const preferencias = {
  sonido: () => almacen.leer(CLAVE, { sonido: true }).sonido,
  setSonido: (v: boolean) => almacen.guardar(CLAVE, { sonido: v }),
};

let ctx: AudioContext | null = null;
/** Dos tonos cortos generados en el navegador (sin archivos de audio). */
export function sonar(urgente = false) {
  if (!preferencias.sonido()) return;
  try {
    ctx ??= new AudioContext();
    const tonos = urgente ? [880, 660, 880] : [660, 880];
    tonos.forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.frequency.value = f; o.type = "sine";
      const t = ctx!.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + 0.17);
    });
  } catch { /* sin audio */ }
}

export const permisoNotificaciones = () => (typeof Notification === "undefined" ? "no-soportado" : Notification.permission);
export async function pedirPermiso() {
  if (typeof Notification === "undefined") return "no-soportado";
  ctx ??= new AudioContext(); // el gesto del usuario también habilita el sonido
  return Notification.requestPermission();
}

/** Notificación sin datos personales (solo el código), por si la ve alguien más. */
export function notificar(codigo?: string) {
  if (permisoNotificaciones() !== "granted") return;
  try {
    const n = new Notification("Nueva solicitud en PSR", { body: codigo ? `Código ${codigo}. Ábrela en la bandeja.` : "Revisa la bandeja.", tag: "psr-nueva", icon: "/icono.svg" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* algunos móviles solo permiten notificaciones desde un service worker (Fase 5) */ }
}

export function tituloConContador(n: number) {
  document.title = (n > 0 ? `(${n}) ` : "") + "Taller · PSR";
}
