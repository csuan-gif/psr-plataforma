import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error módulo JS sin tipos
import { CABECERAS, archivoHeaders } from "./scripts/cabeceras.mjs";

/** Escribe dist/_headers (Netlify) con las mismas cabeceras que usa `vite preview`. */
function cabecerasNetlify(): Plugin {
  let salida = "dist";
  return {
    name: "psr-cabeceras",
    apply: "build",
    configResolved(c) { salida = c.build.outDir; },
    closeBundle() { writeFileSync(join(salida, "_headers"), archivoHeaders()); writeFileSync(join(salida, "_redirects"), "/*  /index.html  200\n"); },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cabecerasNetlify()],
  build: { target: "es2022", sourcemap: false, manifest: true },
  preview: { headers: CABECERAS },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
} as never);
