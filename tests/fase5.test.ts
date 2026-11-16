import { describe, expect, it } from "vitest";
import { clasificar, listaDesdeReglas, reglasDesdeLista } from "../src/demo/motorSemaforo";
import casos from "./casos.json";
import { TALLER, aplicarConfig } from "../src/compartido/config";
// @ts-expect-error módulo JS sin tipos
import { CSP, archivoHeaders } from "../scripts/cabeceras.mjs";

describe("Reglas editables del semáforo", () => {
  it("convertir a filas y de vuelta da los mismos colores en C1 a C10 y los extra", () => {
    const R = reglasDesdeLista(listaDesdeReglas());
    for (const c of [...casos.casos, ...casos.extra]) expect(clasificar(c.entrada, R).color).toBe(c.esperado);
  });
  it("desactivar o cambiar una regla aplica sin tocar código", () => {
    const l = listaDesdeReglas();
    const pedal = l.find((r) => r.valor === "frenos.pedal_blando")!;
    const sinPedal = reglasDesdeLista(l.map((r) => (r.tipo === "palabra" || r.id === pedal.id ? { ...r, activo: false } : r)));
    expect(clasificar({ zonas: ["frenos"], sintomas: ["frenos.pedal_blando"], descripcion: "", movilidad: "si" }, sinPedal).color).toBe("verde");
    const conPalabra = reglasDesdeLista([...l, { id: 999, tipo: "palabra", valor: "tambor", zona: null, color: "rojo", activo: true }]);
    expect(clasificar({ zonas: ["nose"], sintomas: [], descripcion: "Suena como un TAMBOR", movilidad: "si" }, conPalabra).color).toBe("rojo");
  });
});

describe("Configuración pública del taller", () => {
  it("aplica solo campos conocidos y con valor", () => {
    const antes = TALLER.correo;
    aplicarConfig({ whatsapp: "573101112233", correo: "  ", horarios: [], ...({ inventado: "x" } as object) });
    expect(TALLER.whatsapp).toBe("573101112233");
    expect(TALLER.correo).toBe(antes);
    expect(TALLER.horarios.length).toBeGreaterThan(0);
    expect((TALLER as Record<string, unknown>).inventado).toBeUndefined();
  });
});

describe("Cabeceras de seguridad", () => {
  it("la CSP no permite scripts externos ni eval, y solo conecta con Supabase", () => {
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).not.toMatch(/unsafe-eval|cdn\.|jsdelivr|unpkg/);
    expect(CSP).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(archivoHeaders()).toContain("/sw.js\n  Cache-Control: no-cache");
  });
});
