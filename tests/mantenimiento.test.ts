import { describe, expect, it } from "vitest";
import { cuandoTexto, fechaObjetivo, fechaPorKm, kmHoy, kmPorDia } from "../src/compartido/util/mantenimiento";
import { aFechaIso, aFilas, celdaCsv, leerCsv, proponerMapeo } from "../src/taller/clientes/hojas";
import { buscarClientes } from "../src/taller/clientes/buscar";
import { mensajeRecordatorio } from "../src/taller/util/mensajesMantenimiento";
import { revisarPlantilla } from "../src/taller/util/plantillas";
import { db } from "../src/demo/apiDemo";
import { anonimizarDemo, importarDemo, indicadorDemo, marcarRecordatorioDemo, recordatoriosProximos, sincronizarVencimientos } from "../src/demo/mantenimientoDemo";
import { hoyBogota, sumarDias } from "../src/compartido/util/fechas";
import type { RecordatorioTaller } from "../src/taller/datos/tipos";

describe("Estimación por kilometraje", () => {
  it("km/día con 2+ lecturas separadas 14 días o más", () => {
    expect(kmPorDia([{ km: 48000, fecha: "2026-09-16" }, { km: 54215, fecha: "2026-11-15" }])).toBeCloseTo(103.6, 1);
    expect(kmPorDia([{ km: 48000, fecha: "2026-11-10" }, { km: 48500, fecha: "2026-11-15" }])).toBeNull(); // muy poco tiempo
    expect(kmPorDia([{ km: 48000, fecha: "2026-11-10" }])).toBeNull();
    expect(kmPorDia([{ km: 60000, fecha: "2026-01-01" }, { km: 50000, fecha: "2026-06-01" }])).toBeNull(); // tablero cambiado
  });
  it("gana lo que llegue primero: fecha por meses o fecha por km", () => {
    const porKm = fechaPorKm(94215, { km: 54215, fecha: "2026-11-15" }, 103.6);
    expect(porKm).toBe(sumarDias("2026-11-15", 387));
    expect(fechaObjetivo("2028-11-15", porKm)).toBe(porKm);
    expect(fechaObjetivo("2027-01-01", porKm)).toBe("2027-01-01");
    expect(fechaObjetivo(null, null)).toBeNull();
    expect(kmHoy({ km: 50000, fecha: "2026-11-05" }, 100, "2026-11-15")).toBe(51000);
  });
  it("texto de cuándo", () => {
    expect(cuandoTexto("2026-11-15", "2026-11-15")).toBe("hoy");
    expect(cuandoTexto("2026-11-27", "2026-11-15")).toBe("en 12 días");
    expect(cuandoTexto("2026-11-12", "2026-11-15")).toBe("hace 3 días");
  });
});

describe("Importar y exportar hojas", () => {
  it("lee CSV con ; y comillas", () => {
    expect(leerCsv('﻿Cédula;Nombre;Placa\r\n80123456;"Camacho; Andrés";JKL123\r\n\r\n')).toEqual([["Cédula", "Nombre", "Placa"], ["80123456", "Camacho; Andrés", "JKL123"]]);
    expect(leerCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("propone el mapeo por los títulos del Excel del taller", () => {
    const m = proponerMapeo(["Cédula", "Nombre cliente", "Teléfono", "PLACA", "Vehículo", "Kilometraje", "Fecha", "Servicio", "SOAT"]);
    expect(m).toMatchObject({ numeroDocumento: 0, nombre: 1, celular: 2, placa: 3, linea: 4, km: 5, fechaUltimoServicio: 6, ultimoServicio: 7, fechaSoat: 8 });
  });
  it("convierte fechas de Excel y del formato colombiano", () => {
    expect(aFechaIso("15/03/2026")).toBe("2026-03-15");
    expect(aFechaIso("2026-3-5")).toBe("2026-03-05");
    expect(aFechaIso(new Date(Date.UTC(2026, 0, 31)))).toBe("2026-01-31");
    expect(aFechaIso("ayer")).toBeUndefined();
    expect(aFilas([["Cédula", "Fecha"], ["123456", "01/09/2026"], ["", ""]], { numeroDocumento: 0, fechaUltimoServicio: 1 })).toEqual([{ numeroDocumento: "123456", fechaUltimoServicio: "2026-09-01" }]);
  });
  it("el CSV exportado no ejecuta fórmulas escritas en el portal", () => {
    expect(celdaCsv('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(celdaCsv("+57 300")).toBe("'+57 300");
    expect(celdaCsv("Andrés")).toBe("Andrés");
  });
});

describe("Recordatorios (demo, mismas reglas que SQL)", () => {
  it("lista lo próximo, el SOAT 30 días antes y calcula por km", () => {
    const b = db.reiniciar();
    const l = recordatoriosProximos(b, 14);
    expect(l.find((r) => r.vehiculo.placa === "QRS789")?.servicio).toMatch(/aceite/);
    expect(l.some((r) => r.tipo === "soat" && r.vehiculo.placa === "JKL123")).toBe(true);
    expect(l.some((r) => r.vehiculo.placa === "TUV234")).toBe(false); // alineación en 40 días
    expect(l.find((r) => r.vehiculo.placa === "QRS789")!.kmDia).toBeGreaterThan(0);
  });
  it("un solo recordatorio vivo de SOAT al cambiar la fecha", () => {
    const b = db.reiniciar();
    const v = b.vehiculos.find((x) => x.placa === "JKL123")!;
    v.fechaSoat = sumarDias(hoyBogota(), 200); sincronizarVencimientos(b, v);
    expect(b.recordatorios.filter((r) => r.vehiculoId === v.id && r.tipo === "soat" && r.estado === "pendiente")).toHaveLength(1);
  });
  it("conversión: enviados vs agendados", () => {
    const b = db.reiniciar();
    const [a, c] = recordatoriosProximos(b, 30);
    marcarRecordatorioDemo(b, a.id, "enviado"); marcarRecordatorioDemo(b, c.id, "enviado"); marcarRecordatorioDemo(b, c.id, "agendado");
    expect(indicadorDemo(b, 90)).toMatchObject({ enviados: 2, agendados: 1, conversion: 0.5 });
  });
  it("el mensaje es cálido, trae el enlace y no promete precios ni tiempos", () => {
    const r = recordatoriosProximos(db.reiniciar(), 14).find((x) => x.vehiculo.placa === "QRS789")! as RecordatorioTaller;
    const m = mensajeRecordatorio(r, "https://psr.ejemplo", hoyBogota());
    expect(m).toContain(`https://psr.ejemplo/solicitar?r=${r.token}`);
    expect(m).toMatch(/^Hola Carlos,/);
    expect(m).toContain("respóndenos NO");
    expect(revisarPlantilla(m)).toBeNull();
    expect(m).not.toContain("/privacidad");
    expect(mensajeRecordatorio({ ...r, cliente: { ...r.cliente, autorizaDatos: false } }, "https://psr.ejemplo")).toContain("https://psr.ejemplo/privacidad");
  });
});

describe("Clientes (demo)", () => {
  it("importa sin sobrescribir y marca sin autorización", () => {
    const b = db.reiniciar();
    const r = importarDemo(b, [
      { numeroDocumento: "1.111.222.333", nombre: "Pedro Importado", celular: "300 999 8877", placa: "imp-001", marca: "Chevrolet", km: "85.000", fechaUltimoServicio: "2026-09-01", ultimoServicio: "aceite y filtro (aceite mineral)" },
      { tipoDocumento: "CC", numeroDocumento: "80123456", nombre: "Otro nombre", placa: "JKL123", km: "90000" },
      { tipoDocumento: "XX", numeroDocumento: "123", nombre: "Malo" },
    ]);
    expect(r).toMatchObject({ clientesNuevos: 1, clientesActualizados: 1, vehiculosNuevos: 1, recordatorios: 1 });
    expect(r.errores.map((e) => e.fila)).toEqual([3]);
    expect(b.clientes.find((c) => c.numeroDocumento === "80123456")!.nombre).toBe("Andrés Camacho (ficticio)");
    expect(b.clientes.find((c) => c.numeroDocumento === "1111222333")!.autorizaDatos).toBe(false);
    expect(b.recordatorios.find((x) => x.servicio.includes("mineral"))).toMatchObject({ fechaEstimada: "2027-03-01", kmEstimado: 90000 });
  });
  it("busca por nombre, documento, celular o placa", () => {
    const l = [{ id: "1", nombre: "Andrés Camacho", tipoDocumento: "CC", numeroDocumento: "80123456", celular: "3001112233", correo: null, origen: "portal" as const, autorizaDatos: true, anonimizado: false, placas: ["JKL123"], creadoEn: "" }];
    for (const q of ["andres", "3456", "1112233", "jkl-1", "JKL123"]) expect(buscarClientes(l, q)).toHaveLength(1);
    expect(buscarClientes(l, "zzz")).toHaveLength(0);
  });
  it("la supresión borra los datos personales y conserva el historial", () => {
    const b = db.reiniciar();
    const c = b.clientes.find((x) => x.numeroDocumento === "80123456")!;
    const ordenes = b.ordenes.length;
    anonimizarDemo(b, c.id);
    expect(c).toMatchObject({ nombre: "Cliente anonimizado", celular: "" });
    expect(c.numeroDocumento).not.toContain("80123456");
    expect(b.ordenes).toHaveLength(ordenes);
    expect(b.recordatorios.filter((r) => b.vehiculos.find((v) => v.id === r.vehiculoId)?.clienteId === c.id && r.estado === "pendiente")).toHaveLength(0);
  });
});
