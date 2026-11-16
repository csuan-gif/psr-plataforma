import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import Inicio from "./cliente/Inicio";
import Asistente from "./cliente/Asistente";
import YaSoyCliente from "./cliente/YaSoyCliente";
import Consultar from "./cliente/Consultar";
import Privacidad from "./cliente/Privacidad";
import MiMantenimiento from "./cliente/MiMantenimiento";
import { ProveedorModoPrueba } from "./cliente/ModoPrueba";
import { Marco } from "./compartido/ui/base";

// El panel del taller se descarga solo al entrar a /taller (nunca en el portal del cliente).
const AppTaller = lazy(() => import("./taller/AppTaller"));

function Proximamente({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <Marco titulo={titulo}>
      <h1 className="mb-2 text-2xl font-bold">{titulo}</h1>
      <p className="mb-4 text-suave">Disponible en la {fase}</p>
      <Link to="/" className="font-bold text-marca underline">Volver al inicio</Link>
    </Marco>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorModoPrueba>
        <Suspense fallback={<p className="p-8 text-center">Cargando…</p>}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/solicitar" element={<Asistente />} />
            <Route path="/ya-soy-cliente" element={<YaSoyCliente />} />
            <Route path="/consultar" element={<Consultar />} />
            <Route path="/mantenimiento" element={<MiMantenimiento />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/taller/*" element={<AppTaller />} />
            <Route path="*" element={<Proximamente titulo="Página no encontrada" fase="dirección correcta: vuelve al inicio." />} />
          </Routes>
        </Suspense>
      </ProveedorModoPrueba>
    </BrowserRouter>
  );
}
