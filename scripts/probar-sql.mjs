// Ejecuta las migraciones, la semilla y las pruebas SQL en PGlite (Postgres
// embebido, sin Docker ni proyecto en la nube). Uso: npm run test:sql
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

const raiz = new URL("../supabase/", import.meta.url);
const leer = (p) => readFileSync(new URL(p, raiz), "utf8");
const db = new PGlite();
const pasos = [
  ["entorno Supabase simulado", "tests/00_entorno_supabase.sql"],
  ...readdirSync(new URL("migrations/", raiz)).filter((f) => f.endsWith(".sql")).sort().map((f) => [`migración ${f}`, `migrations/${f}`]),
  ["semilla", "seed.sql"],
  ...readdirSync(new URL("tests/", raiz)).filter((f) => /^0[1-9].*\.sql$/.test(f)).sort().map((f) => [`pruebas ${f}`, `tests/${f}`]),
];
let ok = true;
for (const [nombre, archivo] of pasos) {
  try {
    await db.exec(leer(archivo));
    console.log(`✓ ${nombre}`);
  } catch (e) {
    ok = false;
    console.error(`✗ ${nombre}\n  ${e.message}${e.where ? "\n  " + e.where.split("\n")[0] : ""}`);
    break;
  }
}
const { rows } = await db.query("select count(*)::int as n from public.festivos");
if (ok) console.log(`✓ ${rows[0].n} festivos precargados · todas las pruebas SQL pasaron`);
await db.close();
process.exit(ok ? 0 : 1);
