import { describe, expect, it } from "vitest";
import { clasificar } from "../src/demo/motorSemaforo";
import casos from "./casos.json";
import catalogo from "../src/compartido/catalogo/sintomas.json";
import reglas from "../src/demo/reglas.json";

describe("Semáforo · casos C1 a C10 del informe", () => {
  for (const c of casos.casos) {
    it(`${c.id} → ${c.esperado}: ${c.texto}`, () => {
      expect(clasificar(c.entrada).color).toBe(c.esperado);
    });
  }
  it("cumple la hipótesis: 10 de 10 coinciden y ningún rojo queda en verde", () => {
    const res = casos.casos.map((c) => ({ esp: c.esperado, got: clasificar(c.entrada).color }));
    expect(res.filter((r) => r.esp === r.got).length).toBe(10);
    expect(res.some((r) => r.esp === "rojo" && r.got === "verde")).toBe(false);
  });
});

describe("Semáforo · casos adicionales y reglas", () => {
  for (const c of casos.extra) {
    it(`${c.id} → ${c.esperado}: ${c.texto}`, () => {
      expect(clasificar(c.entrada).color).toBe(c.esperado);
    });
  }
  it("un caso rojo nunca baja a verde aunque se borre la descripción", () => {
    for (const c of casos.casos.filter((x) => x.esperado === "rojo")) {
      expect(clasificar({ ...c.entrada, descripcion: "" }).color).toBe("rojo");
    }
  });
  it("devuelve razones legibles para el taller", () => {
    const r = clasificar(casos.casos[8].entrada);
    expect(r.razones.length).toBeGreaterThan(0);
  });
});

describe("Catálogo y reglas están sincronizados", () => {
  it("cada síntoma del catálogo tiene un nivel en las reglas", () => {
    const sinRegla = catalogo.sintomas.filter((s) => !(s.id in reglas.sintomas)).map((s) => s.id);
    expect(sinRegla).toEqual([]);
  });
  it("las reglas no tienen síntomas huérfanos", () => {
    const ids = new Set(catalogo.sintomas.map((s) => s.id));
    expect(Object.keys(reglas.sintomas).filter((k) => !ids.has(k))).toEqual([]);
  });
  it("el catálogo público no contiene colores", () => {
    const txt = JSON.stringify(catalogo.sintomas);
    expect(txt).not.toMatch(/"(rojo|amarillo|verde)"/);
  });
});
