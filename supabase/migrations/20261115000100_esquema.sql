-- =====================================================================
-- PSR Pasión Sobre Ruedas · 0001 · Esquema de datos
-- Todas las tablas con RLS (ver 0004). El semáforo vive en una tabla
-- aparte (triage_interno) para que nunca viaje junto a la solicitud.
-- =====================================================================

create schema if not exists psr_privado;
revoke all on schema psr_privado from public;

-- ---------- Personas del taller ----------
create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null check (rol in ('admin', 'tecnico')),
  especialidad text check (especialidad in ('mecanica', 'electrica', 'general')),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ---------- Clientes y vehículos ----------
create table public.clientes (
  id                     uuid primary key default gen_random_uuid(),
  tipo_documento         text not null check (tipo_documento in ('CC', 'CE', 'NIT', 'PAS')),
  numero_documento       text not null,
  digito_verificacion    text check (digito_verificacion ~ '^\d$'),
  nombre_razon_social    text not null,
  celular                text not null,
  correo                 text,
  direccion              text,
  barrio_municipio       text,
  autoriza_datos         boolean not null default false,
  autoriza_datos_fecha   timestamptz,
  autoriza_datos_version text,
  verificado             boolean not null default false, -- el taller confirmó la identidad en la recepción
  anonimizado_en         timestamptz,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  unique (tipo_documento, numero_documento)
);

create table public.vehiculos (
  id                      uuid primary key default gen_random_uuid(),
  cliente_id              uuid not null references public.clientes(id) on delete restrict,
  placa                   text not null unique check (placa ~ '^[A-Z0-9]{3,8}$'),
  marca                   text not null,
  linea_modelo            text,
  anio_modelo             smallint check (anio_modelo between 1950 and 2100),
  color                   text,
  vin                     text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  combustible_tipo        text check (combustible_tipo in ('gasolina', 'diesel', 'gas', 'hibrido', 'electrico', 'nose')),
  km_ultimo               integer check (km_ultimo >= 0),
  km_ultimo_fecha         date,
  fecha_soat              date,
  fecha_tecnomecanica     date,
  foto_tarjeta_propiedad  text,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now()
);
create index on public.vehiculos (cliente_id);

-- ---------- Catálogo público (lenguaje del cliente, SIN colores) ----------
create table public.zonas (
  id      text primary key,
  nombre  text not null,
  ayuda   text not null default '',
  orden   smallint not null default 0,
  activo  boolean not null default true
);
create table public.sintomas (
  id        text primary key,
  zona      text not null references public.zonas(id),
  etiqueta  text not null,
  orden     smallint not null default 0,
  activo    boolean not null default true
);

-- ---------- Reglas del semáforo (PRIVADAS, editables por el admin) ----------
create table public.reglas_semaforo (
  id      bigint generated always as identity primary key,
  tipo    text not null check (tipo in ('sintoma', 'palabra', 'movilidad', 'movilidad_zona')),
  valor   text not null,              -- id del síntoma, palabra clave o valor de movilidad
  zona    text,                       -- solo para movilidad_zona
  color   text not null check (color in ('rojo', 'amarillo', 'verde')),
  nota    text,
  activo  boolean not null default true,
  unique nulls not distinct (tipo, valor, zona)
);

-- ---------- Solicitudes ----------
create table public.solicitudes (
  id                   uuid primary key default gen_random_uuid(),
  codigo_seguimiento   text not null unique,
  cliente_id           uuid not null references public.clientes(id) on delete restrict,
  vehiculo_id          uuid not null references public.vehiculos(id) on delete restrict,
  datos_reportados     jsonb not null default '{}',  -- lo que escribió el cliente (no sobrescribe la ficha)
  zonas                text[] not null default '{}',
  sintomas             text[] not null default '{}',
  descripcion          text not null default '' check (length(descripcion) <= 1500),
  puede_movilizarse    text not null check (puede_movilizarse in ('si', 'no', 'nose')),
  desde_cuando         text,
  km_reportado         integer check (km_reportado >= 0),
  adjuntos             jsonb not null default '[]',
  nota_voz_url         text,
  franja_preferida     text,
  autoriza_presupuesto text not null check (autoriza_presupuesto in ('previo', 'sin_presupuesto')),
  autoriza_prueba_ruta boolean not null default false,
  autoriza_datos_en    timestamptz not null,
  autoriza_datos_version text not null,
  estado               text not null default 'nueva' check (estado in ('nueva', 'en_revision', 'atendida', 'convertida', 'descartada')),
  canal                text not null default 'portal' check (canal in ('portal', 'qr', 'recordatorio', 'taller')),
  origen_hash          text,  -- hash de la IP (para límites anti-abuso), nunca la IP
  creado_en            timestamptz not null default now()
);
create index on public.solicitudes (creado_en desc);
create index on public.solicitudes (vehiculo_id);

-- Semáforo: tabla separada y solo legible por el taller.
create table public.triage_interno (
  solicitud_id   uuid primary key references public.solicitudes(id) on delete cascade,
  semaforo_auto  text not null check (semaforo_auto in ('rojo', 'amarillo', 'verde')),
  semaforo_final text not null check (semaforo_final in ('rojo', 'amarillo', 'verde')),
  razones        jsonb not null default '[]',
  motivo_cambio  text,
  cambiado_por   uuid references public.perfiles(id),
  cambiado_en    timestamptz,
  calculado_en   timestamptz not null default now()
);
create table public.cambios_semaforo (
  id            bigint generated always as identity primary key,
  solicitud_id  uuid not null references public.solicitudes(id) on delete cascade,
  de            text not null,
  a             text not null,
  motivo        text not null,
  usuario       uuid references public.perfiles(id),
  fecha         timestamptz not null default now()
);

-- ---------- Agenda ----------
create table public.disponibilidad (
  dia_semana  smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  franja      text not null check (franja in ('manana', 'tarde')),
  hora_inicio time not null,
  hora_fin    time not null,
  cupos       smallint not null default 0 check (cupos >= 0),
  activo      boolean not null default true,
  primary key (dia_semana, franja)
);
create table public.dias_bloqueados (
  id      bigint generated always as identity primary key,
  fecha   date not null,
  franja  text check (franja in ('manana', 'tarde')), -- null = todo el día
  motivo  text
);
create table public.festivos (
  fecha   date primary key,
  nombre  text not null
);
create table public.citas (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes(id) on delete cascade,
  fecha           date not null,
  franja          text not null check (franja in ('manana', 'tarde')),
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'reprogramada', 'cancelada', 'no_asistio')),
  confirmada_por  uuid references public.perfiles(id),
  confirmada_en   timestamptz,
  notas           text,
  creado_en       timestamptz not null default now()
);
create index on public.citas (fecha, franja) where estado in ('pendiente', 'confirmada', 'reprogramada');

-- ---------- Recepción y órdenes (se usan desde la Fase 3) ----------
create table public.recepciones (
  id                                uuid primary key default gen_random_uuid(),
  solicitud_id                      uuid references public.solicitudes(id) on delete set null,
  vehiculo_id                       uuid not null references public.vehiculos(id) on delete restrict,
  fecha_hora                        timestamptz not null default now(),
  km_ingreso                        integer check (km_ingreso >= 0),
  nivel_combustible                 numeric(4, 3) check (nivel_combustible between 0 and 1), -- pasos de 1/8
  checklist                         jsonb not null default '{}',
  mapa_danos                        jsonb not null default '[]',
  objetos_personales                text,
  accesorios                        text,
  fotos                             jsonb not null default '[]',
  video_inspeccion_url              text,
  autoriza_presupuesto_previo       boolean,
  autoriza_reparar_sin_presupuesto  boolean,
  autoriza_prueba_ruta              boolean,
  observaciones                     text,
  firma_cliente_url                 text,
  recibido_por                      uuid references public.perfiles(id)
);
create table public.ordenes_trabajo (
  id                  uuid primary key default gen_random_uuid(),
  recepcion_id        uuid not null references public.recepciones(id) on delete restrict,
  estado              text not null default 'recibido' check (estado in ('recibido', 'en_diagnostico', 'esperando_aprobacion', 'en_reparacion', 'en_prueba', 'listo', 'entregado', 'cancelado')),
  tecnico_asignado    uuid references public.perfiles(id),
  trabajos            jsonb not null default '[]',
  presupuesto_total   numeric(12, 2),
  presupuesto_estado  text not null default 'no_requerido' check (presupuesto_estado in ('no_requerido', 'pendiente', 'aprobado', 'rechazado')),
  fecha_aprobacion    timestamptz,
  fecha_entrega       timestamptz,
  km_salida           integer,
  garantia_hasta      date,
  creado_en           timestamptz not null default now()
);
create table public.historial_estados (
  id        bigint generated always as identity primary key,
  orden_id  uuid not null references public.ordenes_trabajo(id) on delete cascade,
  estado    text not null,
  fecha     timestamptz not null default now(),
  usuario   uuid references public.perfiles(id),
  nota      text
);

-- ---------- Mantenimiento preventivo (Fase 4) ----------
create table public.planes_mantenimiento (
  id               bigint generated always as identity primary key,
  servicio         text not null,
  intervalo_km     integer,
  intervalo_meses  smallint,
  aplica_a         text not null default 'todos' check (aplica_a in ('todos', 'gasolina', 'diesel', 'gas', 'hibrido', 'electrico')),
  nota             text,
  activo           boolean not null default true
);
create table public.recordatorios (
  id              uuid primary key default gen_random_uuid(),
  vehiculo_id     uuid not null references public.vehiculos(id) on delete cascade,
  servicio        text not null,
  fecha_estimada  date,
  km_estimado     integer,
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'agendado', 'descartado')),
  enviado_en      timestamptz,
  canal           text,
  creado_en       timestamptz not null default now()
);

-- ---------- Configuración, auditoría y límites ----------
create table public.config_taller (
  clave  text primary key,
  valor  jsonb not null
);
create table public.auditoria (
  id        bigint generated always as identity primary key,
  usuario   uuid,                 -- null = portal público
  accion    text not null,        -- crear, ver, actualizar, anonimizar...
  tabla     text not null,
  registro  text,
  detalle   jsonb,
  fecha     timestamptz not null default now()
);
create table psr_privado.intentos (
  clave     text not null,
  creado_en timestamptz not null default now()
);
create index on psr_privado.intentos (clave, creado_en);
