import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../compartido/datos/api";
import { ErrorApi, type ResultadoSolicitud, type SintomaCat, type ZonaCat } from "../compartido/datos/tipos";
import catalogoJson from "../compartido/catalogo/sintomas.json";
import { Boton, Marco } from "../compartido/ui/base";
import { aSolicitud, borradorVacio, borrarBorrador, leerBorrador, useBorrador, validarPaso, type Borrador } from "./borrador";
import { usarCargasPendientes } from "./media/subida";
import { useModoPrueba } from "./ModoPrueba";
import Paso1Datos from "./pasos/Paso1Datos";
import Paso2Vehiculo from "./pasos/Paso2Vehiculo";
import Paso3Zona from "./pasos/Paso3Zona";
import Paso4Sintomas from "./pasos/Paso4Sintomas";
import Paso5Agenda from "./pasos/Paso5Agenda";
import Paso6Autorizaciones from "./pasos/Paso6Autorizaciones";
import Paso7Resumen from "./pasos/Paso7Resumen";
import Confirmacion from "./Confirmacion";

const TITULOS = ["Tus datos", "Tu vehículo", "¿Dónde?", "¿Qué le pasa?", "Agenda", "Autorizaciones", "Resumen"];
const TOTAL = TITULOS.length;

export default function Asistente() {
  const nav = useNavigate();
  const prueba = useModoPrueba();
  const guardado = useRef(leerBorrador());
  const [retomado, setRetomado] = useState(() => !!guardado.current && guardado.current.paso > 1);
  const [b, set] = useBorrador(() => guardado.current ?? borradorVacio());
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ r: ResultadoSolicitud; b: Borrador } | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [cat, setCat] = useState<{ zonas: ZonaCat[]; sintomas: SintomaCat[] }>({ zonas: catalogoJson.zonas, sintomas: catalogoJson.sintomas });
  const cargas = usarCargasPendientes();
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => { api.catalogo().then(setCat).catch(() => {}); }, []);
  // Enlace de un recordatorio de mantenimiento: ?r=<token> precarga SOLO el vehículo y el servicio.
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("r");
    if (!token || b.recordatorioToken === token) return;
    api.precargaRecordatorio(token).then((p) => {
      if (!p) return;
      const n = borradorVacio();
      n.esClienteExistente = true; n.canal = "recordatorio"; n.recordatorioToken = token;
      n.vehiculo = { ...n.vehiculo, placa: p.placa, marca: p.marca, linea: p.linea, anio: p.anio ? String(p.anio) : "", color: p.color, combustible: p.combustible, km: p.km ? String(p.km) : "" };
      n.zonas = ["general"]; n.sintomas = ["general.mantenimiento"]; n.descripcion = `Mantenimiento: ${p.servicio}`;
      set(n); setRetomado(false);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { titulo.current?.focus(); window.scrollTo({ top: 0 }); }, [b.paso]);
  useEffect(() => { if (!sinConexion) setError(""); }, [b]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cola local: si no hubo señal al enviar, se reintenta al volver la conexión.
  useEffect(() => {
    if (!sinConexion) return;
    const reintentar = () => void enviar();
    window.addEventListener("online", reintentar);
    return () => window.removeEventListener("online", reintentar);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const ir = (n: number) => { setError(""); setRetomado(false); set((x) => ({ ...x, paso: n })); };
  function siguiente() {
    const e = validarPaso(b.paso, b);
    if (e) { setError(e); prueba.error(); return; }
    ir(b.paso + 1);
  }
  function atras() {
    prueba.retroceso();
    if (b.paso === 1) nav("/"); else ir(b.paso - 1);
  }

  async function enviar() {
    for (let p = 1; p <= 6; p++) {
      const e = validarPaso(p, b);
      if (e) { setError(e); ir(p); return; }
    }
    if (cargas > 0) { setError("Espera a que terminen de subir tus archivos."); return; }
    setEnviando(true); setError("");
    try {
      const r = await api.crearSolicitud(aSolicitud(b));
      if (b.recordatorioToken) void api.vincularRecordatorio(b.recordatorioToken, r.codigo).catch(() => {});
      prueba.terminar(r.codigo, b.zonas);
      setResultado({ r, b });
      setSinConexion(false);
      borrarBorrador();
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === "CUPO_LLENO") { setError(e.message); ir(5); }
      else if ((e instanceof ErrorApi && e.codigo === "SIN_CONEXION") || !navigator.onLine) {
        setSinConexion(true);
        setError("No hay señal. Guardamos tu solicitud en este celular y la enviaremos apenas vuelva la conexión.");
      } else setError(e instanceof Error ? e.message : "No pudimos enviar. Intenta de nuevo.");
    } finally { setEnviando(false); }
  }

  if (resultado) return <Confirmacion resultado={resultado.r} b={resultado.b} />;

  const paso = b.paso;
  const props = { b, set };
  return (
    <Marco titulo="Solicitar revisión o cita">
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-sm text-suave">
          <span>Paso {paso} de {TOTAL}</span><span>{TITULOS[paso - 1]}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-borde" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={paso} aria-label="Avance de la solicitud">
          <div className="h-full rounded-full bg-marca transition-all duration-300" style={{ width: `${(paso / TOTAL) * 100}%` }} />
        </div>
      </div>

      {retomado && (
        <div className="entrar mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ok-fondo px-4 py-3 text-ok">
          <span>Retomamos tu solicitud donde ibas.</span>
          <button type="button" className="font-bold underline" onClick={() => { set(borradorVacio()); setRetomado(false); }}>Empezar de nuevo</button>
        </div>
      )}

      <h1 ref={titulo} tabIndex={-1} className="sr-only">Paso {paso}: {TITULOS[paso - 1]}</h1>
      <div key={paso} className="entrar">
        {paso === 1 && <Paso1Datos {...props} />}
        {paso === 2 && <Paso2Vehiculo {...props} />}
        {paso === 3 && <Paso3Zona {...props} zonas={cat.zonas} />}
        {paso === 4 && <Paso4Sintomas {...props} zonas={cat.zonas} sintomas={cat.sintomas} />}
        {paso === 5 && <Paso5Agenda {...props} />}
        {paso === 6 && <Paso6Autorizaciones {...props} />}
        {paso === 7 && <Paso7Resumen b={b} ir={ir} zonas={cat.zonas} sintomas={cat.sintomas} />}
      </div>

      <nav aria-label="Navegación del formulario" className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie/95 backdrop-blur">
        {error && <p role="alert" className="mx-auto max-w-2xl px-4 pt-2 font-bold text-marca">{error}</p>}
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3">
          <Boton variante="secundario" onClick={atras} className="flex-1">{paso === 1 ? "Salir" : "Atrás"}</Boton>
          {paso < TOTAL ? (
            <Boton onClick={siguiente} className="flex-[2]">Siguiente</Boton>
          ) : (
            <Boton onClick={enviar} disabled={enviando || cargas > 0} className="flex-[2]">
              {enviando ? "Enviando…" : cargas > 0 ? `Subiendo archivos (${cargas})…` : "Enviar solicitud"}
            </Boton>
          )}
        </div>
      </nav>
    </Marco>
  );
}
