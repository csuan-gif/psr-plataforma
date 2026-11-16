-- =====================================================================
-- Datos semilla de PSR (GENERADO por scripts/generar-semillas.mjs: no editar a mano).
-- Los valores marcados -- EDITAR son de ejemplo y el taller debe ajustarlos.
-- =====================================================================

-- Catálogo público de zonas y síntomas (lenguaje del cliente)
insert into public.zonas (id, nombre, ayuda, orden) values
  ('motor', 'Motor', 'Bajo el capó', 0),
  ('refrigeracion', 'Refrigeración', 'Radiador, temperatura', 1),
  ('frenos', 'Frenos', 'Pedal, pastillas, discos', 2),
  ('direccion', 'Dirección y suspensión', 'Volante, amortiguadores', 3),
  ('llantas', 'Llantas', 'Ruedas y neumáticos', 4),
  ('transmision', 'Transmisión y embrague', 'Cambios, caja', 5),
  ('escape', 'Escape (exosto)', 'Tubo de atrás', 6),
  ('electrico', 'Eléctrico y tablero', 'Luces, batería, testigos', 7),
  ('aire', 'Aire acondicionado e interior', 'Cabina', 8),
  ('carroceria', 'Carrocería y pintura', 'Latas, golpes, rayones', 9),
  ('general', 'Mantenimiento o cotización', 'Revisión de rutina, precios, dudas', 10),
  ('nose', 'No sé', 'Te ayudamos a describirlo', 11)
on conflict (id) do update set nombre = excluded.nombre, ayuda = excluded.ayuda, orden = excluded.orden;

insert into public.sintomas (id, zona, etiqueta, orden) values
  ('frenos.chilla', 'frenos', 'Chilla o chirría al frenar', 0),
  ('frenos.pedal_blando', 'frenos', 'El pedal se siente blando o se hunde', 1),
  ('frenos.vibra', 'frenos', 'Vibra al frenar', 2),
  ('frenos.se_va_lado', 'frenos', 'Al frenar se va hacia un lado', 3),
  ('frenos.testigo', 'frenos', 'Se prendió la luz (testigo) de frenos', 4),
  ('frenos.ruido_metalico', 'frenos', 'Suena a metal contra metal al frenar', 5),
  ('frenos.olor_quemado', 'frenos', 'Huele a quemado cerca de las ruedas', 6),
  ('direccion.volante_duro', 'direccion', 'El volante se puso duro de repente', 7),
  ('direccion.no_responde', 'direccion', 'Siento que la dirección falla o no responde', 8),
  ('direccion.vibra_velocidad', 'direccion', 'El volante vibra cuando voy rápido', 9),
  ('direccion.golpes_huecos', 'direccion', 'Suena o golpea al pasar huecos', 10),
  ('direccion.se_va_lado', 'direccion', 'El carro se va hacia un lado', 11),
  ('direccion.ruido_girar', 'direccion', 'Hace ruido al girar', 12),
  ('direccion.ruido_metalico', 'direccion', 'Suena fuerte a metal al girar', 13),
  ('direccion.alineacion', 'direccion', 'Quiero alineación y balanceo', 14),
  ('motor.no_enciende', 'motor', 'No enciende', 15),
  ('motor.se_apaga_marcha', 'motor', 'Se apaga mientras voy andando', 16),
  ('motor.humo', 'motor', 'Sale humo del motor o del capó', 17),
  ('motor.pierde_fuerza', 'motor', 'Pierde fuerza o jalonea', 18),
  ('motor.check_engine', 'motor', 'Se prendió la luz amarilla del motor y anda normal', 19),
  ('motor.testigo_aceite', 'motor', 'Se prendió la luz roja del aceite', 20),
  ('motor.ruido', 'motor', 'Ruido o golpeteo en el motor', 21),
  ('motor.gasta_aceite', 'motor', 'Gasta aceite', 22),
  ('motor.olor_gasolina', 'motor', 'Huele fuerte a gasolina', 23),
  ('motor.fuga_abundante', 'motor', 'Bota mucho líquido (deja charco)', 24),
  ('motor.consumo_alto', 'motor', 'Gasta más combustible de lo normal', 25),
  ('motor.cambio_aceite', 'motor', 'Quiero cambio de aceite y filtros', 26),
  ('refrigeracion.temp_alta', 'refrigeracion', 'La temperatura sube o se recalienta', 27),
  ('refrigeracion.pierde_refrigerante', 'refrigeracion', 'Pierde refrigerante (agua del radiador)', 28),
  ('refrigeracion.ventilador', 'refrigeracion', 'El ventilador no prende', 29),
  ('electrico.testigo', 'electrico', 'Se prendió una luz en el tablero y el carro anda normal', 30),
  ('electrico.bateria', 'electrico', 'La batería se descarga', 31),
  ('electrico.luces', 'electrico', 'Las luces fallan', 32),
  ('electrico.vidrios', 'electrico', 'Los vidrios eléctricos fallan', 33),
  ('electrico.tablero', 'electrico', 'El tablero falla o se apaga', 34),
  ('electrico.arranque', 'electrico', 'Le cuesta arrancar', 35),
  ('electrico.intermitente', 'electrico', 'Falla a veces sí y a veces no', 36),
  ('electrico.humo_chispas', 'electrico', 'Sale humo o chispas de cables o del tablero', 37),
  ('transmision.cambios_duros', 'transmision', 'Los cambios entran duro', 38),
  ('transmision.patina', 'transmision', 'Acelero y no avanza bien (patina)', 39),
  ('transmision.ruido_cambios', 'transmision', 'Suena al hacer los cambios', 40),
  ('transmision.pedal_embrague', 'transmision', 'El pedal del embrague está alto o duro', 41),
  ('escape.ruido', 'escape', 'El exosto suena muy fuerte', 42),
  ('escape.humo', 'escape', 'Bota humo por el exosto', 43),
  ('escape.olor', 'escape', 'Huele raro el exosto', 44),
  ('escape.gases_cabina', 'escape', 'Huele a gases del exosto dentro del carro', 45),
  ('llantas.desgaste', 'llantas', 'Se gastan disparejo', 46),
  ('llantas.pinchazo', 'llantas', 'Pinchazo o pierde aire', 47),
  ('llantas.vibracion', 'llantas', 'El carro vibra', 48),
  ('aire.no_enfria', 'aire', 'El aire no enfría', 49),
  ('aire.mal_olor', 'aire', 'El aire huele mal', 50),
  ('aire.ruido', 'aire', 'El aire hace ruido', 51),
  ('carroceria.choque', 'carroceria', 'Tuve un choque reciente', 52),
  ('carroceria.rayon', 'carroceria', 'Tiene un rayón', 53),
  ('carroceria.golpe', 'carroceria', 'Tiene un golpe o abolladura', 54),
  ('carroceria.pintura', 'carroceria', 'La pintura se descascara o hay óxido', 55),
  ('nose.frenos_direccion', 'nose', 'Siento que los frenos o la dirección fallan', 56),
  ('nose.humo', 'nose', 'Sale humo', 57),
  ('nose.recalienta', 'nose', 'Se recalienta', 58),
  ('nose.ruido', 'nose', 'Suena raro', 59),
  ('nose.vibra', 'nose', 'Vibra', 60),
  ('nose.testigo', 'nose', 'Se prendió una luz en el tablero', 61),
  ('nose.intermitente', 'nose', 'Falla a veces sí y a veces no', 62),
  ('general.mantenimiento', 'general', 'Mantenimiento preventivo o revisión de rutina', 63),
  ('general.cotizacion', 'general', 'Quiero una cotización', 64),
  ('general.duda', 'general', 'Tengo una duda general', 65)
on conflict (id) do update set zona = excluded.zona, etiqueta = excluded.etiqueta, orden = excluded.orden;

-- Reglas del semáforo (Tabla 21 del informe 1.5, ampliadas). Editables por el admin.
insert into public.reglas_semaforo (tipo, valor, zona, color, nota) values
  ('movilidad', 'no', null, 'rojo', 'No puede movilizarse'),
  ('movilidad_zona', 'nose', 'frenos', 'rojo', '«No estoy seguro» en frenos o dirección'),
  ('movilidad_zona', 'nose', 'direccion', 'rojo', '«No estoy seguro» en frenos o dirección'),
  ('sintoma', 'frenos.chilla', null, 'amarillo', null),
  ('sintoma', 'frenos.pedal_blando', null, 'rojo', null),
  ('sintoma', 'frenos.vibra', null, 'amarillo', null),
  ('sintoma', 'frenos.se_va_lado', null, 'amarillo', null),
  ('sintoma', 'frenos.testigo', null, 'rojo', null),
  ('sintoma', 'frenos.ruido_metalico', null, 'rojo', null),
  ('sintoma', 'frenos.olor_quemado', null, 'amarillo', null),
  ('sintoma', 'direccion.volante_duro', null, 'rojo', null),
  ('sintoma', 'direccion.no_responde', null, 'rojo', null),
  ('sintoma', 'direccion.vibra_velocidad', null, 'amarillo', null),
  ('sintoma', 'direccion.golpes_huecos', null, 'amarillo', null),
  ('sintoma', 'direccion.se_va_lado', null, 'amarillo', null),
  ('sintoma', 'direccion.ruido_girar', null, 'amarillo', null),
  ('sintoma', 'direccion.ruido_metalico', null, 'rojo', null),
  ('sintoma', 'direccion.alineacion', null, 'verde', null),
  ('sintoma', 'motor.no_enciende', null, 'amarillo', null),
  ('sintoma', 'motor.se_apaga_marcha', null, 'rojo', null),
  ('sintoma', 'motor.humo', null, 'rojo', null),
  ('sintoma', 'motor.pierde_fuerza', null, 'amarillo', null),
  ('sintoma', 'motor.check_engine', null, 'amarillo', null),
  ('sintoma', 'motor.testigo_aceite', null, 'rojo', null),
  ('sintoma', 'motor.ruido', null, 'amarillo', null),
  ('sintoma', 'motor.gasta_aceite', null, 'amarillo', null),
  ('sintoma', 'motor.olor_gasolina', null, 'rojo', null),
  ('sintoma', 'motor.fuga_abundante', null, 'rojo', null),
  ('sintoma', 'motor.consumo_alto', null, 'amarillo', null),
  ('sintoma', 'motor.cambio_aceite', null, 'verde', null),
  ('sintoma', 'refrigeracion.temp_alta', null, 'rojo', null),
  ('sintoma', 'refrigeracion.pierde_refrigerante', null, 'amarillo', null),
  ('sintoma', 'refrigeracion.ventilador', null, 'amarillo', null),
  ('sintoma', 'electrico.testigo', null, 'amarillo', null),
  ('sintoma', 'electrico.bateria', null, 'amarillo', null),
  ('sintoma', 'electrico.luces', null, 'amarillo', null),
  ('sintoma', 'electrico.vidrios', null, 'amarillo', null),
  ('sintoma', 'electrico.tablero', null, 'amarillo', null),
  ('sintoma', 'electrico.arranque', null, 'amarillo', null),
  ('sintoma', 'electrico.intermitente', null, 'amarillo', null),
  ('sintoma', 'electrico.humo_chispas', null, 'rojo', null),
  ('sintoma', 'transmision.cambios_duros', null, 'amarillo', null),
  ('sintoma', 'transmision.patina', null, 'amarillo', null),
  ('sintoma', 'transmision.ruido_cambios', null, 'amarillo', null),
  ('sintoma', 'transmision.pedal_embrague', null, 'amarillo', null),
  ('sintoma', 'escape.ruido', null, 'amarillo', null),
  ('sintoma', 'escape.humo', null, 'amarillo', null),
  ('sintoma', 'escape.olor', null, 'amarillo', null),
  ('sintoma', 'escape.gases_cabina', null, 'rojo', null),
  ('sintoma', 'llantas.desgaste', null, 'amarillo', null),
  ('sintoma', 'llantas.pinchazo', null, 'amarillo', null),
  ('sintoma', 'llantas.vibracion', null, 'amarillo', null),
  ('sintoma', 'aire.no_enfria', null, 'amarillo', null),
  ('sintoma', 'aire.mal_olor', null, 'amarillo', null),
  ('sintoma', 'aire.ruido', null, 'amarillo', null),
  ('sintoma', 'carroceria.choque', null, 'amarillo', null),
  ('sintoma', 'carroceria.rayon', null, 'verde', null),
  ('sintoma', 'carroceria.golpe', null, 'verde', null),
  ('sintoma', 'carroceria.pintura', null, 'verde', null),
  ('sintoma', 'nose.frenos_direccion', null, 'rojo', null),
  ('sintoma', 'nose.humo', null, 'rojo', null),
  ('sintoma', 'nose.recalienta', null, 'rojo', null),
  ('sintoma', 'nose.ruido', null, 'amarillo', null),
  ('sintoma', 'nose.vibra', null, 'amarillo', null),
  ('sintoma', 'nose.testigo', null, 'amarillo', null),
  ('sintoma', 'nose.intermitente', null, 'amarillo', null),
  ('sintoma', 'general.mantenimiento', null, 'verde', null),
  ('sintoma', 'general.cotizacion', null, 'verde', null),
  ('sintoma', 'general.duda', null, 'verde', null),
  ('palabra', 'pedal blando', null, 'rojo', null),
  ('palabra', 'pedal esta blando', null, 'rojo', null),
  ('palabra', 'se hunde', null, 'rojo', null),
  ('palabra', 'no frena', null, 'rojo', null),
  ('palabra', 'sin frenos', null, 'rojo', null),
  ('palabra', 'se quedo sin freno', null, 'rojo', null),
  ('palabra', 'humo', null, 'rojo', null),
  ('palabra', 'recalient', null, 'rojo', null),
  ('palabra', 'sobrecalent', null, 'rojo', null),
  ('palabra', 'temperatura alta', null, 'rojo', null),
  ('palabra', 'se calienta', null, 'rojo', null),
  ('palabra', 'volante duro', null, 'rojo', null),
  ('palabra', 'perdi la direccion', null, 'rojo', null),
  ('palabra', 'direccion no responde', null, 'rojo', null),
  ('palabra', 'se fue la direccion', null, 'rojo', null),
  ('palabra', 'se apaga andando', null, 'rojo', null),
  ('palabra', 'se apago andando', null, 'rojo', null),
  ('palabra', 'se apaga en marcha', null, 'rojo', null),
  ('palabra', 'huele a gasolina', null, 'rojo', null),
  ('palabra', 'olor a gasolina', null, 'rojo', null),
  ('palabra', 'olor a combustible', null, 'rojo', null),
  ('palabra', 'charco', null, 'rojo', null),
  ('palabra', 'bota mucho', null, 'rojo', null),
  ('palabra', 'luz roja', null, 'rojo', null),
  ('palabra', 'testigo rojo', null, 'rojo', null),
  ('palabra', 'ruido', null, 'amarillo', null),
  ('palabra', 'chilla', null, 'amarillo', null),
  ('palabra', 'chirria', null, 'amarillo', null),
  ('palabra', 'suena', null, 'amarillo', null),
  ('palabra', 'traquea', null, 'amarillo', null),
  ('palabra', 'vibra', null, 'amarillo', null),
  ('palabra', 'golpeteo', null, 'amarillo', null),
  ('palabra', 'golpea', null, 'amarillo', null),
  ('palabra', 'luz', null, 'amarillo', null),
  ('palabra', 'testigo', null, 'amarillo', null),
  ('palabra', 'tablero', null, 'amarillo', null),
  ('palabra', 'check engine', null, 'amarillo', null),
  ('palabra', 'intermitente', null, 'amarillo', null),
  ('palabra', 'a veces', null, 'amarillo', null),
  ('palabra', 'falla', null, 'amarillo', null),
  ('palabra', 'jalonea', null, 'amarillo', null),
  ('palabra', 'no enfria', null, 'amarillo', null),
  ('palabra', 'no prende', null, 'amarillo', null),
  ('palabra', 'no enciende', null, 'amarillo', null),
  ('palabra', 'patina', null, 'amarillo', null),
  ('palabra', 'gasta mucho', null, 'amarillo', null)
on conflict (tipo, valor, zona) do nothing;

-- Disponibilidad por franja -- EDITAR horarios y cupos de recepción
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

-- 5 clientes FICTICIOS y los 10 casos C1 a C10 como solicitudes de ejemplo
with c as (insert into public.clientes (tipo_documento, numero_documento, nombre_razon_social, celular, autoriza_datos, autoriza_datos_fecha, autoriza_datos_version) values
  ('CC', '80123456', 'Andrés Camacho (ficticio)', '3001112233', true, now(), 'semilla'),
  ('CC', '52987654', 'Luisa Pardo (ficticia)', '3104445566', true, now(), 'semilla'),
  ('CC', '79555111', 'Carlos Rincón (ficticio)', '3157778899', true, now(), 'semilla'),
  ('CC', '1020304050', 'Diana Torres (ficticia)', '3201234567', true, now(), 'semilla'),
  ('NIT', '900373913', 'Transportes Ejemplo S.A.S. (ficticia)', '3009876543', true, now(), 'semilla')
  on conflict do nothing returning id, numero_documento)
insert into public.vehiculos (cliente_id, placa, marca, linea_modelo, anio_modelo, color, combustible_tipo, km_ultimo)
select c.id, v.placa, v.marca, v.linea, v.anio, v.color, v.comb, v.km from c join (values
  ('80123456', 'JKL123', 'Renault', 'Sandero', 2018, 'Gris', 'gasolina', 68000),
  ('52987654', 'MNP456', 'Chevrolet', 'Onix', 2021, 'Blanco', 'gasolina', 32000),
  ('79555111', 'QRS789', 'Mazda', 'Mazda 3', 2016, 'Rojo', 'gasolina', 98000),
  ('1020304050', 'TUV234', 'Kia', 'Picanto', 2019, 'Plata', 'gasolina', 54000),
  ('900373913', 'WXY567', 'Renault', 'Duster', 2020, 'Negro', 'diesel', 120000)
) v (doc, placa, marca, linea, anio, color, comb, km) on v.doc = c.numero_documento;

insert into public.solicitudes (codigo_seguimiento, cliente_id, vehiculo_id, zonas, sintomas, descripcion, puede_movilizarse, autoriza_presupuesto, autoriza_datos_en, autoriza_datos_version, canal, creado_en)
select x.codigo, v.cliente_id, v.id, x.zonas, x.sintomas, x.descr, x.mov, 'previo', now(), 'semilla', 'portal', now() - (x.n || ' hours')::interval from (values
  ('PSR-DEMO01', 'JKL123', array['general']::text[], array['general.mantenimiento']::text[], 'Mantenimiento preventivo a los 40.000 km; el vehículo se puede movilizar.', 'si', 10),
  ('PSR-DEMO02', 'MNP456', array['carroceria']::text[], array['carroceria.rayon', 'general.cotizacion']::text[], 'Cotización de pintura para un guardabarros rayado.', 'si', 9),
  ('PSR-DEMO03', 'QRS789', array['motor']::text[], array['motor.cambio_aceite']::text[], 'Cambio de aceite y filtros.', 'si', 8),
  ('PSR-DEMO04', 'TUV234', array['frenos']::text[], array['frenos.chilla']::text[], 'Chillido al frenar desde hace tres días; se puede movilizar.', 'si', 7),
  ('PSR-DEMO05', 'WXY567', array['electrico']::text[], array['electrico.testigo']::text[], 'Luz encendida en el tablero; el vehículo anda normal.', 'si', 6),
  ('PSR-DEMO06', 'JKL123', array['direccion']::text[], array['direccion.vibra_velocidad']::text[], 'El volante vibra a más de 80 km/h.', 'si', 5),
  ('PSR-DEMO07', 'MNP456', array['motor']::text[], array['motor.no_enciende']::text[], 'El vehículo no enciende y no se puede movilizar.', 'no', 4),
  ('PSR-DEMO08', 'QRS789', array['motor', 'refrigeracion']::text[], array['motor.humo', 'refrigeracion.temp_alta']::text[], 'Sale humo del motor y la temperatura está alta.', 'nose', 3),
  ('PSR-DEMO09', 'TUV234', array['frenos']::text[], array['frenos.pedal_blando']::text[], 'El pedal del freno se siente blando y se hunde.', 'nose', 2),
  ('PSR-DEMO10', 'WXY567', array['electrico']::text[], array['electrico.intermitente', 'electrico.luces', 'electrico.vidrios']::text[], 'Fallas eléctricas intermitentes en luces y vidrios.', 'si', 1)
) x (codigo, placa, zonas, sintomas, descr, mov, n) join public.vehiculos v on v.placa = x.placa
on conflict (codigo_seguimiento) do nothing;

-- Mantenimiento de ejemplo: vencimientos y un cambio de aceite próximo (FICTICIOS)
update public.vehiculos set fecha_soat = psr_privado.hoy() + 20, km_ultimo_fecha = psr_privado.hoy() - 90 where placa = 'JKL123';
update public.vehiculos set fecha_tecnomecanica = psr_privado.hoy() + 45 where placa = 'MNP456';
update public.vehiculos set km_ultimo_fecha = psr_privado.hoy() - 120 where placa = 'QRS789';
insert into public.recordatorios (vehiculo_id, servicio, fecha_estimada, km_estimado)
select id, 'Cambio de aceite y filtro (aceite sintético)', psr_privado.hoy() + 5, 100000 from public.vehiculos where placa = 'QRS789';

