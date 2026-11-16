import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { api } from "./compartido/datos/api";
import { aplicarConfig } from "./compartido/config";
import "./compartido/util/instalar"; // captura el aviso de instalación desde el inicio
import { aplicarTema } from "./compartido/ui/Tema";
aplicarTema();

// Datos públicos del taller (editables en Ajustes). Si no hay señal, se usan los de respaldo.
await Promise.race([api.configPublica().then(aplicarConfig).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: solo en producción (en desarrollo el service worker confundiría los cambios en vivo).
// Ojo: este módulo espera la configuración antes de pintar, así que "load" puede haber pasado ya.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const registrar = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
  if (document.readyState === "complete") void registrar();
  else window.addEventListener("load", () => void registrar(), { once: true });
}
