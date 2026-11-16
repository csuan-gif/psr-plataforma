import { describe, expect, it } from "vitest";
import { festivosColombia, pascua } from "../src/compartido/util/festivos";
import { avisoPlaca, avisoVin, digitoVerificacionNit, avisoDocumento, avisoCelular } from "../src/compartido/util/validaciones";
import { requiereAvisoSeguridad, generarIcs } from "../src/compartido/util/mensajes";

describe("Festivos de Colombia", () => {
  it("Pascua 2026 y 2027", () => {
    expect(pascua(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(pascua(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
  });
  it("2026 tiene los 18 festivos esperados", () => {
    expect(festivosColombia(2026).map((f) => f.fecha)).toEqual([
      "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
      "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07",
      "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    ]);
  });
  it("2027: Reyes pasa al lunes 11 de enero y Viernes Santo es el 26 de marzo", () => {
    const f = festivosColombia(2027).map((x) => x.fecha);
    expect(f).toContain("2027-01-11");
    expect(f).toContain("2027-03-26");
    expect(f).toHaveLength(18);
  });
});

describe("Validaciones con advertencia", () => {
  it("placa", () => {
    expect(avisoPlaca("abc-123")).toBeNull();
    expect(avisoPlaca("ABC12D")).toMatch(/moto/);
    expect(avisoPlaca("XX")).toMatch(/formato/);
  });
  it("VIN", () => {
    expect(avisoVin("9FBHSRAJ5JM123456")).toBeNull();
    expect(avisoVin("9FBHSRAJ5JM12345")).toMatch(/17/);
    expect(avisoVin("9FBHSRAJ5JM12345O")).toMatch(/I, O ni Q/);
  });
  it("dígito de verificación del NIT", () => {
    expect(digitoVerificacionNit("900373913")).toBe(4);
    expect(digitoVerificacionNit("860002964")).toBe(4);
    expect(avisoDocumento("NIT", "900373913", "5")).toMatch(/debería ser 4/);
    expect(avisoDocumento("NIT", "900373913", "4")).toBeNull();
  });
  it("celular", () => {
    expect(avisoCelular("300 123 4567")).toBeNull();
    expect(avisoCelular("6011234567")).not.toBeNull();
  });
});

describe("Aviso de seguridad (sin semáforo)", () => {
  it("aparece si no puede movilizarse o hay frenos/dirección", () => {
    expect(requiereAvisoSeguridad({ movilidad: "no", zonas: ["carroceria"], sintomas: [] })).toBe(true);
    expect(requiereAvisoSeguridad({ movilidad: "si", zonas: ["frenos"], sintomas: [] })).toBe(true);
    expect(requiereAvisoSeguridad({ movilidad: "si", zonas: ["nose"], sintomas: ["nose.frenos_direccion"] })).toBe(true);
    expect(requiereAvisoSeguridad({ movilidad: "si", zonas: ["carroceria"], sintomas: ["carroceria.rayon"] })).toBe(false);
  });
});

describe("Archivo de calendario", () => {
  it("dice que la cita está pendiente de confirmación", () => {
    const ics = generarIcs("PSR-7K3Q9M", "2026-11-20", "manana");
    expect(ics).toContain("DTSTART;TZID=America/Bogota:20261120T073000");
    expect(ics).toContain("PENDIENTE de confirmación");
  });
});

import casosJson from "./casos.json";
import { CASOS_PRUEBA } from "../src/cliente/casosPrueba";
describe("Modo prueba", () => {
  it("usa los mismos casos del informe, sin colores", () => {
    expect(CASOS_PRUEBA.map((c) => [c.id, c.texto])).toEqual(casosJson.casos.map((c) => [c.id, c.texto]));
    expect(JSON.stringify(CASOS_PRUEBA)).not.toMatch(/rojo|amarillo|verde/);
  });
});
