import { expect, test, type Page } from "@playwright/test";

// PNG 1×1 válido para las fotos del acta.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const foto = (n: string) => ({ name: `${n}.png`, mimeType: "image/png", buffer: PNG });
const siguiente = (p: Page) => p.getByRole("button", { name: "Siguiente", exact: true }).click();

test("cliente → bandeja en vivo → acta → orden → entrega → recordatorio", async ({ browser }) => {
  const ctx = await browser.newContext(); // un solo navegador: la demo comparte datos entre pestañas
  const errores: string[] = [];
  const cliente = await ctx.newPage();
  const taller = await ctx.newPage();
  for (const p of [cliente, taller]) p.on("console", (m) => m.type() === "error" && errores.push(m.text()));

  // ---- El taller entra y abre la bandeja (antes de que llegue la solicitud)
  await taller.goto("/taller");
  await taller.getByRole("button", { name: /Entrar como Javier/ }).click();
  await expect(taller.getByRole("heading", { name: /^(Buenos|Buenas)/ })).toBeVisible();
  await taller.goto("/taller/bandeja");
  await expect(taller.getByRole("heading", { name: /Bandeja/ })).toBeVisible();

  // ---- El cliente llena el asistente (caso tipo C9: pedal blando)
  await cliente.goto("/solicitar");
  await cliente.getByLabel("Número de documento").fill("1098765432");
  await cliente.getByLabel("Nombre completo").fill("Prueba Punta a Punta (ficticia)");
  await cliente.getByLabel("Celular (WhatsApp)").fill("3105556677");
  await siguiente(cliente);
  await cliente.getByLabel("Placa").fill("E2E123");
  await cliente.getByLabel("Marca").fill("Renault");
  await cliente.getByLabel("Línea o modelo").fill("Logan");
  await cliente.getByRole("button", { name: "Sumar 1.000 km" }).click();
  await siguiente(cliente);
  await cliente.getByRole("button", { name: "Frenos", exact: true }).first().click();
  await siguiente(cliente);
  await cliente.getByRole("button", { name: /El pedal se siente blando/ }).click();
  await cliente.getByRole("button", { name: "No estoy seguro" }).click();
  // Regla 1: aviso de seguridad SIN colores
  await expect(cliente.getByText("Si sientes que los frenos o la dirección fallan, no conduzcas el vehículo.")).toBeVisible();
  await siguiente(cliente);
  await cliente.getByRole("button", { name: /Solo quiero una cotización/ }).click();
  await siguiente(cliente);
  await cliente.getByRole("radio", { name: /Autorizo la reparación sin presupuesto/ }).click();
  await cliente.getByLabel(/conducir mi vehículo/).check();
  await cliente.getByLabel(/tratar mis datos personales/).check();
  await siguiente(cliente);
  await cliente.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(cliente.getByRole("heading", { name: /Recibimos tu solicitud/ })).toBeVisible();
  const codigo = (await cliente.locator(".font-mono").first().innerText()).trim();
  expect(codigo).toMatch(/^PSR-[2-9A-HJ-NP-Z]{6}$/);
  // El cliente nunca ve el semáforo
  await expect(cliente.locator("body")).not.toContainText(/urgente|rojo|amarillo|prioridad/i);

  // ---- La bandeja del taller la recibe en vivo (sin recargar), en rojo y marcada NUEVA
  const tarjeta = taller.locator("li", { hasText: codigo });
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toContainText("NUEVA");
  await expect(tarjeta).toContainText("Urgente");
  await expect(taller).toHaveTitle(/^\(\d+\) Taller/);

  // ---- Acta de ingreso
  await tarjeta.getByRole("button").first().click();
  await taller.getByRole("button", { name: /Recibir vehículo \(acta\)/ }).click();
  await expect(taller.getByRole("heading", { name: /E2E123/ })).toBeVisible();
  await taller.getByRole("button", { name: /Km y combustible/ }).click();
  await taller.getByLabel(/Kilometraje de ingreso/).fill("1000");
  await taller.getByRole("button", { name: "3/4", exact: true }).click();
  await taller.getByRole("button", { name: /Inspección/ }).click();
  await taller.getByRole("button", { name: /Marcar el resto como/ }).click();
  await taller.getByRole("button", { name: /Fotos y video/ }).click();
  const entradas = taller.locator('section input[type=file][accept="image/*"]');
  for (let i = 0; i < 4; i++) await entradas.nth(i).setInputFiles(foto(`f${i}`));
  await expect(taller.getByText(/✓ Tablero con km/)).toBeVisible();
  await taller.getByRole("button", { name: /Autorizaciones y firma/ }).click();
  await taller.getByRole("radio", { name: /Autoriza reparar sin presupuesto/ }).click();
  await taller.getByRole("radio", { name: /Autoriza conducir para pruebas/ }).click();
  const firma = taller.getByLabel("Espacio para la firma del cliente");
  await firma.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const caja = (await firma.boundingBox())!;
  await taller.mouse.move(caja.x + 30, caja.y + 120); await taller.mouse.down();
  await taller.mouse.move(caja.x + 150, caja.y + 60, { steps: 8 }); await taller.mouse.move(caja.x + 260, caja.y + 130, { steps: 8 }); await taller.mouse.up();
  await expect(taller.getByText("✓ Todo listo para guardar el acta.")).toBeVisible();
  await taller.getByRole("button", { name: "Guardar acta firmada" }).click();
  await expect(taller.getByRole("heading", { name: "Acta guardada y firmada" })).toBeVisible();

  // ---- Orden de trabajo: estados con reglas, hasta la entrega
  await taller.getByRole("button", { name: "Ir al tablero de órdenes" }).click();
  await taller.getByRole("button", { name: /^E2E123/ }).click();
  const detalle = taller.getByRole("dialog", { name: /^E2E123 · / });
  for (const estado of ["En diagnóstico", "En reparación", "En prueba", "Listo para entregar"]) {
    await detalle.getByRole("button", { name: new RegExp(`^${estado} →`) }).click();
    // Al quedar "listo" se ofrece avisar al cliente por WhatsApp.
    if (estado === "Listo para entregar") await taller.getByRole("button", { name: "Ahora no" }).click();
    await expect(taller.getByRole("dialog", { name: new RegExp(`E2E123 · ${estado}`) })).toBeVisible();
  }
  await detalle.getByRole("button", { name: /^Entregado →/ }).click();
  const entrega = taller.getByRole("dialog", { name: /Entregado/ });
  await entrega.getByLabel(/Km de salida/).fill("1012");
  await entrega.getByRole("button", { name: "+ Agregar trabajo" }).click();
  await entrega.getByLabel("Descripción del trabajo").fill("Cambio de líquido de frenos y purga");
  await entrega.getByLabel("Tipo").selectOption("preventivo");
  await entrega.getByLabel("Servicio del plan de mantenimiento").selectOption({ label: "⏰ Cambio de líquido de frenos" });
  await entrega.getByRole("button", { name: "Registrar entrega" }).click();
  await expect(taller.getByRole("dialog", { name: /Entregado/ }).getByText(/¿Le avisas al cliente\?/)).toBeVisible();

  // ---- Recordatorio programado en la ficha del cliente
  await taller.goto("/taller/clientes?q=E2E123");
  await taller.getByRole("button", { name: /Prueba Punta a Punta/ }).click();
  await expect(taller.getByRole("dialog")).toContainText(/Cambio de líquido de frenos — .* o 41\.012 km/);
  await expect(taller.getByRole("dialog")).toContainText("Garantía vigente");

  // ---- El cliente consulta: línea de tiempo completa y garantía
  await cliente.goto("/consultar");
  await cliente.getByLabel("Código de seguimiento").fill(codigo);
  await cliente.getByLabel("Últimos 4 dígitos de tu documento").fill("5432");
  await cliente.getByRole("button", { name: "Consultar" }).click();
  await expect(cliente.getByText(/Vehículo entregado el/)).toBeVisible();
  await expect(cliente.getByText("Estado: Entregado")).toBeVisible();

  // Sin errores de consola (incluye violaciones de la política de seguridad de contenido)
  expect(errores.filter((e) => !/favicon/.test(e))).toEqual([]);
});
