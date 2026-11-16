import { describe, expect, it } from "vitest";
import { datosRequeridos, nombreCombustible, revisarTransicion, type OrdenParaReglas } from "../src/taller/util/reglasOrden";
import { db } from "../src/demo/apiDemo";
import { cambiarEstadoDemo, crearRecepcionDemo, enviarPresupuestoDemo, ordenDeSolicitud, pasosOrden, responderPresupuestoDemo } from "../src/demo/ordenesDemo";
import type { FotoActa } from "../src/taller/datos/tipos";

const hoy = "2026-11-15";
const base: OrdenParaReglas = { estado: "en_diagnostico", presupuestoEstado: "pendiente", autorizaPresupuestoPrevio: true, autorizaPruebaRuta: false, kmIngreso: 50000, trabajos: [] };
const op = { esAdmin: false, hoy };

describe("Reglas de la orden de trabajo", () => {
  it("con presupuesto previo no se repara sin aprobación", () => {
    expect(revisarTransicion(base, "en_reparacion", {}, op)?.codigo).toBe("PRESUPUESTO_NO_APROBADO");
    expect(revisarTransicion({ ...base, presupuestoEstado: "aprobado" }, "en_reparacion", {}, op)).toBeNull();
    expect(revisarTransicion({ ...base, autorizaPresupuestoPrevio: false, presupuestoEstado: "no_requerido" }, "en_reparacion", {}, op)).toBeNull();
  });
  it("si el cliente rechazó, se puede pasar a listo para devolverlo sin reparar", () => {
    expect(revisarTransicion({ ...base, presupuestoEstado: "rechazado" }, "listo", {}, op)).toBeNull();
    expect(revisarTransicion({ ...base, presupuestoEstado: "rechazado" }, "en_reparacion", {}, op)?.codigo).toBe("PRESUPUESTO_NO_APROBADO");
    expect(revisarTransicion(base, "listo", {}, op)?.codigo).toBe("PRESUPUESTO_NO_APROBADO");
  });
  it("sin autorización de ruta, la prueba exige registrar cómo se probó o la nueva autorización", () => {
    const o = { ...base, presupuestoEstado: "aprobado" as const };
    expect(datosRequeridos(o, "en_prueba")).toBe("prueba");
    expect(revisarTransicion(o, "en_prueba", {}, op)?.codigo).toBe("PRUEBA_RUTA_NO_AUTORIZADA");
    expect(revisarTransicion(o, "en_prueba", { pruebaSinConducir: "en elevador" }, op)).toBeNull();
    expect(revisarTransicion(o, "en_prueba", { autorizacionNueva: "por WhatsApp" }, op)).toBeNull();
    expect(datosRequeridos({ ...o, autorizaPruebaRuta: true }, "en_prueba")).toBeNull();
  });
  it("la entrega exige km de salida ≥ ingreso, trabajos y garantía vigente", () => {
    const o = { ...base, estado: "listo" as const, presupuestoEstado: "aprobado" as const, trabajos: [{ descripcion: "Pastillas", tipo: "correctivo" as const }] };
    expect(revisarTransicion(o, "entregado", { kmSalida: 49000, garantiaHasta: "2027-02-01" }, op)?.codigo).toBe("DATOS_ENTREGA");
    expect(revisarTransicion(o, "entregado", { kmSalida: 50010, garantiaHasta: "2026-01-01" }, op)?.codigo).toBe("DATOS_ENTREGA");
    expect(revisarTransicion({ ...o, trabajos: [] }, "entregado", { kmSalida: 50010, garantiaHasta: "2027-02-01" }, op)?.codigo).toBe("DATOS_ENTREGA");
    expect(revisarTransicion(o, "entregado", { kmSalida: 50010, garantiaHasta: "2027-02-01" }, op)?.codigo).toBe("DATOS_ENTREGA"); // falta el combustible
    expect(revisarTransicion(o, "entregado", { kmSalida: 50010, nivelCombustibleSalida: 0.3, garantiaHasta: "2027-02-01" }, op)?.codigo).toBe("DATOS_ENTREGA"); // no es 1/8
    expect(revisarTransicion(o, "entregado", { kmSalida: 50010, nivelCombustibleSalida: 0.625, garantiaHasta: "2027-02-01" }, op)).toBeNull();
  });
  it("una orden cerrada solo la reabre el administrador", () => {
    const o = { ...base, estado: "entregado" as const, presupuestoEstado: "aprobado" as const };
    expect(revisarTransicion(o, "listo", {}, op)?.codigo).toBe("ORDEN_CERRADA");
    expect(revisarTransicion(o, "listo", {}, { ...op, esAdmin: true })).toBeNull();
  });
  it("nombres del medidor de combustible", () => {
    expect([0, 0.25, 0.375, 0.5, 1].map(nombreCombustible)).toEqual(["Vacío", "1/4", "3/8", "1/2", "Lleno"]);
  });
});

describe("Flujo demo: acta → presupuesto → aprobación del cliente → entrega → recordatorio", () => {
  const fotos: FotoActa[] = ["frente", "lateral_izq", "lateral_der", "tablero"].map((t) => ({ tipo: t as FotoActa["tipo"], ruta: `actas/t/${t}.jpg` }));
  it("recorre todo el ciclo con las reglas", () => {
    const b = db.reiniciar();
    const s = b.solicitudes.find((x) => x.codigo === "PSR-DEMO09")!; // pedal blando, TUV234
    const acta = { solicitudId: s.id, vehiculoId: s.vehiculoId, kmIngreso: 54300, nivelCombustible: 0.375, checklist: {}, mapaDanos: [], objetosPersonales: "", accesorios: "",
      fotos, videoInspeccion: null, autorizaPresupuestoPrevio: true, autorizaPruebaRuta: false, observaciones: "", firmaCliente: "actas/t/firma.png", firmadoPor: "Diana Torres", recibidoPor: "u-javier" };
    expect(() => crearRecepcionDemo(b, { ...acta, fotos: fotos.slice(0, 2) }, { vehiculo: {}, cliente: {} })).toThrow(/Faltan fotos/);
    const r = crearRecepcionDemo(b, acta, { vehiculo: { vin: "9FBHSRAJ5JM123456" }, cliente: {} });
    expect(() => crearRecepcionDemo(b, acta, { vehiculo: {}, cliente: {} })).toThrow(/orden abierta/);
    expect(b.solicitudes.find((x) => x.id === s.id)!.estado).toBe("convertida");
    const u = { id: "u-mecanico", esAdmin: false };
    cambiarEstadoDemo(b, r.ordenId, "en_diagnostico", {}, u);
    expect(() => cambiarEstadoDemo(b, r.ordenId, "en_reparacion", {}, u)).toThrow(/presupuesto previo/);
    enviarPresupuestoDemo(b, r.ordenId, 280000, [{ descripcion: "Cambio de pastillas", tipo: "correctivo" }, { descripcion: "Líquido de frenos", tipo: "preventivo", planId: 8 }], u.id);
    let pasos = pasosOrden(b, ordenDeSolicitud(b, s.id));
    expect(pasos.find((p) => p.clave === "esperando_aprobacion")!.hecho).toBe(true);
    expect(responderPresupuestoDemo(b, r.ordenId, "aprobado", "cliente_portal", null)).toBe(true);
    expect(responderPresupuestoDemo(b, r.ordenId, "rechazado", "cliente_portal", null)).toBe(false); // ya respondió
    cambiarEstadoDemo(b, r.ordenId, "en_reparacion", {}, u);
    expect(() => cambiarEstadoDemo(b, r.ordenId, "en_prueba", {}, u)).toThrow(/NO autorizó/);
    cambiarEstadoDemo(b, r.ordenId, "en_prueba", { pruebaSinConducir: "Prueba estática en elevador" }, u);
    cambiarEstadoDemo(b, r.ordenId, "listo", {}, u);
    cambiarEstadoDemo(b, r.ordenId, "entregado", { kmSalida: 54312, nivelCombustibleSalida: 0.5, garantiaHasta: "2099-01-01" }, u);
    pasos = pasosOrden(b, ordenDeSolicitud(b, s.id));
    expect(pasos.every((p) => p.hecho)).toBe(true);
    const rec = b.recordatorios.filter((x) => x.vehiculoId === s.vehiculoId && x.estado === "pendiente" && x.servicio === "Cambio de líquido de frenos");
    expect(rec).toHaveLength(1);
    expect(rec[0].kmEstimado).toBe(54312 + 40000);
    expect(b.historial.some((h) => h.ordenId === r.ordenId && h.nota?.startsWith("Prueba sin conducir"))).toBe(true);
    expect(() => cambiarEstadoDemo(b, r.ordenId, "listo", {}, u)).toThrow(/cerrada/);
  });
});
