import { defineConfig } from "@playwright/test";

// Prueba de punta a punta sobre la compilación DEMO servida con las cabeceras de producción (CSP).
// Usa el Google Chrome instalado en el equipo (no descarga navegadores).
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", channel: "chrome", locale: "es-CO", timezoneId: "America/Bogota", viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  webServer: {
    command: "npx vite build --mode demo --outDir dist-demo && npx vite preview --mode demo --outDir dist-demo --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
