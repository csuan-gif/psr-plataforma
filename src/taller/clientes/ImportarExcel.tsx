import { useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type FilaImportacion, type ResultadoImportacion } from "../datos/tipos";
import { Dialogo } from "../ui";
import { aFilas, CAMPOS, leerArchivo, proponerMapeo, type Celda } from "./hojas";
import { Boton } from "../../compartido/ui/base";

/** Asistente: 1) elegir el archivo, 2) decir qué columna es cada dato, 3) importar y ver el resultado. */
export default function ImportarExcel({ abierto, onCerrar, onListo }: { abierto: boolean; onCerrar: () => void; onListo: () => void }) {
  const [datos, setDatos] = useState<Celda[][] | null>(null);
  const [nombre, setNombre] = useState("");
  const [mapeo, setMapeo] = useState<Partial<Record<keyof FilaImportacion, number>>>({});
  const [res, setRes] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const reiniciar = () => { setDatos(null); setRes(null); setError(""); setMapeo({}); setNombre(""); };
  async function elegir(f?: File) {
    if (!f) return;
    setError(""); setOcupado(true);
    try {
      const d = await leerArchivo(f);
      if (d.length < 2) throw new Error("El archivo no tiene filas de datos.");
      setDatos(d); setNombre(f.name); setMapeo(proponerMapeo(d[0].map((h) => String(h ?? ""))));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el archivo. Guárdalo como .xlsx o .csv e intenta de nuevo."); }
    finally { setOcupado(false); }
  }
  const filas = datos ? aFilas(datos, mapeo) : [];
  const faltan = CAMPOS.filter((c) => c.obligatorio && mapeo[c.id] === undefined);

  async function importar() {
    setOcupado(true); setError("");
    try { setRes(await apiTaller.importarClientes(filas)); onListo(); }
    catch (e) { setError(e instanceof ErrorTaller ? e.message : "No se pudo importar."); }
    finally { setOcupado(false); }
  }

  return (
    <Dialogo titulo="Importar clientes desde Excel" abierto={abierto} onCerrar={() => { reiniciar(); onCerrar(); }} ancho="max-w-3xl">
      {!datos && (
        <>
          <p className="mb-3">Sube la base de clientes que tienes en Excel (.xlsx) o en .csv. La primera fila debe tener los títulos de las columnas.</p>
          <ul className="mb-3 list-disc pl-5 text-sm text-suave">
            <li>No se borra ni se sobrescribe nada: si el cliente o la placa ya existen, solo se completan los datos vacíos.</li>
            <li>Los clientes importados quedan marcados <strong>«sin autorización de datos registrada»</strong> hasta que la den (Ley 1581). Así lo verás en los recordatorios.</li>
            <li>Si incluyes la fecha y el nombre del último servicio, se programa el próximo mantenimiento.</li>
          </ul>
          <label className="flex min-h-16 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-borde font-bold hover:border-marca">
            {ocupado ? "Leyendo…" : "📄 Elegir archivo .xlsx o .csv"}
            <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
          </label>
        </>
      )}

      {datos && !res && (
        <>
          <p className="mb-3"><strong>{nombre}</strong>: {datos.length - 1} filas. Revisa qué columna corresponde a cada dato (lo propusimos según los títulos).</p>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <label key={c.id} className="grid grid-cols-[1fr_1.2fr] items-center gap-2 text-sm">
                <span className="font-bold">{c.nombre}{c.obligatorio && " *"}</span>
                <select className="campo !min-h-10 !py-1" value={mapeo[c.id] ?? ""} onChange={(e) => setMapeo({ ...mapeo, [c.id]: e.target.value === "" ? undefined : Number(e.target.value) })}>
                  <option value="">— No importar —</option>
                  {datos[0].map((h, i) => <option key={i} value={i}>{String(h ?? `Columna ${i + 1}`)}</option>)}
                </select>
              </label>
            ))}
          </div>
          {faltan.length > 0 && <p className="mb-2 rounded-lg bg-aviso-fondo px-3 py-2 text-aviso">Falta elegir: {faltan.map((c) => c.nombre).join(", ")}.</p>}
          <p className="mb-1 font-bold">Vista previa (primeras 5 filas)</p>
          <div className="mb-3 max-h-56 overflow-auto rounded-xl border border-borde">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-superficie"><tr>{CAMPOS.filter((c) => mapeo[c.id] !== undefined).map((c) => <th key={c.id} className="p-1 text-left">{c.nombre}</th>)}</tr></thead>
              <tbody>{filas.slice(0, 5).map((f, i) => <tr key={i} className="border-t border-borde">{CAMPOS.filter((c) => mapeo[c.id] !== undefined).map((c) => <td key={c.id} className="p-1">{f[c.id] ?? ""}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {error && <p role="alert" className="mb-2 text-marca">⚠ {error}</p>}
          <div className="flex flex-wrap gap-2">
            <Boton disabled={!!faltan.length || ocupado || !filas.length} onClick={importar}>{ocupado ? "Importando…" : `Importar ${filas.length} filas`}</Boton>
            <Boton variante="fantasma" onClick={reiniciar}>Elegir otro archivo</Boton>
          </div>
        </>
      )}

      {res && (
        <>
          <p className="mb-3 rounded-xl bg-ok-fondo p-3 text-ok">✓ Importación terminada: {res.filas} filas leídas.</p>
          <ul className="mb-3 grid gap-1 sm:grid-cols-2">
            <li>Clientes nuevos: <strong>{res.clientesNuevos}</strong></li><li>Clientes que ya existían: <strong>{res.clientesActualizados}</strong></li>
            <li>Vehículos nuevos: <strong>{res.vehiculosNuevos}</strong></li><li>Vehículos actualizados: <strong>{res.vehiculosActualizados}</strong></li>
            <li>Próximos mantenimientos programados: <strong>{res.recordatorios}</strong></li>
          </ul>
          {res.errores.length > 0 && (
            <details open className="mb-3">
              <summary className="cursor-pointer font-bold text-aviso">{res.errores.length} filas no se importaron</summary>
              <ul className="mt-1 max-h-40 overflow-auto text-sm">{res.errores.map((e) => <li key={e.fila}>Fila {e.fila + 1}: {e.motivo}</li>)}</ul>
            </details>
          )}
          <Boton onClick={() => { reiniciar(); onCerrar(); }}>Listo</Boton>
        </>
      )}
      {error && !datos && <p role="alert" className="mt-3 text-marca">⚠ {error}</p>}
    </Dialogo>
  );
}
