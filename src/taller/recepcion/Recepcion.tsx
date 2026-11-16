import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type Dano, type FotoActa, type ItemChecklist, type PrecargaRecepcion, type TipoFotoActa } from "../datos/tipos";
import { usePanel } from "../contexto";
import { nombreSintoma, nombreZona } from "../ui";
import MedidorCombustible from "./MedidorCombustible";
import MapaDanos from "./MapaDanos";
import Firma from "./Firma";
import ActaLista from "./ActaLista";
import AltaRapida from "./AltaRapida";
import { Boton, Campo, Tarjeta } from "../../compartido/ui/base";
import { COLORES, COMBUSTIBLES } from "../../compartido/catalogo/vehiculos";
import { avisoVin, limpiarVin } from "../../compartido/util/validaciones";
import { comprimirImagen } from "../../compartido/util/imagen";
import { almacen, nuevoId } from "../../compartido/util/almacen";

export const CHECKLIST: [string, string][] = [
  ["luces_bajas", "Luces bajas"], ["luces_altas", "Luces altas"], ["direccionales", "Direccionales"], ["stop", "Luces de stop"], ["reversa", "Luz de reversa"],
  ["pito", "Pito"], ["limpiaparabrisas", "Limpiaparabrisas"], ["aire_acondicionado", "Aire acondicionado"], ["vidrios_electricos", "Vidrios eléctricos"],
  ["testigos_tablero", "Testigos del tablero al encender"], ["llantas", "Llantas"], ["repuesto", "Llanta de repuesto"], ["gato_cruceta", "Gato y cruceta"],
  ["radio", "Radio o pantalla"], ["espejos", "Espejos"], ["tapetes", "Tapetes"], ["emblemas", "Emblemas"], ["nivel_aceite", "Nivel de aceite visible"], ["fugas", "Fugas visibles"],
];
export const FOTOS_OBLIGATORIAS: [TipoFotoActa, string][] = [["frente", "Frente"], ["lateral_izq", "Lateral izquierdo"], ["lateral_der", "Lateral derecho"], ["tablero", "Tablero con km"]];
const SECCIONES = ["Datos", "Km y combustible", "Daños", "Inspección", "Objetos", "Fotos y video", "Autorizaciones y firma"];

interface Estado {
  correo: string; direccion: string; color: string; vin: string; combustible: string;
  km: string; nivel: number | null; danos: Dano[]; checklist: Record<string, ItemChecklist>;
  objetos: string; accesorios: string; observaciones: string;
  fotos: Partial<Record<TipoFotoActa, string>>; extras: string[]; video: string | null;
  presupuestoPrevio: boolean | null; pruebaRuta: boolean | null; firmadoPor: string;
}

function Seccion({ n, titulo, abierta, onAbrir, completa, children }: { n: number; titulo: string; abierta: boolean; onAbrir: () => void; completa: boolean; children: ReactNode }) {
  return (
    <section className="mb-3 overflow-hidden rounded-2xl border border-borde bg-superficie">
      <button type="button" onClick={onAbrir} aria-expanded={abierta} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${completa ? "bg-ok text-white" : "border-2 border-borde"}`}>{completa ? "✓" : n}</span>
        <span className="flex-1 text-lg font-bold">{titulo}</span><span aria-hidden>{abierta ? "▾" : "▸"}</span>
      </button>
      {abierta && <div className="entrar border-t border-borde px-4 py-4">{children}</div>}
    </section>
  );
}

function FotoSlot({ etiqueta, ruta, onSubir, acepta = "image/*", obligatoria }: { etiqueta: string; ruta?: string | null; onSubir: (f: File) => Promise<void>; acepta?: string; obligatoria?: boolean }) {
  const [estado, setEstado] = useState<"" | "subiendo" | "error">("");
  const [vista, setVista] = useState<string | null>(null);
  useEffect(() => { if (ruta && !vista) apiTaller.urlArchivo(ruta).then(setVista).catch(() => {}); }, [ruta]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className={`relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 text-center text-sm font-bold ${ruta ? "border-ok" : obligatoria ? "border-dashed border-marca" : "border-dashed border-borde"}`}>
      {vista && (acepta.startsWith("video") ? <video src={vista} className="absolute inset-0 h-full w-full object-cover" muted /> : <img src={vista} alt="" className="absolute inset-0 h-full w-full object-cover" />)}
      <span className={`relative z-10 rounded-lg px-2 py-1 ${vista ? "bg-black/60 text-white" : ""}`}>
        {estado === "subiendo" ? "Subiendo…" : estado === "error" ? "⚠ Reintentar" : ruta ? `✓ ${etiqueta}` : `📷 ${etiqueta}${obligatoria ? " *" : ""}`}
      </span>
      <input type="file" accept={acepta} capture="environment" className="sr-only" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setEstado("subiendo"); setVista(URL.createObjectURL(f));
        try { await onSubir(f); setEstado(""); } catch { setEstado("error"); }
      }} />
    </label>
  );
}

export default function Recepcion() {
  const { solicitudId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { usuario, recargar } = usePanel();
  const actaId = useRef(nuevoId()).current; // carpeta de archivos de esta acta
  const [p, setP] = useState<PrecargaRecepcion | null>(null);
  const [placa, setPlaca] = useState(params.get("placa") ?? "");
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState(0);
  const [firma, setFirma] = useState<Blob | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [alta, setAlta] = useState(false);
  const [creada, setCreada] = useState<{ recepcionId: string; ordenId: string; codigo: string | null } | null>(null);
  const borradorKey = `psr-acta-${solicitudId ?? placa}`;
  const [e, setE] = useState<Estado>(() => almacen.leer<Estado | null>(borradorKey, null) ?? {
    correo: "", direccion: "", color: "", vin: "", combustible: "", km: "", nivel: null, danos: [], checklist: {},
    objetos: "", accesorios: "", observaciones: "", fotos: {}, extras: [], video: null, presupuestoPrevio: null, pruebaRuta: null, firmadoPor: "",
  });
  const set = (x: Partial<Estado>) => setE((v) => ({ ...v, ...x }));
  useEffect(() => { if (p) almacen.guardar(borradorKey, e); }, [e, p, borradorKey]);

  function aplicar(pr: PrecargaRecepcion) {
    setP(pr);
    setE((v) => ({
      ...v, correo: v.correo || pr.cliente.correo || "", direccion: v.direccion || pr.cliente.direccion || "", color: v.color || pr.vehiculo.color || "",
      vin: v.vin || pr.vehiculo.vin || "", combustible: v.combustible || pr.vehiculo.combustible || "",
      presupuestoPrevio: v.presupuestoPrevio ?? (pr.presupuesto ? pr.presupuesto === "previo" : null), pruebaRuta: v.pruebaRuta ?? pr.pruebaRuta,
      firmadoPor: v.firmadoPor || pr.cliente.nombre.replace(/\s*\(.*\)/, ""),
    }));
  }
  useEffect(() => {
    if (solicitudId) apiTaller.precargaDesdeSolicitud(solicitudId).then(aplicar).catch(() => setError("No se pudo cargar la solicitud."));
    else if (params.get("placa")) void buscar(params.get("placa")!);
  }, [solicitudId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function buscar(pl = placa) {
    setError("");
    const r = await apiTaller.buscarVehiculo(pl).catch(() => null);
    if (!r) { setError("No encontramos esa placa."); setAlta(true); }
    else { setAlta(false); aplicar(r); }
  }

  const subir = async (f: File | Blob, nombre: string) => {
    const cuerpo = f.type.startsWith("image/") ? await comprimirImagen(f, 1600, 0.6) : f;
    return apiTaller.subirArchivoActa(actaId, cuerpo, nombre);
  };

  const completas = useMemo(() => [
    !!p,
    e.km !== "" && e.nivel !== null,
    true,
    CHECKLIST.every(([k]) => e.checklist[k]),
    true,
    FOTOS_OBLIGATORIAS.every(([t]) => e.fotos[t]),
    e.presupuestoPrevio !== null && e.pruebaRuta !== null && !!firma && e.firmadoPor.trim().length >= 3,
  ], [p, e, firma]);
  const faltantes = SECCIONES.filter((_, i) => !completas[i]);
  const kmMenor = p?.vehiculo.km != null && e.km !== "" && Number(e.km) < p.vehiculo.km;

  async function guardar() {
    if (!p || faltantes.length) return;
    setGuardando(true); setError("");
    try {
      const rutaFirma = await apiTaller.subirArchivoActa(actaId, firma!, "firma.png");
      const fotos: FotoActa[] = [
        ...FOTOS_OBLIGATORIAS.map(([t]) => ({ tipo: t, ruta: e.fotos[t]! })),
        ...e.extras.map((r) => ({ tipo: "extra" as const, ruta: r })),
        ...e.danos.filter((d) => d.foto).map((d) => ({ tipo: "dano" as const, ruta: d.foto!, nota: d.zona })),
      ];
      const r = await apiTaller.crearRecepcion({
        solicitudId: p.solicitudId, vehiculoId: p.vehiculo.id, kmIngreso: Number(e.km), nivelCombustible: e.nivel!, checklist: e.checklist, mapaDanos: e.danos,
        objetosPersonales: e.objetos, accesorios: e.accesorios, fotos, videoInspeccion: e.video, autorizaPresupuestoPrevio: e.presupuestoPrevio!,
        autorizaPruebaRuta: e.pruebaRuta!, observaciones: e.observaciones, firmaCliente: rutaFirma, firmadoPor: e.firmadoPor,
        vehiculo: { color: e.color || undefined, vin: limpiarVin(e.vin) || undefined, combustible: e.combustible || undefined },
        cliente: { correo: e.correo || undefined, direccion: e.direccion || undefined },
      });
      almacen.borrar(borradorKey);
      setCreada(r); void recargar();
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ErrorTaller ? err.message : "No se pudo guardar el acta. Revisa la conexión e intenta de nuevo.");
    } finally { setGuardando(false); }
  }

  if (creada && p) return <ActaLista recepcionId={creada.recepcionId} codigo={creada.codigo} celular={p.cliente.celular} nombre={p.cliente.nombre} placa={p.vehiculo.placa} onSeguir={() => nav("/taller/ordenes")} />;

  if (!p) return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Recibir vehículo</h1>
      <Tarjeta className="max-w-md">
        <Campo id="placa-rec" etiqueta="Placa del vehículo">
          <div className="flex gap-2">
            <input id="placa-rec" className="campo text-center text-xl font-bold uppercase tracking-widest" maxLength={7} value={placa} onChange={(x) => setPlaca(x.target.value.toUpperCase())} onKeyDown={(x) => x.key === "Enter" && buscar()} />
            <Boton onClick={() => buscar()} disabled={!placa}>Buscar</Boton>
          </div>
        </Campo>
        {error && <p role="alert" className="text-aviso">⚠ {error}</p>}
        <p className="mt-2 text-sm text-suave">También puedes abrir el acta desde la solicitud en la bandeja o desde la cita en la agenda.</p>
      </Tarjeta>
      {alta && <div className="mt-4"><AltaRapida placa={placa} onListo={(id) => nav("/taller/recepcion/" + id)} /></div>}
    </>
  );

  if (p.ordenAbierta) return (
    <Tarjeta className="max-w-lg">
      <h1 className="mb-2 text-xl font-bold">{p.vehiculo.placa} ya está en el taller</h1>
      <p className="mb-3">Este vehículo tiene una orden de trabajo abierta. Ciérrala (entrega o cancelación) antes de abrir otra acta.</p>
      <Link to="/taller/ordenes" className="font-bold text-marca underline">Ir a órdenes</Link>
    </Tarjeta>
  );

  const S = (i: number, children: ReactNode) => <Seccion n={i + 1} titulo={SECCIONES[i]} abierta={abierta === i} onAbrir={() => setAbierta(abierta === i ? -1 : i)} completa={completas[i]}>{children}<div className="mt-4 flex justify-end">{i < SECCIONES.length - 1 && <Boton variante="secundario" onClick={() => setAbierta(i + 1)}>Siguiente sección →</Boton>}</div></Seccion>;

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-3">
        <p className="text-sm text-suave">Acta de ingreso {p.codigo && `· ${p.codigo}`} · recibe {usuario.nombre}</p>
        <h1 className="text-2xl font-bold">{p.vehiculo.placa} · {[p.vehiculo.marca, p.vehiculo.linea, p.vehiculo.anio].filter(Boolean).join(" ")}</h1>
        <p>{p.cliente.nombre} · {p.cliente.celular}</p>
      </div>
      {p.reporte && (
        <Tarjeta className="mb-3 text-sm">
          <strong>Lo que reportó el cliente:</strong> {p.reporte.zonas.map(nombreZona).join(", ")}{p.reporte.sintomas.length > 0 && " — " + p.reporte.sintomas.map(nombreSintoma).join("; ")}
          {p.reporte.descripcion && <> · «{p.reporte.descripcion}»</>}
        </Tarjeta>
      )}

      {S(0, <>
        <p className="mb-3 text-sm text-suave">Ya viene lo que escribió el cliente. Confirma con la tarjeta de propiedad y completa lo que falte.</p>
        <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-suave">Documento</dt><dd>{p.cliente.tipoDocumento} {p.cliente.numeroDocumento}</dd>
          <dt className="text-suave">Celular</dt><dd>{p.cliente.celular}</dd>
        </dl>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Campo id="r-correo" etiqueta="Correo" opcional><input id="r-correo" type="email" className="campo" value={e.correo} onChange={(x) => set({ correo: x.target.value })} /></Campo>
          <Campo id="r-dir" etiqueta="Dirección" opcional><input id="r-dir" className="campo" value={e.direccion} onChange={(x) => set({ direccion: x.target.value })} /></Campo>
          <Campo id="r-vin" etiqueta="VIN (tarjeta de propiedad)" opcional aviso={avisoVin(e.vin)}><input id="r-vin" className="campo font-mono uppercase" maxLength={17} value={e.vin} onChange={(x) => set({ vin: x.target.value.toUpperCase() })} /></Campo>
          <Campo id="r-color" etiqueta="Color" opcional>
            <select id="r-color" className="campo" value={e.color} onChange={(x) => set({ color: x.target.value })}><option value="">—</option>{COLORES.map((c) => <option key={c.nombre}>{c.nombre}</option>)}<option>Otro</option></select>
          </Campo>
          <Campo id="r-comb" etiqueta="Combustible" opcional>
            <select id="r-comb" className="campo" value={e.combustible} onChange={(x) => set({ combustible: x.target.value })}><option value="">—</option>{COMBUSTIBLES.filter((c) => c.id !== "nose").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          </Campo>
        </div>
      </>)}

      {S(1, <>
        <Campo id="r-km" etiqueta="Kilometraje de ingreso (del tablero)" aviso={kmMenor ? `Es menor que el último registrado (${p.vehiculo.km!.toLocaleString("es-CO")} km). Revisa el número; si el tablero fue cambiado, anótalo en observaciones.` : null}>
          <input id="r-km" className="campo max-w-56 text-center text-xl font-bold" inputMode="numeric" value={e.km ? Number(e.km).toLocaleString("es-CO") : ""} onChange={(x) => set({ km: x.target.value.replace(/\D/g, "").slice(0, 7) })} placeholder={p.vehiculo.km ? p.vehiculo.km.toLocaleString("es-CO") : "0"} />
        </Campo>
        <p className="mb-2 font-bold">Nivel de combustible</p>
        <MedidorCombustible valor={e.nivel} onCambio={(n) => set({ nivel: n })} />
      </>)}

      {S(2, <MapaDanos danos={e.danos} onCambio={(d) => set({ danos: d })} subirFoto={(f) => subir(f, "dano.jpg")} />)}

      {S(3, <>
        <div className="mb-3 flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={() => set({ checklist: Object.fromEntries(CHECKLIST.map(([k]) => [k, e.checklist[k] ?? { estado: "bien" }])) })}>Marcar el resto como «bien»</Boton>
        </div>
        <ul className="grid gap-2">
          {CHECKLIST.map(([k, nombre]) => {
            const it = e.checklist[k];
            return (
              <li key={k} className="rounded-xl border border-borde p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-40 flex-1 font-bold">{nombre}</span>
                  <div role="radiogroup" aria-label={nombre} className="flex gap-1">
                    {([["bien", "✓ Bien", "bg-ok-fondo border-ok text-ok"], ["novedad", "⚠ Novedad", "bg-aviso-fondo border-aviso text-aviso"], ["na", "No aplica", "bg-fondo border-suave"]] as const).map(([v, t, cls]) => (
                      <button key={v} type="button" role="radio" aria-checked={it?.estado === v}
                        onClick={() => set({ checklist: { ...e.checklist, [k]: { estado: v, nota: v === "novedad" ? it?.nota : undefined } } })}
                        className={`min-h-10 rounded-lg border-2 px-2 text-sm font-bold ${it?.estado === v ? cls : "border-borde"}`}>{t}</button>
                    ))}
                  </div>
                </div>
                {it?.estado === "novedad" && (
                  <input aria-label={`Novedad en ${nombre}`} className="campo mt-2" placeholder="¿Qué novedad?" value={it.nota ?? ""} onChange={(x) => set({ checklist: { ...e.checklist, [k]: { estado: "novedad", nota: x.target.value } } })} />
                )}
              </li>
            );
          })}
        </ul>
      </>)}

      {S(4, <>
        <Campo id="r-obj" etiqueta="Objetos personales que deja el cliente" opcional ayuda="Ej.: gafas en la guantera, silla de bebé, cargador."><textarea id="r-obj" className="campo min-h-20" value={e.objetos} onChange={(x) => set({ objetos: x.target.value })} /></Campo>
        <Campo id="r-acc" etiqueta="Accesorios" opcional ayuda="Ej.: antena, tapa de gasolina, kit de carretera, extintor."><textarea id="r-acc" className="campo min-h-20" value={e.accesorios} onChange={(x) => set({ accesorios: x.target.value })} /></Campo>
        <Campo id="r-obs" etiqueta="Observaciones" opcional><textarea id="r-obs" className="campo min-h-20" value={e.observaciones} onChange={(x) => set({ observaciones: x.target.value })} /></Campo>
      </>)}

      {S(5, <>
        <p className="mb-2 text-sm text-suave">Las 4 fotos marcadas con * son obligatorias. El video de 360° es opcional, pero ayuda mucho ante reclamos.</p>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FOTOS_OBLIGATORIAS.map(([t, nombre]) => (
            <FotoSlot key={t} etiqueta={nombre} obligatoria ruta={e.fotos[t]} onSubir={async (f) => { const r = await subir(f, `${t}.jpg`); setE((v) => ({ ...v, fotos: { ...v.fotos, [t]: r } })); }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FotoSlot etiqueta="Video 360°" acepta="video/*" ruta={e.video} onSubir={async (f) => {
            if (f.size > 50 * 1024 * 1024) throw new Error("grande");
            const r = await subir(f, "video-360.mp4"); set({ video: r });
          }} />
          {e.extras.map((r, i) => <FotoSlot key={r} etiqueta={`Extra ${i + 1}`} ruta={r} onSubir={async () => {}} />)}
          <FotoSlot etiqueta="Foto extra" onSubir={async (f) => { const r = await subir(f, "extra.jpg"); setE((v) => ({ ...v, extras: [...v.extras, r] })); }} />
        </div>
      </>)}

      {S(6, <>
        <p className="mb-2 font-bold">Confirma con el cliente:</p>
        <div className="mb-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Presupuesto">
          {([[true, "Pide presupuesto previo", "No se repara hasta que apruebe."], [false, "Autoriza reparar sin presupuesto", "El taller puede avanzar."]] as const).map(([v, t, d]) => (
            <button key={t} type="button" role="radio" aria-checked={e.presupuestoPrevio === v} onClick={() => set({ presupuestoPrevio: v })}
              className={`rounded-xl border-2 p-3 text-left ${e.presupuestoPrevio === v ? "border-marca bg-marca-suave" : "border-borde"}`}><span className="block font-bold">{t}</span><span className="text-sm text-suave">{d}</span></button>
          ))}
        </div>
        <div className="mb-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Prueba de ruta">
          {([[true, "Autoriza conducir para pruebas"], [false, "NO autoriza conducir"]] as const).map(([v, t]) => (
            <button key={t} type="button" role="radio" aria-checked={e.pruebaRuta === v} onClick={() => set({ pruebaRuta: v })}
              className={`min-h-12 rounded-xl border-2 p-3 text-left font-bold ${e.pruebaRuta === v ? "border-marca bg-marca-suave" : "border-borde"}`}>{t}</button>
          ))}
        </div>
        {p.presupuesto && ((p.presupuesto === "previo") !== e.presupuestoPrevio || p.pruebaRuta !== e.pruebaRuta) && (
          <p className="mb-3 rounded-lg bg-aviso-fondo px-3 py-2 text-sm text-aviso">Cambió respecto a lo que el cliente marcó en el portal. Vale lo que firme ahora.</p>
        )}
        <Campo id="r-firmante" etiqueta="Nombre de quien firma (entrega el vehículo)">
          <input id="r-firmante" className="campo" value={e.firmadoPor} onChange={(x) => set({ firmadoPor: x.target.value })} />
        </Campo>
        <p className="mb-1 font-bold">Firma del cliente</p>
        <p className="mb-2 text-sm text-suave">Al firmar, el cliente acepta el estado del vehículo descrito en esta acta y las autorizaciones marcadas.</p>
        <Firma onCambio={setFirma} />
        <p className="mt-3 text-sm">Recibe: <strong>{usuario.nombre}</strong></p>
      </>)}

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-borde bg-superficie/95 px-4 py-3 backdrop-blur sm:bottom-0">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          {error && <p role="alert" className="w-full font-bold text-marca">{error}</p>}
          <p className="flex-1 text-sm">{faltantes.length ? <>Falta: <strong>{faltantes.join(", ")}</strong></> : "✓ Todo listo para guardar el acta."}</p>
          <Boton disabled={!!faltantes.length || guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar acta firmada"}</Boton>
        </div>
      </div>
    </div>
  );
}
