// Genera supabase/seed.sql y supabase/tests/01_semaforo.sql a partir de los
// mismos JSON que usa la app, para que catálogo, reglas y casos no se desincronicen.
// Uso: npm run semillas
import { readFileSync, writeFileSync } from "node:fs";

const leer = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const cat = leer("src/compartido/catalogo/sintomas.json");
const reglas = leer("src/demo/reglas.json");
const casos = leer("tests/casos.json");
const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(", ")}]::text[]`;

const L = [];
L.push("-- =====================================================================");
L.push("-- Datos semilla de PSR (GENERADO por scripts/generar-semillas.mjs: no editar a mano).");
L.push("-- Los valores marcados -- EDITAR son de ejemplo y el taller debe ajustarlos.");
L.push("-- =====================================================================", "");

L.push("-- Catálogo público de zonas y síntomas (lenguaje del cliente)");
L.push("insert into public.zonas (id, nombre, ayuda, orden) values");
L.push(cat.zonas.map((z, i) => `  (${q(z.id)}, ${q(z.nombre)}, ${q(z.ayuda)}, ${i})`).join(",\n") + "\non conflict (id) do update set nombre = excluded.nombre, ayuda = excluded.ayuda, orden = excluded.orden;", "");
L.push("insert into public.sintomas (id, zona, etiqueta, orden) values");
L.push(cat.sintomas.map((s, i) => `  (${q(s.id)}, ${q(s.zona)}, ${q(s.etiqueta)}, ${i})`).join(",\n") + "\non conflict (id) do update set zona = excluded.zona, etiqueta = excluded.etiqueta, orden = excluded.orden;", "");

L.push("-- Reglas del semáforo (Tabla 21 del informe 1.5, ampliadas). Editables por el admin.");
const R = [];
for (const [valor, color] of Object.entries(reglas.movilidad)) R.push(["movilidad", valor, null, color, "No puede movilizarse"]);
for (const z of reglas.noSeguroEnZonas) R.push(["movilidad_zona", "nose", z, "rojo", "«No estoy seguro» en frenos o dirección"]);
for (const [valor, color] of Object.entries(reglas.sintomas)) R.push(["sintoma", valor, null, color, null]);
for (const c of ["rojo", "amarillo"]) for (const w of reglas.palabras[c]) R.push(["palabra", w, null, c, null]);
L.push("insert into public.reglas_semaforo (tipo, valor, zona, color, nota) values");
L.push(R.map((r) => `  (${r.map(q).join(", ")})`).join(",\n") + "\non conflict (tipo, valor, zona) do nothing;", "");

L.push(`-- Disponibilidad por franja -- EDITAR horarios y cupos de recepción
insert into public.disponibilidad (dia_semana, franja, hora_inicio, hora_fin, cupos) values
  (1, 'manana', '07:30', '12:00', 3), (1, 'tarde', '13:00', '17:00', 3),
  (2, 'manana', '07:30', '12:00', 3), (2, 'tarde', '13:00', '17:00', 3),
  (3, 'manana', '07:30', '12:00', 3), (3, 'tarde', '13:00', '17:00', 3),
  (4, 'manana', '07:30', '12:00', 3), (4, 'tarde', '13:00', '17:00', 3),
  (5, 'manana', '07:30', '12:00', 3), (5, 'tarde', '13:00', '17:00', 3),
  (6, 'manana', '08:00', '13:00', 2)
on conflict do nothing;

-- Festivos de Colombia del año en curso y el siguiente (Ley Emiliani)
insert into public.festivos (fecha, nombre)
select f.fecha, f.nombre from generate_series(extract(year from now())::int, extract(year from now())::int + 1) y,
     lateral psr_privado.festivos_colombia(y) f
on conflict do nothing;

-- Datos del taller -- EDITAR
insert into public.config_taller (clave, valor) values
  ('taller', '{"nombre": "PSR Pasión Sobre Ruedas", "whatsapp": "573000000000", "telefono": "+57 300 000 0000", "correo": "contacto@ejemplo.com", "direccion": "Barrio Santa María del Lago, Engativá, Bogotá"}'),
  ('aviso_privacidad_version', '"2026-11-v1"'),
  ('plantillas_whatsapp', '{"confirmar": "Hola {nombre}, te confirmamos la cita para tu {vehiculo} ({placa}) el {fecha} en la {franja}. Código: {codigo}.", "reprogramar": "Hola {nombre}, necesitamos mover tu cita del {fecha}. ¿Te sirve {nueva_fecha} en la {franja}?", "recibida": "Hola {nombre}, recibimos tu solicitud {codigo}. Te escribimos pronto."}')
on conflict (clave) do nothing;

-- Planes de mantenimiento de REFERENCIA.
-- EDITAR según criterio del taller y el manual de cada fabricante.
insert into public.planes_mantenimiento (servicio, intervalo_km, intervalo_meses, aplica_a, nota) values
  ('Cambio de aceite y filtro (aceite mineral)',     5000,  6, 'todos',    'EDITAR: depende del tipo de aceite'),
  ('Cambio de aceite y filtro (aceite sintético)',   10000, 12, 'todos',   'EDITAR: usar uno de los dos según el aceite del vehículo'),
  ('Filtro de aire',                                 10000, 12, 'todos',   'EDITAR'),
  ('Filtro de combustible',                          20000, 24, 'gasolina','EDITAR'),
  ('Filtro de combustible (diésel)',                 10000, 12, 'diesel',  'EDITAR'),
  ('Filtro de cabina (polen)',                       15000, 12, 'todos',   'EDITAR'),
  ('Revisión de frenos',                             10000, 12, 'todos',   'EDITAR'),
  ('Cambio de líquido de frenos',                    40000, 24, 'todos',   'EDITAR'),
  ('Cambio de refrigerante',                         40000, 24, 'todos',   'EDITAR'),
  ('Alineación y balanceo',                          10000, 12, 'todos',   'EDITAR'),
  ('Rotación de llantas',                            10000, 12, 'todos',   'EDITAR'),
  ('Bujías',                                         30000, 36, 'gasolina','EDITAR: iridio suele ser mayor'),
  ('Correa de accesorios',                           40000, 48, 'todos',   'EDITAR'),
  ('Correa de repartición (distribución)',           60000, 60, 'todos',   'EDITAR: crítica, seguir el manual del fabricante'),
  ('Revisión de batería',                            null,  24, 'todos',   'EDITAR'),
  ('Sincronización',                                 20000, 12, 'gasolina','EDITAR'),
  ('Escáner preventivo',                             10000, 12, 'todos',   'EDITAR');
`);

L.push("-- 5 clientes FICTICIOS y los 10 casos C1 a C10 como solicitudes de ejemplo");
const CLIENTES = [
  ["CC", "80123456", "Andrés Camacho (ficticio)", "3001112233", "JKL123", "Renault", "Sandero", 2018, "Gris", "gasolina", 68000],
  ["CC", "52987654", "Luisa Pardo (ficticia)", "3104445566", "MNP456", "Chevrolet", "Onix", 2021, "Blanco", "gasolina", 32000],
  ["CC", "79555111", "Carlos Rincón (ficticio)", "3157778899", "QRS789", "Mazda", "Mazda 3", 2016, "Rojo", "gasolina", 98000],
  ["CC", "1020304050", "Diana Torres (ficticia)", "3201234567", "TUV234", "Kia", "Picanto", 2019, "Plata", "gasolina", 54000],
  ["NIT", "900373913", "Transportes Ejemplo S.A.S. (ficticia)", "3009876543", "WXY567", "Renault", "Duster", 2020, "Negro", "diesel", 120000],
];
L.push("with c as (insert into public.clientes (tipo_documento, numero_documento, nombre_razon_social, celular, autoriza_datos, autoriza_datos_fecha, autoriza_datos_version) values");
L.push(CLIENTES.map((c) => `  (${q(c[0])}, ${q(c[1])}, ${q(c[2])}, ${q(c[3])}, true, now(), 'semilla')`).join(",\n"));
L.push("  on conflict do nothing returning id, numero_documento)");
L.push("insert into public.vehiculos (cliente_id, placa, marca, linea_modelo, anio_modelo, color, combustible_tipo, km_ultimo)");
L.push("select c.id, v.placa, v.marca, v.linea, v.anio, v.color, v.comb, v.km from c join (values");
L.push(CLIENTES.map((c) => `  (${q(c[1])}, ${q(c[4])}, ${q(c[5])}, ${q(c[6])}, ${c[7]}, ${q(c[8])}, ${q(c[9])}, ${c[10]})`).join(",\n"));
L.push(") v (doc, placa, marca, linea, anio, color, comb, km) on v.doc = c.numero_documento;", "");
L.push("insert into public.solicitudes (codigo_seguimiento, cliente_id, vehiculo_id, zonas, sintomas, descripcion, puede_movilizarse, autoriza_presupuesto, autoriza_datos_en, autoriza_datos_version, canal, creado_en)");
L.push("select x.codigo, v.cliente_id, v.id, x.zonas, x.sintomas, x.descr, x.mov, 'previo', now(), 'semilla', 'portal', now() - (x.n || ' hours')::interval from (values");
L.push(casos.casos.map((c, i) => `  (${q("PSR-DEMO" + String(i + 1).padStart(2, "0"))}, ${q(CLIENTES[i % 5][4])}, ${arr(c.entrada.zonas)}, ${arr(c.entrada.sintomas)}, ${q(c.texto)}, ${q(c.entrada.movilidad)}, ${10 - i})`).join(",\n"));
L.push(") x (codigo, placa, zonas, sintomas, descr, mov, n) join public.vehiculos v on v.placa = x.placa");
L.push("on conflict (codigo_seguimiento) do nothing;", "");
L.push(`-- Mantenimiento de ejemplo: vencimientos y un cambio de aceite próximo (FICTICIOS)
update public.vehiculos set fecha_soat = psr_privado.hoy() + 20, km_ultimo_fecha = psr_privado.hoy() - 90 where placa = 'JKL123';
update public.vehiculos set fecha_tecnomecanica = psr_privado.hoy() + 45 where placa = 'MNP456';
update public.vehiculos set km_ultimo_fecha = psr_privado.hoy() - 120 where placa = 'QRS789';
insert into public.recordatorios (vehiculo_id, servicio, fecha_estimada, km_estimado)
select id, 'Cambio de aceite y filtro (aceite sintético)', psr_privado.hoy() + 5, 100000 from public.vehiculos where placa = 'QRS789';
`);
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), L.join("\n") + "\n");

// Pruebas del semáforo en el servidor: mismos casos que Vitest.
const T = ["-- GENERADO por scripts/generar-semillas.mjs. Prueba el semáforo SQL con tests/casos.json.", ""];
for (const c of [...casos.casos, ...casos.extra]) {
  const e = c.entrada;
  T.push(`do $$ declare v text := psr_privado.clasificar(${arr(e.zonas)}, ${arr(e.sintomas)}, ${q(e.descripcion)}, ${q(e.movilidad)}) ->> 'color';
begin if v is distinct from ${q(c.esperado)} then raise exception 'FALLA ${c.id}: esperado ${c.esperado}, obtuvo %', v; end if; end $$;`);
}
T.push(`-- Los semillas C1..C10 deben quedar con el color esperado en triage_interno (vía trigger)
do $$ declare r record; begin
  for r in select s.codigo_seguimiento, t.semaforo_auto from public.solicitudes s join public.triage_interno t on t.solicitud_id = s.id where s.codigo_seguimiento like 'PSR-DEMO%' loop
    if (r.codigo_seguimiento, r.semaforo_auto) not in (${casos.casos.map((c, i) => `('PSR-DEMO${String(i + 1).padStart(2, "0")}', ${q(c.esperado)})`).join(", ")}) then
      raise exception 'FALLA semilla %: color %', r.codigo_seguimiento, r.semaforo_auto; end if;
  end loop;
  if (select count(*) from public.triage_interno) < 10 then raise exception 'FALLA: faltan triages de la semilla'; end if;
end $$;`);
writeFileSync(new URL("../supabase/tests/01_semaforo.sql", import.meta.url), T.join("\n") + "\n");
console.log(`✓ seed.sql: ${cat.zonas.length} zonas, ${cat.sintomas.length} síntomas, ${R.length} reglas, ${casos.casos.length} casos · 01_semaforo.sql: ${casos.casos.length + casos.extra.length} pruebas`);
