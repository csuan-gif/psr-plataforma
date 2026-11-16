# PSR Pasión Sobre Ruedas · Plataforma de recepción, agenda y mantenimiento

Plataforma web gratuita para el taller PSR, en Engativá (Bogotá). Funciona desde el celular y no hay que instalar nada, aunque se puede instalar como app. Tiene dos caras:

- **Portal del cliente:**
  - Pedir revisión o cita, describiendo la falla con un mapa del carro, fotos, video o voz.
  - Elegir día y franja según los cupos reales.
  - Ver en qué va su vehículo y aprobar el presupuesto.
  - Consultar su mantenimiento, el SOAT y la revisión técnico-mecánica.
- **Panel del taller:**
  - Bandeja en vivo con el semáforo interno, que el cliente nunca ve.
  - Agenda con cupos.
  - Acta de ingreso firmada en pantalla, con PDF.
  - Tablero de órdenes con las reglas de presupuesto, prueba de ruta y entrega.
  - Base de clientes con historial, e importación y exportación de Excel.
  - Recordatorios de mantenimiento por WhatsApp.

> **Guías de una página:** [para Javier y el taller](docs/guia_rapida_taller.md) · [para el cliente](docs/guia_rapida_cliente.md)
> **Pendientes y riesgos:** [docs/PENDIENTES.md](docs/PENDIENTES.md) · **Aviso de privacidad (borrador):** [docs/aviso_privacidad_BORRADOR.md](docs/aviso_privacidad_BORRADOR.md)

---

## 1. Probar la demostración (2 minutos, sin internet ni cuentas)

La demo usa datos ficticios guardados solo en el navegador. Sirve para presentaciones en clase.

1. Instala **Node.js 22 o superior** desde https://nodejs.org (botón "LTS").
2. Abre una terminal en esta carpeta y ejecuta:
   ```bash
   npm install
   npm run dev:demo
   ```
3. Abre http://localhost:5173.

| Para ver… | Ve a… |
|---|---|
| El portal del cliente | `/` y toca «Solicitar revisión o cita» |
| El panel del taller | `/taller`: entra como Javier (administrador), Mecánico o Eléctrico, sin contraseña |
| El tiempo real | Abre `/taller` en dos pestañas con usuarios distintos y el portal en una tercera; envía una solicitud |
| La consulta del cliente | `/consultar` con `PSR-DEMO05` y `3913` (tiene un presupuesto para aprobar) |
| Mi mantenimiento | `/mantenimiento` con placa `JKL123`, documento `3456` y celular `2233` |
| El modo de prueba con usuarios | `/?modo=prueba`: cronómetro, errores, retrocesos e intención de uso |

---

## 2. Publicarla de verdad (paso a paso, sin programar)

Necesitas un correo y unos 45 minutos. Todo es gratis.

### Paso 1 · Crear el proyecto en Supabase (la base de datos)
1. Entra a https://supabase.com, crea una cuenta y toca **New project**.
2. Nombre: `psr-taller`. **Database password:** genera una y **guárdala** en un lugar seguro. **Region:** *South America (São Paulo)*, la más cercana a Colombia.
3. Espera unos 2 minutos a que el proyecto quede listo.

> 📸 *Captura sugerida: pantalla "Create a new project" con la región São Paulo.*

### Paso 2 · Crear las tablas y la seguridad
1. En el menú izquierdo abre **SQL Editor** → **New query**.
2. Abre en tu computador la carpeta `supabase/migrations/`. Copia el contenido del **primer** archivo (`…000100_esquema.sql`), pégalo y toca **Run**. Debe decir *Success*.
3. Repite **en orden** con los 8 archivos, del `000100` al `000800`.
4. Por último, ejecuta igual el archivo `supabase/seed.sql`. Carga el catálogo de síntomas, las reglas del semáforo, los horarios, los festivos y 5 clientes **ficticios** de ejemplo.

> Si algún archivo da error, no sigas: copia el mensaje y pide ayuda. No ejecutes un archivo dos veces.
> Los clientes ficticios (`PSR-DEMO…`) se pueden borrar después desde *Table Editor*.

> 📸 *Captura sugerida: SQL Editor con "Success. No rows returned".*

### Paso 3 · Ajustes de seguridad del proyecto
1. **Authentication → Sign In / Providers → Email:** deja **activo** el ingreso con correo y **desactiva "Allow new users to sign up"**. Así solo el taller crea las cuentas.
2. **Realtime → Settings:** deja **activos los canales privados**. Si existe la opción de solo canales privados, puedes activarla. Esto permite que el taller vea quién está mirando cada solicitud.

### Paso 4 · Crear el usuario de Javier
1. **Authentication → Users → Add user → Create new user.** Escribe el correo y una contraseña segura de Javier, y marca **Auto Confirm User**.
2. Copia el **UID** del usuario creado (columna *UID*).
3. En **SQL Editor** ejecuta, reemplazando `ID-COPIADO`:
   ```sql
   insert into public.perfiles (id, nombre, rol) values ('ID-COPIADO', 'Javier Montoya', 'admin');
   ```
4. Los técnicos se agregan después desde la app, en **Ajustes → Usuarios**: primero se crea su cuenta en el punto 1 y luego se les da acceso con su correo.

> 📸 *Captura sugerida: Authentication → Users con el UID resaltado.*

### Paso 5 · Copiar las dos claves del proyecto
En **Project Settings → API** copia:
- **Project URL** (algo como `https://abcd.supabase.co`).
- **anon / publishable key** (la clave **pública**).

> ⚠️ **Nunca** uses ni compartas la `service_role` (secret) key. Esa clave salta toda la seguridad.

### Paso 6 · Publicar gratis en Netlify
**Opción A (recomendada, con GitHub):**
1. Sube esta carpeta a un repositorio de GitHub. Si ya tienen `psr-triage`, puede ser ese mismo.
2. En https://app.netlify.com: **Add new site → Import an existing project → GitHub** y elige el repositorio. Netlify toma la configuración de `netlify.toml`.
3. En **Site configuration → Environment variables** agrega:
   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | la Project URL del paso 5 |
   | `VITE_SUPABASE_ANON_KEY` | la clave pública del paso 5 |
   | `VITE_DEMO` | `false` |
4. Toca **Deploy**. Netlify te da una dirección como `https://psr-taller.netlify.app`. Puedes cambiar el nombre en *Domain management*.

**Opción B (sin GitHub):**
1. En tu computador, copia `.env.example` como `.env` y pon allí los valores del paso 5.
2. Ejecuta `npm install` y luego `npm run build`.
3. Arrastra la carpeta `dist` a https://app.netlify.com/drop.

> 📸 *Captura sugerida: Environment variables en Netlify con las tres variables.*

### Paso 7 · Primer ingreso de Javier
1. Abre `https://TU-SITIO.netlify.app/taller` y entra con su correo y contraseña.
2. En **Ajustes**, revisa y completa:
   - **Datos del taller:** WhatsApp, teléfono, dirección, enlace de Google Maps, horarios, y para el aviso de privacidad: responsable, NIT, plazo de conservación y región.
   - **Agenda y mensajes:** cupos por franja, días cerrados y plantillas de WhatsApp.
   - **Semáforo** y **Síntomas:** revísalos con tu criterio. Hay un probador para ensayar casos.
   - **Mantenimiento → Plan de mantenimiento:** ajusta los intervalos según tu criterio y el manual de cada fabricante.
3. Lee el **aviso de privacidad** (`/privacidad`). Es un **borrador**: revísalo antes de abrir el portal a los clientes.

### Paso 8 · Código QR y WhatsApp
- **Ajustes → Cartel QR:** escribe la dirección pública del sitio y toca **Imprimir cartel**. Pégalo en la recepción.
- En **WhatsApp Business**, en el *mensaje de bienvenida*, agrega: «Para pedir tu cita o ver cómo va tu carro: https://TU-SITIO.netlify.app».

### Paso 9 · Instalar el panel en el celular de Javier
- **Android (Chrome):** abre `/taller` y toca **📲 Instalar app**. Queda el ícono «PSR Taller».
- **iPhone (Safari):** abre `/taller`, toca **Compartir** y luego **Agregar a inicio**.
- Toca **Activar avisos** para recibir notificación y sonido cuando llegue una solicitud, con la app abierta.

### Paso 10 (opcional) · Limpieza semanal de archivos
La función `supabase/functions/limpieza` hace dos cosas: borra las fotos que se subieron sin que se enviara la solicitud, y borra los archivos de los clientes que pidieron la supresión de sus datos. Para programarla, sigue las instrucciones de `supabase/programar_limpieza.sql` (requiere la herramienta `supabase`, de línea de comandos).

---

## 3. Cuidados del plan gratuito
- **Supabase pausa el proyecto si pasa 7 días sin uso.** Con el uso diario no ocurre. Si pasa, entra a supabase.com y toca **Restore project**.
- **El almacenamiento gratuito es de 1 GB.** Las fotos se comprimen; los videos, no. Si se llena, borra videos antiguos desde *Storage*.
- **Copias de seguridad:** el plan gratuito no ofrece copias descargables. Exporta los clientes a Excel cada mes (**Clientes → ⬇ Excel**) y guarda el archivo en un lugar seguro.

---

## 4. Para desarrolladores

| Comando | Para qué |
|---|---|
| `npm run dev:demo` / `npm run dev` | App en modo demo o conectada a Supabase (`.env`) |
| `npm test` | Pruebas unitarias: semáforo C1–C10, reglas de órdenes, mantenimiento, Excel, festivos y validaciones |
| `npm run test:sql` | Migraciones y pruebas SQL de seguridad, en Postgres embebido (PGlite, sin Docker) |
| `npm run test:e2e` | Punta a punta con el Google Chrome instalado: cliente → bandeja en vivo → acta → entrega → recordatorio, más la PWA |
| `npm run build` | Compila y **verifica que nada del semáforo llegue al navegador del cliente** |
| `npm run verificar` | Todo lo anterior en orden |
| `npm run semillas` | Regenera `supabase/seed.sql` desde el catálogo y las reglas |

```
src/cliente/      Portal del cliente
src/taller/       Panel del taller (se descarga aparte, solo en /taller)
src/compartido/   Configuración, catálogo, utilidades, acceso a datos, componentes
src/demo/         Modo demo, con motor y reglas del semáforo (no se compila en producción)
supabase/         Migraciones, semilla, pruebas SQL y Edge Function de limpieza
tests/ · e2e/     Pruebas unitarias y de punta a punta
scripts/          Semillas, verificador del bundle, pruebas SQL y cabeceras de seguridad
```

**Reglas que el código hace cumplir:**
1. **Semáforo solo en el servidor.** La tabla `triage_interno` solo la lee el taller, y el verificador revisa lo que descarga el portal.
2. **Aviso de seguridad sin colores** para frenos, dirección o un vehículo que no se moviliza.
3. **Ninguna cita se confirma sola.**
4. **WhatsApp solo por enlaces `wa.me`.**
5. **Datos personales protegidos:**
   - RLS en todas las tablas y roles mínimos.
   - Auditoría de lectura y cambios, límites de intentos y campo trampa contra robots.
   - Supresión de datos y CSP estricta.
6. **Costo cero.**
