import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiTaller } from "../datos/api";
import type { ClienteLista } from "../datos/tipos";
import { usePanel } from "../contexto";
import FichaCliente from "./FichaCliente";
import ImportarExcel from "./ImportarExcel";
import { exportarCsv, exportarXlsx } from "./hojas";
import { Boton } from "../../compartido/ui/base";
import { buscarClientes } from "./buscar";

export default function Clientes() {
  const { usuario, ultimoCambio } = usePanel();
  const admin = usuario.rol === "admin";
  const [params] = useSearchParams();
  const [lista, setLista] = useState<ClienteLista[] | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [abierto, setAbierto] = useState<string | null>(params.get("abrir"));
  const [importar, setImportar] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "sin_autorizacion">("todos");
  const [limite, setLimite] = useState(50);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => setLista(await apiTaller.clientes().catch(() => [])), []);
  useEffect(() => { void cargar(); }, [cargar, ultimoCambio]);

  const visibles = useMemo(() => buscarClientes(lista ?? [], q).filter((c) => filtro === "todos" || (!c.autorizaDatos && !c.anonimizado)), [lista, q, filtro]);

  async function exportar(formato: "xlsx" | "csv") {
    const datos = visibles.filter((c) => !c.anonimizado);
    if (!confirm(`Vas a descargar los datos personales de ${datos.length} clientes. Guarda el archivo en un lugar seguro y no lo compartas. ¿Continuar?`)) return;
    try {
      await apiTaller.registrarExportacion(datos.length, formato); // queda en la auditoría
      if (formato === "csv") exportarCsv(datos); else await exportarXlsx(datos);
    } catch { setMsg("⚠ No se pudo exportar."); }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Clientes {lista && <span className="text-base font-normal text-suave">({lista.filter((c) => !c.anonimizado).length})</span>}</h1>
        {admin && <>
          <Boton variante="secundario" onClick={() => setImportar(true)}>⬆ Importar Excel</Boton>
          <Boton variante="secundario" onClick={() => exportar("xlsx")}>⬇ Excel</Boton>
          <Boton variante="secundario" onClick={() => exportar("csv")}>⬇ CSV</Boton>
        </>}
      </div>
      {msg && <p role="alert" className="mb-2 text-marca">{msg}</p>}
      <input type="search" autoFocus aria-label="Buscar cliente por nombre, documento, celular o placa" placeholder="🔎 Nombre, documento, celular o placa" className="campo mb-2" value={q} onChange={(e) => { setQ(e.target.value); setLimite(50); }} />
      <div className="mb-3 flex gap-2 text-sm">
        {([["todos", "Todos"], ["sin_autorizacion", "Sin autorización de datos"]] as const).map(([v, t]) => (
          <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)} className={`rounded-full border-2 px-3 py-1 font-bold ${filtro === v ? "border-marca bg-marca-suave" : "border-borde"}`}>{t}</button>
        ))}
      </div>
      {!lista ? <p className="py-10 text-center text-suave">Cargando…</p> : visibles.length === 0 ? <p className="py-10 text-center text-suave">No hay clientes con esa búsqueda.</p> : (
        <ul className="grid gap-2 md:grid-cols-2">
          {visibles.slice(0, limite).map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setAbierto(c.id)} className={`w-full rounded-2xl border border-borde bg-superficie p-3 text-left hover:border-marca ${c.anonimizado ? "opacity-60" : ""}`}>
                <span className="block font-bold">{c.nombre}</span>
                <span className="block text-sm text-suave">{c.tipoDocumento} {c.numeroDocumento}{c.celular && ` · ${c.celular}`}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {c.placas.map((p) => <span key={p} className="rounded bg-fondo px-2 font-mono text-sm font-bold">{p}</span>)}
                  {!c.autorizaDatos && !c.anonimizado && <span className="rounded-full bg-aviso-fondo px-2 text-xs font-bold text-aviso">Sin autorización</span>}
                  {c.origen === "importado" && <span className="rounded-full bg-fondo px-2 text-xs">Excel</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {visibles.length > limite && <Boton variante="secundario" className="mt-3" onClick={() => setLimite(limite + 100)}>Ver más ({visibles.length - limite})</Boton>}
      <FichaCliente id={abierto} onCerrar={() => setAbierto(null)} onCambio={cargar} />
      {admin && <ImportarExcel abierto={importar} onCerrar={() => setImportar(false)} onListo={cargar} />}
    </>
  );
}
