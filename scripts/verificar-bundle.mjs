// Regla 1: el semáforo NUNCA llega al navegador del cliente.
// 1) En TODA la compilación: ni el motor demo, ni las reglas, ni los colores esperados.
// 2) En lo que descarga el PORTAL DEL CLIENTE (index.html + lo que importa, sin el panel
//    del taller que se carga aparte en /taller): ni siquiera los nombres de las tablas internas.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const EN_TODO = ["__MOTOR_SEMAFORO_DEMO__", "__reglas_demo__", "noSeguroEnZonas", '"esperado"', "pedal esta blando"];
const EN_PORTAL = ["semaforo_auto", "semaforo_final", "triage_interno", "reglas_semaforo", "cambiar_semaforo", "ver_solicitud", "Urgente"];

const archivos = [];
const recorrer = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? recorrer(p) : archivos.push(p); });
recorrer("dist");
const texto = (a) => readFileSync(a, "utf8");
const hallazgos = [];
for (const a of archivos.filter((f) => /\.(js|html|css|json)$/.test(f) && !f.includes(".vite")))
  for (const p of EN_TODO) if (texto(a).includes(p)) hallazgos.push(`${a}: contiene ${p}`);

// Grafo de lo que descarga el portal, según el manifiesto de Vite.
const rutaManifiesto = "dist/.vite/manifest.json";
if (!existsSync(rutaManifiesto)) { console.error("✗ Falta dist/.vite/manifest.json (build.manifest)"); process.exit(1); }
const m = JSON.parse(texto(rutaManifiesto));
const portal = new Set();
const visitar = (k) => {
  if (portal.has(k) || !m[k]) return;
  portal.add(k);
  (m[k].imports ?? []).forEach(visitar);
  (m[k].dynamicImports ?? []).filter((d) => !d.startsWith("src/taller/")).forEach(visitar); // el panel se excluye
};
visitar("index.html");
const archivosPortal = [...portal].map((k) => "dist/" + m[k].file);
for (const a of archivosPortal) for (const p of EN_PORTAL) if (texto(a).includes(p)) hallazgos.push(`${a} (portal): contiene ${p}`);
const panel = Object.keys(m).filter((k) => k.startsWith("src/taller/AppTaller"));
if (!panel.length || portal.has(panel[0])) hallazgos.push("El panel del taller no está separado del portal.");

if (hallazgos.length) {
  console.error("✗ El código del navegador contiene información del semáforo:\n  " + hallazgos.join("\n  "));
  process.exit(1);
}
console.log(`✓ Verificado: ${archivos.length} archivos sin motor ni reglas; los ${archivosPortal.length} que descarga el portal no mencionan el semáforo.`);
