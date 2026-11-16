/** Genera el PDF del acta de ingreso en el navegador (jsPDF, cargado solo al usarlo). */
import type { Acta } from "../datos/tipos";
import { apiTaller } from "../datos/api";
import { TALLER } from "../../compartido/config";
import { aDataUrl } from "../../compartido/util/imagen";
import { nombreCombustible } from "../util/reglasOrden";
import { PANELES, TIPOS_DANO } from "./MapaDanos";
import { CHECKLIST, FOTOS_OBLIGATORIAS } from "./Recepcion";

const COMBUSTIBLE: Record<string, string> = { gasolina: "Gasolina", diesel: "Diésel", gas: "Gas (GNV)", hibrido: "Híbrido", electrico: "Eléctrico" };

async function imagen(ruta: string | null | undefined) {
  if (!ruta) return null;
  const url = await apiTaller.urlArchivo(ruta).catch(() => null);
  return url ? aDataUrl(url) : null;
}

export async function generarPdfActa(a: Acta): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const M = 15, ANCHO = 216 - 2 * M, ALTO = 279;
  let y = M;
  const nuevaPagina = (alto: number) => { if (y + alto > ALTO - 18) { doc.addPage(); y = M; } };
  const titulo = (t: string) => { nuevaPagina(12); y += 3; doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(150, 18, 31).text(t.toUpperCase(), M, y); doc.setDrawColor(200).line(M, y + 1.5, M + ANCHO, y + 1.5); y += 6; doc.setTextColor(20); };
  const fila = (k: string, v: string, x = M, ancho = ANCHO) => {
    const lineas = doc.setFont("helvetica", "normal").setFontSize(9.5).splitTextToSize(v || "—", ancho - 38);
    nuevaPagina(lineas.length * 4.5);
    doc.setFont("helvetica", "bold").text(k, x, y); doc.setFont("helvetica", "normal").text(lineas, x + 38, y);
    return lineas.length * 4.5;
  };
  const dosColumnas = (izq: [string, string][], der: [string, string][]) => {
    const n = Math.max(izq.length, der.length);
    for (let i = 0; i < n; i++) {
      const h1 = izq[i] ? fila(izq[i][0], izq[i][1], M, ANCHO / 2) : 0;
      const h2 = der[i] ? fila(der[i][0], der[i][1], M + ANCHO / 2, ANCHO / 2) : 0;
      y += Math.max(h1, h2, 4.5);
    }
  };
  const fecha = new Date(a.fechaHora).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

  // Encabezado
  doc.setFillColor(179, 18, 31).rect(0, 0, 216, 24, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(15).text(TALLER.nombre, M, 11);
  doc.setFontSize(10).setFont("helvetica", "normal").text(`${TALLER.direccion} · ${TALLER.telefono}`, M, 17);
  doc.setFont("helvetica", "bold").setFontSize(12).text("ACTA DE INGRESO DE VEHÍCULO", 216 - M, 11, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).text(fecha, 216 - M, 17, { align: "right" });
  y = 31; doc.setTextColor(20);
  doc.setFontSize(9).text(`Acta N.º ${a.id.slice(0, 8).toUpperCase()}${a.codigo ? ` · Código de seguimiento ${a.codigo}` : ""}`, M, y); y += 4;

  titulo("Cliente y vehículo");
  dosColumnas(
    [["Cliente", a.cliente.nombre], ["Documento", `${a.cliente.tipoDocumento} ${a.cliente.numeroDocumento}`], ["Celular", a.cliente.celular], ["Correo", a.cliente.correo ?? ""], ["Dirección", a.cliente.direccion ?? ""]],
    [["Placa", a.vehiculo.placa], ["Vehículo", [a.vehiculo.marca, a.vehiculo.linea, a.vehiculo.anio].filter(Boolean).join(" ")], ["Color", a.vehiculo.color ?? ""], ["VIN", a.vehiculo.vin ?? ""], ["Combustible", COMBUSTIBLE[a.vehiculo.combustible ?? ""] ?? ""]],
  );

  titulo("Estado al ingreso");
  dosColumnas([["Kilometraje", `${a.kmIngreso.toLocaleString("es-CO")} km`]], [["Combustible", `${nombreCombustible(a.nivelCombustible)} del tanque`]]);
  y += 1;
  doc.setFont("helvetica", "bold").setFontSize(9.5).text("Daños de carrocería:", M, y); y += 4.5;
  if (!a.mapaDanos.length) { doc.setFont("helvetica", "normal").text("Sin daños marcados.", M + 4, y); y += 4.5; }
  for (const d of a.mapaDanos) {
    const t = doc.setFont("helvetica", "normal").splitTextToSize(`• ${TIPOS_DANO[d.tipo].nombre} en ${PANELES[d.zona] ?? d.zona}${d.nota ? `: ${d.nota}` : ""}`, ANCHO - 4);
    nuevaPagina(t.length * 4.5); doc.text(t, M + 4, y); y += t.length * 4.5;
  }

  titulo("Inspección");
  const items = CHECKLIST.map(([k, n]) => {
    const it = a.checklist[k];
    return [n, !it ? "Sin revisar" : it.estado === "bien" ? "Bien" : it.estado === "na" ? "No aplica" : `Novedad${it.nota ? ": " + it.nota : ""}`] as [string, string];
  });
  const mitad = Math.ceil(items.length / 2);
  doc.setFontSize(9);
  for (let i = 0; i < mitad; i++) {
    nuevaPagina(4.5);
    for (const [j, x] of [[i, M], [i + mitad, M + ANCHO / 2]] as const) {
      const it = items[j]; if (!it) continue;
      doc.setFont("helvetica", "normal").setTextColor(it[1].startsWith("Novedad") ? 160 : 20, it[1].startsWith("Novedad") ? 90 : 20, 20)
        .text(`${it[0]}: ${it[1]}`.slice(0, 60), x, y);
    }
    doc.setTextColor(20); y += 4.5;
  }

  titulo("Objetos, accesorios y observaciones");
  y += fila("Objetos", a.objetosPersonales); y += fila("Accesorios", a.accesorios); y += fila("Observaciones", a.observaciones);

  titulo("Autorizaciones del cliente");
  y += fila("Presupuesto", a.autorizaPresupuestoPrevio ? "Solicita presupuesto previo: no se repara hasta su aprobación." : "Autoriza realizar la reparación sin presupuesto previo.");
  y += fila("Prueba de ruta", a.autorizaPruebaRuta ? "Autoriza al taller a conducir el vehículo para efectos de prueba." : "NO autoriza conducir el vehículo.");

  // Fotos
  titulo("Registro fotográfico");
  const fotos = [...FOTOS_OBLIGATORIAS.map(([t, n]) => ({ n, f: a.fotos.find((x) => x.tipo === t) })), ...a.fotos.filter((x) => x.tipo === "dano" || x.tipo === "extra").map((f, i) => ({ n: f.tipo === "dano" ? `Daño: ${PANELES[f.nota ?? ""] ?? ""}` : `Extra ${i + 1}`, f }))];
  const anchoFoto = (ANCHO - 9) / 4, altoFoto = anchoFoto * 0.75;
  for (let i = 0; i < fotos.length; i += 4) {
    nuevaPagina(altoFoto + 8);
    const fila4 = await Promise.all(fotos.slice(i, i + 4).map(async (x) => ({ ...x, img: await imagen(x.f?.ruta) })));
    fila4.forEach((x, j) => {
      const fx = M + j * (anchoFoto + 3);
      if (x.img) { try { doc.addImage(x.img, fx, y, anchoFoto, altoFoto, undefined, "FAST"); } catch { doc.rect(fx, y, anchoFoto, altoFoto); } }
      else { doc.setDrawColor(180).rect(fx, y, anchoFoto, altoFoto); doc.setFontSize(7).text("(imagen no disponible)", fx + 2, y + altoFoto / 2); }
      doc.setFontSize(7.5).text(x.n.slice(0, 32), fx, y + altoFoto + 3.5);
    });
    y += altoFoto + 7;
  }
  if (a.videoInspeccion) { y += fila("Video 360°", "Guardado en el sistema del taller."); }

  // Firma
  nuevaPagina(45);
  titulo("Conformidad");
  const textoConf = doc.setFont("helvetica", "normal").setFontSize(9).splitTextToSize("Con mi firma acepto que el vehículo se recibe en el estado descrito en esta acta (kilometraje, combustible, daños, objetos y accesorios) y las autorizaciones marcadas. El taller no diagnostica ni promete precios ni tiempos de reparación en este documento.", ANCHO);
  doc.text(textoConf, M, y); y += textoConf.length * 4 + 2;
  const firma = await imagen(a.firmaCliente);
  if (firma) doc.addImage(firma, "PNG", M, y, 70, 26);
  doc.line(M, y + 27, M + 75, y + 27); doc.line(M + 100, y + 27, M + ANCHO, y + 27);
  doc.setFontSize(9).text(`Firma de quien entrega: ${a.firmadoPor}`, M, y + 31);
  doc.text(`Recibe por el taller: ${a.recibidoPor ?? ""}`, M + 100, y + 31);

  // Pie en todas las páginas
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i).setFontSize(7.5).setTextColor(110)
      .text(`Datos personales tratados según la Ley 1581 de 2012 y el aviso de privacidad del taller. Página ${i} de ${n}.`, 108, ALTO - 8, { align: "center" });
  }
  return doc.output("blob");
}
