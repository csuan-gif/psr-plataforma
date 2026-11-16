import { expect, test } from "@playwright/test";

test("PWA: manifiestos, service worker y el portal abre sin conexión", async ({ page, context }) => {
  await page.goto("/");
  const manifiesto = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifiesto).toMatchObject({ display: "standalone", start_url: "/?origen=app" });
  expect(manifiesto.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const i of manifiesto.icons) expect((await page.request.get(i.src)).ok()).toBe(true);
  const taller = await (await page.request.get("/manifest-taller.webmanifest")).json();
  expect(taller.start_url).toBe("/taller");

  // El service worker queda activo y controla la página.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Sin conexión, el portal sigue abriendo (caché del service worker).
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Qué necesita tu vehículo/ })).toBeVisible();
  await context.setOffline(false);

  // Cabeceras de seguridad presentes.
  const r = await page.request.get("/");
  expect(r.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(r.headers()["x-frame-options"]).toBe("DENY");
});

test("el panel del taller usa su propio manifiesto (se instala como «PSR Taller»)", async ({ page }) => {
  await page.goto("/taller");
  await expect(page.getByRole("heading", { name: "Entrar al panel" })).toBeVisible();
  expect(await page.locator('link[rel="manifest"]').getAttribute("href")).toContain("manifest-taller.webmanifest");
});
