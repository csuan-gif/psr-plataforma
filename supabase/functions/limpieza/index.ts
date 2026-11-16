// Edge Function "limpieza" (Supabase, Deno). Se ejecuta en el servidor con la service_role.
// 1) Borra los archivos que el portal subió a pendientes/ y nunca quedaron en una solicitud (más de 2 días).
// 2) Borra fotos, video y firma de las actas de clientes que pidieron la supresión de sus datos (Ley 1581).
// Protegida con un secreto: solo la llama la tarea programada (ver supabase/programar_limpieza.sql).
// NO PROBADA en un proyecto real (ver docs/PENDIENTES.md).
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

Deno.serve(async (req) => {
  const secreto = Deno.env.get("LIMPIEZA_SECRETO");
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) return new Response("No autorizado", { status: 401 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("limpieza_pendiente");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const { huerfanos, suprimidos } = data as { huerfanos: string[]; suprimidos: string[] };

  const borrar = async (bucket: string, rutas: string[]) => {
    let n = 0;
    for (let i = 0; i < rutas.length; i += 100) {
      const lote = rutas.slice(i, i + 100);
      const r = await sb.storage.from(bucket).remove(lote);
      if (r.error) throw new Error(`${bucket}: ${r.error.message}`);
      n += lote.length;
    }
    return n;
  };
  try {
    const nHuerfanos = await borrar("solicitudes", huerfanos);
    const nSuprimidos = await borrar("recepciones", suprimidos);
    if (suprimidos.length) {
      const m = await sb.rpc("limpieza_marcar", { p_rutas: suprimidos });
      if (m.error) throw new Error(m.error.message);
    }
    return Response.json({ borradosPendientes: nHuerfanos, borradosSuprimidos: nSuprimidos });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
