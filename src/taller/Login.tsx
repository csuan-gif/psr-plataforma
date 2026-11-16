import { useState, type FormEvent } from "react";
import { apiTaller } from "./datos/api";
import { ErrorTaller, type Usuario } from "./datos/tipos";
import { Boton, Campo, Tarjeta } from "../compartido/ui/base";
import { TALLER } from "../compartido/config";

export default function Login({ onEntrar }: { onEntrar: (u: Usuario) => void }) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e?: FormEvent, id?: string) {
    e?.preventDefault();
    setCargando(true); setMsg("");
    try { onEntrar(await apiTaller.iniciarSesion(id ?? correo, clave)); }
    catch (err) { setMsg(err instanceof ErrorTaller ? err.message : "No se pudo iniciar sesión."); }
    finally { setCargando(false); }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-fondo px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-center gap-2 text-lg font-bold">
          <img src="/icono.svg" alt="" width={40} height={40} /> {TALLER.nombre} · Taller
        </div>
        <Tarjeta>
          <h1 className="mb-4 text-2xl font-bold">Entrar al panel</h1>
          {apiTaller.usuariosDemo ? (
            <div className="grid gap-2">
              <p className="mb-1 text-sm text-suave">Modo demostración: elige con quién entrar. Abre otra pestaña con otro usuario para ver el tiempo real y la presencia.</p>
              {apiTaller.usuariosDemo.map((u) => (
                <Boton key={u.id} variante={u.rol === "admin" ? "primario" : "secundario"} disabled={cargando} onClick={() => entrar(undefined, u.id)}>
                  Entrar como {u.nombre} ({u.rol === "admin" ? "administrador" : "técnico"})
                </Boton>
              ))}
            </div>
          ) : (
            <form onSubmit={entrar}>
              <Campo id="correo" etiqueta="Correo">
                <input id="correo" type="email" autoComplete="username" className="campo" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
              </Campo>
              <Campo id="clave" etiqueta="Contraseña">
                <input id="clave" type="password" autoComplete="current-password" className="campo" value={clave} onChange={(e) => setClave(e.target.value)} required />
              </Campo>
              <Boton type="submit" disabled={cargando} className="w-full">{cargando ? "Entrando…" : "Entrar"}</Boton>
            </form>
          )}
          {msg && <p role="alert" className="mt-3 font-bold text-marca">{msg}</p>}
        </Tarjeta>
        <p className="mt-3 text-center text-sm"><a href="/" className="text-suave underline">Ir al portal del cliente</a></p>
      </div>
    </div>
  );
}
