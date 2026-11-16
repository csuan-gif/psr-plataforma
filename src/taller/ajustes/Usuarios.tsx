import { useCallback, useEffect, useState } from "react";
import { apiTaller } from "../datos/api";
import { ErrorTaller, type Rol, type UsuarioAdmin } from "../datos/tipos";
import { usePanel } from "../contexto";
import { Boton, Tarjeta } from "../../compartido/ui/base";

export default function Usuarios() {
  const { usuario } = usePanel();
  const [lista, setLista] = useState<UsuarioAdmin[]>([]);
  const [nuevo, setNuevo] = useState({ correo: "", nombre: "", rol: "tecnico" as Rol });
  const [msg, setMsg] = useState("");
  const cargar = useCallback(async () => setLista(await apiTaller.usuarios().catch(() => [])), []);
  useEffect(() => { void cargar(); }, [cargar]);
  async function hacer(fn: () => Promise<void>, ok: string) {
    setMsg("");
    try { await fn(); setMsg("✓ " + ok); await cargar(); } catch (e) { setMsg("⚠ " + (e instanceof ErrorTaller ? e.message : "No se pudo guardar.")); }
  }

  return (
    <Tarjeta>
      <h2 className="mb-1 text-lg font-bold">Usuarios y roles</h2>
      <p className="mb-3 text-sm text-suave"><strong>Administrador</strong>: todo, incluidos ajustes, importar, exportar y suprimir datos. <strong>Técnico</strong>: bandeja, agenda, recepción, órdenes, clientes y recordatorios.</p>
      {msg && <p role="status" className={`mb-2 rounded-lg px-3 py-2 ${msg.startsWith("✓") ? "bg-ok-fondo text-ok" : "bg-aviso-fondo text-aviso"}`}>{msg}</p>}
      <ul className="mb-4 grid gap-2">
        {lista.map((u) => (
          <li key={u.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-borde p-3 ${u.activo ? "" : "opacity-60"}`}>
            <span className="min-w-40 flex-1"><strong>{u.nombre}</strong>{u.id === usuario.id && " (tú)"}<br /><span className="text-sm text-suave">{u.correo}</span></span>
            <select aria-label={`Rol de ${u.nombre}`} className="campo !w-auto !min-h-10 !py-1" value={u.rol} onChange={(e) => hacer(() => apiTaller.actualizarUsuario(u.id, e.target.value as Rol, u.activo), "Rol actualizado.")}>
              <option value="admin">Administrador</option><option value="tecnico">Técnico</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={u.activo} onChange={(e) => hacer(() => apiTaller.actualizarUsuario(u.id, u.rol, e.target.checked), e.target.checked ? "Acceso activado." : "Acceso desactivado.")} /> Activo</label>
          </li>
        ))}
      </ul>
      <h3 className="mb-1 font-bold">Dar acceso a una persona</h3>
      <ol className="mb-2 list-decimal pl-5 text-sm text-suave">
        <li>En Supabase → Authentication → Users → <em>Add user</em>, crea su cuenta con correo y contraseña.</li>
        <li>Escribe aquí ese mismo correo, su nombre y su rol.</li>
      </ol>
      <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto_auto]">
        <input aria-label="Correo" type="email" className="campo" placeholder="correo@ejemplo.com" value={nuevo.correo} onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} />
        <input aria-label="Nombre" className="campo" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <select aria-label="Rol" className="campo" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}><option value="tecnico">Técnico</option><option value="admin">Administrador</option></select>
        <Boton disabled={!nuevo.correo.includes("@") || nuevo.nombre.trim().length < 2} onClick={() => hacer(async () => { await apiTaller.agregarUsuario(nuevo.correo, nuevo.nombre, nuevo.rol); setNuevo({ correo: "", nombre: "", rol: "tecnico" }); }, "Acceso otorgado.")}>Dar acceso</Boton>
      </div>
    </Tarjeta>
  );
}
