// Genera supabase/reparar_tildes.sql: repara una base en la que las
// migraciones y la semilla se pegaron con las tildes dañadas (texto UTF-8
// leído como Mac Roman, p. ej. "Pasión" → "Pasi√≥n").
// 1) Vuelve a crear todas las funciones y vistas (create or replace), en orden.
// 2) Repara los datos de texto, jsonb y text[] de los esquemas public y psr_privado.
// Uso: node scripts/generar-reparacion-tildes.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const raiz = new URL("../supabase/", import.meta.url);

/** Divide un archivo SQL en sentencias, respetando comillas, $$ y comentarios. */
function sentencias(sql) {
  const out = [];
  let ini = 0, i = 0;
  while (i < sql.length) {
    const c = sql[i], d = sql.slice(i, i + 2);
    if (d === "--") { i = sql.indexOf("\n", i); if (i < 0) i = sql.length; continue; }
    if (d === "/*") { i = sql.indexOf("*/", i) + 2; continue; }
    if (c === "'") { i++; while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") i += 2; else if (sql[i] === "'") { i++; break; } else i++; } continue; }
    if (d === "$$") { i = sql.indexOf("$$", i + 2) + 2; continue; }
    if (c === ";") { out.push(sql.slice(ini, i + 1)); ini = i + 1; }
    i++;
  }
  return out;
}
const sinComentarios = (s) => s.replace(/^\s*(--[^\n]*\n|\s)*/, "");

const objetos = [];
for (const f of readdirSync(new URL("migrations/", raiz)).filter((f) => f.endsWith(".sql")).sort()) {
  for (const s of sentencias(readFileSync(new URL(`migrations/${f}`, raiz), "utf8"))) {
    const t = sinComentarios(s);
    if (/^create\s+or\s+replace\s+(function|view)\b/i.test(t)) objetos.push(`-- ${f}\n${t}`);
  }
}

// Tabla Mac Roman: carácter que se ve → byte original (0x80–0xFF).
const mac = new TextDecoder("macintosh").decode(Uint8Array.from({ length: 128 }, (_, k) => 128 + k));
if ([...mac].length !== 128) throw new Error("tabla Mac Roman incompleta");

const sql = `-- =====================================================================
-- Reparación de tildes (generado por scripts/generar-reparacion-tildes.mjs)
-- Corrige el texto que llegó como "Pasi√≥n" en vez de "Pasión".
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================
begin;

-- 1) Funciones y vistas, otra vez y en orden (${objetos.length} objetos).
${objetos.join("\n\n")}

-- 2) Datos: convierte de vuelta solo el texto que tiene el daño.
create or replace function psr_privado.reparar_tildes_texto(t text) returns text
language plpgsql immutable as $$
declare
  v_mapa constant text := ${"'" + mac.replace(/'/g, "''") + "'"};
  v_hex text := '';
  c text;
  p int;
begin
  if t is null or t !~ '[¬√‚·ŒœÔ]' then return t; end if;
  foreach c in array regexp_split_to_array(t, '') loop
    if ascii(c) < 128 then v_hex := v_hex || lpad(to_hex(ascii(c)), 2, '0');
    else
      p := strpos(v_mapa, c);
      if p = 0 then return t; end if;  -- no es texto dañado: se deja igual
      v_hex := v_hex || to_hex(127 + p);
    end if;
  end loop;
  return convert_from(decode(v_hex, 'hex'), 'UTF8');
exception when others then
  return t;  -- si no es UTF-8 válido, no era texto dañado
end $$;

do $$
declare
  r record;
  n int;
  total int := 0;
begin
  for r in
    select c.table_schema s, c.table_name tb, c.column_name col, c.data_type dt, c.udt_name udt
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema in ('public', 'psr_privado')
      and (c.data_type in ('text', 'character varying', 'jsonb') or c.udt_name = '_text')
  loop
    if r.dt = 'jsonb' then
      execute format('update %I.%I set %I = psr_privado.reparar_tildes_texto(%I::text)::jsonb where %I::text ~ ''[¬√‚·ŒœÔ]''',
                     r.s, r.tb, r.col, r.col, r.col);
    elsif r.udt = '_text' then
      execute format('update %I.%I set %I = (select array_agg(psr_privado.reparar_tildes_texto(x) order by o) from unnest(%I) with ordinality u(x, o)) where array_to_string(%I, '' '') ~ ''[¬√‚·ŒœÔ]''',
                     r.s, r.tb, r.col, r.col, r.col);
    else
      execute format('update %I.%I set %I = psr_privado.reparar_tildes_texto(%I) where %I ~ ''[¬√‚·ŒœÔ]''',
                     r.s, r.tb, r.col, r.col, r.col);
    end if;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  raise notice 'Filas reparadas: %', total;
end $$;

drop function psr_privado.reparar_tildes_texto(text);

-- 3) Comprobación: debe decir "PSR Pasión Sobre Ruedas".
select valor ->> 'nombre' as nombre_del_taller from public.config_taller where clave = 'publico';

commit;
`;
writeFileSync(new URL("reparar_tildes.sql", raiz), sql);
console.log(`supabase/reparar_tildes.sql · ${objetos.length} funciones y vistas · ${sql.length} caracteres`);
