/**
 * Panel del taller. Se carga aparte (lazy) del portal: el navegador de un
 * cliente que solo usa el portal nunca descarga este código.
 */
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { apiTaller } from "./datos/api";
import { usarManifiesto } from "../compartido/util/instalar";
import type { Usuario } from "./datos/tipos";
import { ProveedorPanel } from "./contexto";
import MarcoTaller from "./MarcoTaller";
import Login from "./Login";
import Tablero from "./Tablero";
import Bandeja from "./Bandeja";
import Agenda from "./Agenda";
import Ajustes from "./ajustes/Ajustes";
import Ordenes from "./ordenes/Ordenes";
import Recepcion from "./recepcion/Recepcion";
import Clientes from "./clientes/Clientes";
import Mantenimiento from "./mantenimiento/Mantenimiento";

export default function AppTaller() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  useEffect(() => usarManifiesto("/manifest-taller.webmanifest", "PSR Taller"), []);
  useEffect(() => {
    document.title = "Taller · PSR";
    apiTaller.sesionActual().then(setUsuario).catch(() => setUsuario(null));
  }, []);

  if (usuario === undefined) return <p className="p-8 text-center text-suave">Cargando…</p>;
  if (!usuario) return <Login onEntrar={setUsuario} />;
  return (
    <ProveedorPanel usuario={usuario} onSalir={() => setUsuario(null)}>
      <MarcoTaller>
        <Routes>
          <Route index element={<Tablero />} />
          <Route path="bandeja" element={<Bandeja />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="configuracion" element={<Ajustes />} />
          <Route path="ordenes" element={<Ordenes />} />
          <Route path="recepcion" element={<Recepcion key="placa" />} />
          <Route path="recepcion/:solicitudId" element={<Recepcion />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="mantenimiento" element={<Mantenimiento />} />
          <Route path="*" element={<Tablero />} />
        </Routes>
      </MarcoTaller>
    </ProveedorPanel>
  );
}
