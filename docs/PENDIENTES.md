# Pendientes y riesgos

## Resumen para el taller (lo que hay que hacer antes de abrir el portal)
1. **Completar los datos reales** en *Ajustes → Datos del taller*: WhatsApp, teléfono, dirección, enlace de Maps, horarios, NIT y plazo de conservación. También el color de marca o el logo, si se quiere cambiar el rojo actual (`src/index.css`).
2. **Revisar con un abogado el aviso de privacidad** (`/privacidad` y `docs/aviso_privacidad_BORRADOR.md`), y decidir si se requiere inscripción en el RNBD.
3. **Revisar con Javier:** las reglas del semáforo (*Ajustes → Semáforo*, con el probador), los síntomas, los intervalos del plan de mantenimiento y los cupos por franja.
4. **Pedir la autorización de datos** a los clientes que se importen del Excel (quedan marcados «sin autorización»). El alta rápida en el taller la registra.
5. **Repetir la prueba con usuarios** (`?modo=prueba`) para cerrar las hipótesis inconclusas del informe: HA, HB-1, HC-1 y HD-2.

## Lo que NO se ha probado en un Supabase real
Todo lo de base de datos se probó en PGlite (Postgres embebido) con una simulación mínima de Supabase: 6 baterías SQL. Lo de la app se probó en modo demo: pruebas unitarias, 3 pruebas de punta a punta con Chrome y auditoría de accesibilidad. **Falta una pasada sobre un proyecto real** para confirmar:
- **Realtime:** cambios en vivo y presencia en un canal privado, con RLS.
- **Consultas del panel con datos relacionados** (órdenes con recepción, vehículo, cliente y técnico).
- **Storage:** subidas anónimas a `pendientes/`, URLs firmadas y subida de actas.
- **Edge Function `limpieza`** y su programación con pg_cron y pg_net.
- **`agregar_usuario`** (lee `auth.users`) y los permisos de `service_role`.


## Datos que debe entregar el taller (`// EDITAR`)
- [ ] Número de WhatsApp, teléfono, correo y dirección exacta (`src/compartido/config.ts` y `config_taller`).
- [ ] Horarios reales y cupos de recepción por franja (tabla `disponibilidad`).
- [ ] Color de marca o logo (`src/index.css`, variable `--marca`).
- [ ] Razón social, NIT y plazo de conservación para el aviso de privacidad.
- [ ] Revisión de las reglas del semáforo y de los intervalos de mantenimiento por parte de Javier.

## Fase 1: decisiones y límites conocidos
- **Semáforo en una tabla aparte** (`triage_interno`) en lugar de columnas en `solicitudes`. Así nunca viaja por Realtime ni en un `select *` junto con la solicitud.
- **Solicitud corta (Tabla 14 del informe 2):** son obligatorios el documento, el nombre y el celular. El correo, la dirección y el VIN son opcionales, y el taller los completa en la recepción.
- **Cliente existente:** el portal vincula la solicitud, pero no sobrescribe sus datos. Lo que escribió el cliente queda en `datos_reportados`, y el taller lo concilia.
- **Palabras clave:** se buscan como texto, sin entender negaciones. "No sale humo" marca rojo; el error es hacia el lado seguro y el dueño lo corrige.
- **Zona "No sé" sin síntomas ni palabras clave:** queda en verde, para que el dueño la revise y la reclasifique.
- **Video:** no se comprime en el navegador. Hay un límite de 50 MB y 90 s por archivo (máximo por archivo del plan gratuito de Supabase).
- **Subidas anónimas a `pendientes/`:** cualquiera puede subir archivos ahí, aunque no leerlos. El riesgo de abuso se reduce con límites de tamaño y tipo. **Fase 5:** quedó escrita la Edge Function `limpieza`, que borra los archivos con más de 2 días que no quedaron en ninguna solicitud. **No está probada** en un proyecto real; ver "Riesgos".
- **Consulta y "ya soy cliente":** se protegen con límites de intentos por origen y por código o placa. El código de seguimiento tiene 6 caracteres (unos 887 millones de combinaciones).
- **Fuente tipográfica:** se usa la del sistema. Cargar una fuente externa se evaluará en la Fase 5.

## Fase 2: decisiones y límites conocidos
- **Bandeja:** se recarga completa con cada evento de tiempo real. Es suficiente para el volumen de un taller pequeño (últimos 60 días, máximo 300 solicitudes).
- **Orden:** rojo primero y, dentro de cada color, la que más lleva esperando. Una solicitud nueva aparece marcada **NUEVA** y suma al contador de la pestaña.
- **Ficha completa** (documento, correo, dirección): se pide con `ver_solicitud` y cada apertura queda en la auditoría. La lista solo muestra nombre y placa.
- **Sobrecupo:** el taller puede agendar en una franja llena o cerrada, pero solo si marca la casilla (o confirma, al arrastrar). Queda registrado como "forzada" en la auditoría.
- **Una cita movida queda "reprogramada"** hasta que el taller la confirme después de hablar con el cliente.
- **Notificaciones:** con la app abierta suena un aviso y llega una notificación del navegador, si se da el permiso. **Con la app cerrada** hace falta Web Push y un service worker (Fase 5). En iPhone solo funciona con la PWA instalada.
- **Presencia:** usa un canal privado de Realtime. En la demo se simula entre pestañas del mismo navegador.
- **Ajustes:** el administrador edita cupos, horarios, días cerrados y plantillas; el técnico solo consulta. Las reglas del semáforo, los usuarios y los síntomas se editarán en la Fase 5.
- **Plantillas de WhatsApp:** no se pueden guardar si parecen prometer precios o tiempos. La detección es por palabras y puede fallar; el dueño siempre revisa antes de enviar.

## Fase 3: decisiones y límites conocidos
- **El acta es evidencia:** una vez firmada no se puede editar ni borrar (sin permisos de UPDATE/DELETE). Si hubo un error, se registra en la orden con una nota.
- **Exige 4 fotos** (frente, lateral izquierdo, lateral derecho, tablero con km), la firma y el nombre de quien entrega. El video 360° es opcional (máximo 50 MB).
- **Una orden abierta por vehículo.** Para abrir otra acta, la anterior debe estar entregada o cancelada.
- **Cliente que llega sin solicitud:** resuelto en la Fase 5 con el **alta rápida** dentro del acta. Pide documento, nombre, celular, placa, marca y la autorización de datos, que es obligatoria.
- **Reglas de estados** (en el servidor, con espejo en pantalla):
  - Con presupuesto previo, no pasa a reparación ni a prueba sin aprobación. Si el cliente lo rechaza, sí puede pasar a "listo" para devolverlo sin reparar.
  - Sin autorización de ruta, la prueba exige registrar cómo se probó sin conducir, o la nueva autorización.
  - La entrega exige km de salida (no menor al de ingreso), trabajos y garantía.
  - Solo el admin reabre una orden cerrada.
- **Presupuesto:** lo escribe el taller; la plataforma no calcula precios. El cliente lo aprueba o rechaza en `/consultar` y queda registrado. Si responde por teléfono, el taller lo registra con una nota obligatoria.
- **PDF del acta:** se genera en el navegador. En el celular abre la opción de compartir, para adjuntarlo en WhatsApp; en el computador se descarga. Al cliente se le envía por `wa.me` el código para consultar el estado: **no hay un enlace público al PDF**, porque exigiría exponer archivos privados.
- **Recordatorios al entregar:** se crean para los trabajos marcados con un servicio del plan de mantenimiento (fecha y km estimados). La estimación por km/día y la lista semanal llegan en la Fase 4.
- **Demo:** las fotos y la firma se guardan solo en la memoria de la pestaña. Al recargar, el PDF sale con "(imagen no disponible)". Con Supabase quedan en el almacenamiento privado.
- **Sin probar en un Supabase real:** las consultas del panel que traen datos relacionados (órdenes con su recepción, vehículo, cliente y técnico). Las funciones y reglas SQL sí están probadas en PGlite.

## Fase 4: decisiones y límites conocidos
- **SOAT y revisión técnico-mecánica (RTM):** se guardan las **fechas de vencimiento** que registren el cliente (en `/mantenimiento`) o el taller. No se calculan solas.
  - Según la norma vigente, un particular nuevo hace la primera RTM al 5.º año de matrícula y luego cada año; el SOAT es anual. Se muestra solo como ayuda.
  - El aviso sale 30 días antes (`dias_aviso_vencimiento`, `// EDITAR`).
  - Hay noticias de que el Gobierno estudia cambios a la RTM (sept. 2026): conviene revisar el RUNT o MinTransporte antes de publicar.
- **Kilometraje por día:** usa todas las lecturas (solicitudes, actas, entregas y la ficha del vehículo). Necesita 2 o más lecturas separadas al menos 14 días; si no, se usa solo la fecha. El recordatorio sale por lo que llegue primero: fecha o km.
- **Recordatorios:**
  - Se generan al entregar los trabajos del plan, al importar el último servicio desde Excel, y por SOAT y RTM (uno vivo por tipo).
  - El mensaje lleva un enlace `/solicitar?r=<token>` que precarga solo el vehículo; al enviar la solicitud, el recordatorio pasa solo a "agendado". Eso alimenta el indicador de conversión (meta del informe: 1 de cada 5).
  - "Enviado" se marca al abrir WhatsApp desde la plataforma. Como no se usa la API, no se sabe si el mensaje realmente salió.
- **Clientes importados de Excel:** quedan "sin autorización de datos registrada". Su mensaje incluye el aviso de privacidad y la opción "respóndenos NO". Quien dice NO se desmarca en su ficha y ya no aparece. **Para revisar con el taller:** pedir la autorización a esos clientes en su próxima visita.
- **Importación:** solo el admin. Lee .xlsx y .csv (`;` o `,`) con un asistente para mapear columnas. **Nunca sobrescribe:** solo completa campos vacíos y toma el km mayor. Máximo 2000 filas por carga, que se envían en bloques de 500.
- **Exportación:** solo el admin, a Excel o CSV. Queda en la auditoría y pide confirmación. El CSV neutraliza fórmulas, porque los nombres vienen del portal.
- **Supresión (derecho al olvido):** solo el admin, con motivo obligatorio. Anonimiza nombre, documento, contacto, firma y objetos, y conserva el historial técnico (garantías y deber contable). **Fase 5:** la Edge Function `limpieza` también borra las fotos, el video y la firma de las actas de los clientes suprimidos (**no probada** en un proyecto real).
- **Librerías de Excel:** se usan `read-excel-file` 9.3.13 y `write-excel-file` 4.1.1, en versiones fijadas. Se descartó `xlsx` 0.18.5 de npm porque tiene vulnerabilidades conocidas al leer archivos.

## Fase 5: decisiones y límites conocidos
- **PWA:**
  - Hay dos manifiestos: «PSR» (portal) y «PSR Taller», que abre en `/taller` y se instala desde el panel.
  - El service worker guarda solo la app, **nunca datos de clientes ni respuestas de Supabase**. Sin señal, el portal abre igual.
  - Se probó en Chrome (Playwright). En iPhone se instala con «Agregar a inicio».
- **Notificaciones con la app cerrada (Web Push): NO implementadas.** Con la app abierta hay sonido y notificación. Para la app cerrada harían falta claves VAPID, una Edge Function de envío y una tabla de suscripciones. Queda como mejora futura, con costo cero.
- **Configuración del administrador (7.7):**
  - Se editan datos del taller y del aviso, usuarios y roles (no se puede dejar el taller sin administrador), reglas del semáforo con probador, síntomas por zona, cupos, días cerrados, plantillas y plan de mantenimiento.
  - Las cuentas nuevas se crean en Supabase → Authentication, porque crearlas desde la app requeriría la `service_role`.
- **Seguridad del navegador:**
  - CSP estricta, sin scripts externos ni `eval`; las mismas cabeceras se usan en `vite preview` y en Netlify.
  - La compresión de fotos ya no usa su *web worker*, que descargaba código de un CDN.
  - Los nombres que vienen del portal no se ejecutan como fórmulas al exportar a CSV.
- **Accesibilidad:**
  - 58 vistas auditadas con axe-core (WCAG 2.1 A y AA), en tema claro y oscuro, incluidos los diálogos: **0 violaciones**.
  - axe detecta una parte de los problemas. Falta una revisión manual con lector de pantalla (VoiceOver o TalkBack).
- **Modo oscuro:** sigue al celular, o se elige con el botón 🌓, que queda guardado en el dispositivo.
- **Fechas en las pruebas SQL:** usan la fecha de Bogotá, porque con `current_date` (UTC) fallaban de noche.

## Mejoras sugeridas para una siguiente ronda
- Web Push con la app cerrada.
- Tabla de auditoría visible para el administrador. Hoy se consulta en Supabase → Table Editor → `auditoria`.
- Enlace público y temporal al PDF del acta, en vez de adjuntarlo a mano.
- Duración real de los trabajos para planear la agenda (idea de la Solución 3 del informe 1.5).
- Respaldo automático: exportación programada de clientes y órdenes.

## Riesgos
- **Supabase gratis pausa el proyecto tras 7 días sin uso.** Con uso diario no pasa. En el README de la Fase 5 se explicará cómo reactivarlo.
- **Almacenamiento gratis de 1 GB.** Los videos lo llenan rápido. Habrá que definir una política de borrado o archivo de videos antiguos (Fase 4 o 5).
- **SOAT y revisión técnico-mecánica:** no se fijaron reglas por defecto. Se verificará la normativa vigente antes de la Fase 4.
- **Notificaciones con la app cerrada:** en iPhone requieren que la PWA esté instalada (Fase 2 o 5).
- **Pruebas SQL:** corren en PGlite con una simulación mínima de Supabase. Falta repetirlas una vez sobre un proyecto real de Supabase.
