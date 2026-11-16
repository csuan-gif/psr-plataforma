import { describe, expect, it } from "vitest";
import { completarFilas, filtrarBandeja, lunesDe, ordenarBandeja } from "../src/taller/util/bandeja";
import { llenarPlantilla, PLANTILLAS_BASE, revisarPlantilla } from "../src/taller/util/plantillas";
import { cupoFranja, db } from "../src/demo/apiDemo";
import { hoyBogota, sumarDias } from "../src/compartido/util/fechas";
import type { Color, SolicitudTaller } from "../src/taller/datos/tipos";

const sol = (id: string, color: Color, creadoEn: string, extra: Partial<SolicitudTaller> = {}): SolicitudTaller => ({
  id, codigo: "PSR-" + id, creadoEn, estado: "nueva", canal: "portal",
  cliente: { id: "c" + id, nombre: "Luisa Pardo", celular: "3104445566", numeroDocumento: "52987654" },
  vehiculo: { id: "v" + id, placa: "MNP456", marca: "Chevrolet", linea: "Onix", anio: 2021, color: null, km: null },
  zonas: [], sintomas: [], descripcion: "", movilidad: "si", desdeCuando: null, adjuntos: [], presupuesto: "previo", pruebaRuta: false,
  semaforo: { auto: color, final: color, razones: [], motivo: null }, cita: null, ...extra,
});

describe("Bandeja", () => {
  const l = [
    sol("1", "verde", "2026-11-15T10:00:00Z"),
    sol("2", "rojo", "2026-11-15T12:00:00Z"),
    sol("3", "amarillo", "2026-11-15T09:00:00Z"),
    sol("4", "rojo", "2026-11-15T08:00:00Z", { estado: "atendida" }),
  ];
  it("ordena rojo primero y, dentro del color, la que más lleva esperando", () => {
    expect(ordenarBandeja(l).map((s) => s.id)).toEqual(["4", "2", "3", "1"]);
  });
  it("filtra por color, estado y texto (placa, nombre, documento, código)", () => {
    const f = { color: "todos" as const, estado: "activas" as const, periodo: "todo" as const, texto: "" };
    expect(filtrarBandeja(l, f).map((s) => s.id)).toEqual(["1", "2", "3"]);
    expect(filtrarBandeja(l, { ...f, color: "rojo" }).map((s) => s.id)).toEqual(["2"]);
    expect(filtrarBandeja(l, { ...f, estado: "atendidas" }).map((s) => s.id)).toEqual(["4"]);
    expect(filtrarBandeja(l, { ...f, texto: "mnp-456" })).toHaveLength(3);
    expect(filtrarBandeja(l, { ...f, texto: "luisa" })).toHaveLength(3);
    expect(filtrarBandeja(l, { ...f, texto: "987654" })).toHaveLength(3);
    expect(filtrarBandeja(l, { ...f, texto: "zzz999" })).toHaveLength(0);
  });
  it("filtra por fecha en hora de Bogotá", () => {
    const f = { color: "todos" as const, estado: "todas" as const, periodo: "hoy" as const, texto: "" };
    const tarde = sol("5", "verde", "2026-11-16T03:00:00Z"); // 15 nov, 10 p. m. en Bogotá
    expect(filtrarBandeja([tarde], f, "2026-11-15")).toHaveLength(1);
    expect(filtrarBandeja([tarde], f, "2026-11-16")).toHaveLength(0);
  });
});

describe("Plantillas de WhatsApp", () => {
  it("llena los datos y usa el primer nombre", () => {
    const t = llenarPlantilla(PLANTILLAS_BASE.confirmar, { nombre: "Andrés Camacho (ficticio)", codigo: "PSR-ABC234", placa: "JKL123", vehiculo: "Renault Sandero", fecha: "2026-11-17", franja: "tarde" });
    expect(t).toContain("Hola Andrés,");
    expect(t).toContain("martes 17 de noviembre");
    expect(t).toContain("tarde (1:00 p. m. – 5:00 p. m.)");
    expect(t).not.toMatch(/\{\w+\}/);
  });
  it("las plantillas sugeridas no prometen precios ni tiempos", () => {
    for (const t of Object.values(PLANTILLAS_BASE)) expect(revisarPlantilla(t)).toBeNull();
  });
  it("detecta precios y tiempos de reparación", () => {
    expect(revisarPlantilla("El cambio de aceite cuesta $120.000")).toMatch(/precio/);
    expect(revisarPlantilla("Queda listo en 2 horas")).toMatch(/tiempo/);
    expect(revisarPlantilla("Estará listo mañana")).toMatch(/tiempo/);
    expect(revisarPlantilla("Te esperamos en la franja de la mañana")).toBeNull();
  });
});

describe("Agenda", () => {
  it("la semana empieza el lunes", () => {
    expect(lunesDe("2026-11-15")).toBe("2026-11-09"); // domingo → lunes anterior
    expect(lunesDe("2026-11-17")).toBe("2026-11-16");
  });
  it("completa las 14 franjas de la semana", () => {
    const f = completarFilas([{ diaSemana: 1, franja: "manana", horaInicio: "08:00", horaFin: "12:00", cupos: 4, activo: true }]);
    expect(f).toHaveLength(14);
    expect(f[0]).toMatchObject({ diaSemana: 1, franja: "manana", cupos: 4 });
    expect(f.filter((x) => x.activo)).toHaveLength(1);
  });
  it("cupos de la demo: festivo, cierre, lleno y exclusión al mover", () => {
    const b = db.reiniciar();
    const hoy = hoyBogota();
    expect(cupoFranja(b, "2026-12-08", "manana").motivo).toMatch(/^Festivo/);
    expect(cupoFranja(b, sumarDias(hoy, 9), "tarde").motivo).toMatch(/^Cerrado/);
    const lleno = cupoFranja(b, sumarDias(hoy, 2), "manana");
    if (!lleno.motivo && lleno.cupos === 3) {
      expect(lleno.usados).toBe(3);
      expect(lleno.libre).toBe(false);
      const una = b.citas.find((c) => c.fecha === sumarDias(hoy, 2))!;
      expect(cupoFranja(b, sumarDias(hoy, 2), "manana", una.id).libre).toBe(true); // moverla dentro de su misma franja
    }
  });
});
