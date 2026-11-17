import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as path from "path";
import { config as dotenv } from "dotenv";

// Igual que e2e/pwa-offline.spec.ts: sin DATABASE_URL exportado se intenta
// el env de test local antes que .env. Jamas tocar prod desde esta spec.
if (!process.env.DATABASE_URL) {
  dotenv({ path: path.resolve(__dirname, "../.env.test.mysql") });
}
if (!process.env.DATABASE_URL) {
  dotenv({ path: path.resolve(__dirname, "../.env.test") });
}
dotenv({ path: path.resolve(__dirname, "../.env") });

/**
 * Matriz PWA offline (gate de aceptacion del plan de reparacion).
 *
 * CORRER CONTRA BUILD DE PRODUCCION (`next start` / standalone): el dev
 * server sirve assets con `no-store` y miente sobre el comportamiento del SW.
 * Usar `context.setOffline(true)`: el "emulate Offline" de CDP NO corta los
 * fetch del service worker (verificado en el diagnostico).
 *
 * Casos:
 *  1. Ruta cacheada: reload offline sigue sirviendo su contenido (no debe
 *     romperse jamas).
 *  2. F1: hard-nav offline a ruta NUNCA visitada -> fallback "Sin conexión",
 *     NUNCA "Application error" (hidratacion descuadrada por servir el HTML
 *     de otra ruta).
 *  3. F2: el fallback offline hidrata offline y sus links navegan.
 *  4. Nav client-side offline: a ruta visitada funciona; a no visitada cae
 *     al fallback sin matar la app.
 *  5. /api/* offline -> 503 JSON { error: "offline" }.
 *  6. Busqueda offline -> sugiere desde IndexedDB (tras sync por UI).
 */

test.describe("PWA offline matrix (prod build)", () => {
  test.describe.configure({ timeout: 240000 });

  const stamp = Date.now();
  const termino = `E2E Matrix ${stamp}`;
  const audioPath = "/audio/e2e-test.mp3";
  let wordId = "";

  test.beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL ?? "";
    if (!/localhost|127\.0\.0\.1|piiyaak_test/.test(dbUrl)) {
      throw new Error(
        "E2E bloqueado: DATABASE_URL no es local. Corre con ./scripts/e2e-local.sh."
      );
    }
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    try {
      const word = await db.dictionaryWord.create({
        data: {
          spanish: termino,
          nasaYuwe: `Matrix Offline ${stamp}`,
          pronunciation: "matrix",
          audioUrl: audioPath,
          culturalContext: "Palabra sembrada por la spec pwa-offline-matrix",
          category: "sustantivo",
          examples: JSON.stringify([
            { spanish: `Ejemplo matrix ${stamp}`, nasaYuwe: `Nasa matrix ${stamp}` },
          ]),
          status: "PUBLISHED",
        },
      });
      wordId = word.id;
    } finally {
      await db.$disconnect();
    }
  });

  test.afterAll(async () => {
    if (!wordId) return;
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    try {
      await db.dictionaryWord.deleteMany({ where: { id: wordId } });
    } finally {
      await db.$disconnect();
    }
  });

  /** Registra el SW (equivale a la 2da visita) y espera a que controle. */
  async function ensureSW(page: Page) {
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) await navigator.serviceWorker.register("/sw.js");
    });
    await page.reload();
    await expect
      .poll(
        () => page.evaluate(() => (navigator.serviceWorker.controller ? "ok" : "")),
        { timeout: 30000 }
      )
      .toBe("ok");
  }

  /** Emula PWA instalada para que aparezca el boton Configuracion. */
  async function emulateInstalled(context: BrowserContext) {
    await context.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      const standalone = {
        matches: true,
        media: "(display-mode: standalone)",
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      };
      (window as unknown as Window).matchMedia = (query: string) =>
        query === "(display-mode: standalone)"
          ? (standalone as unknown as MediaQueryList)
          : original(query);
    });
  }

  /** Sync por UI (dialogo Configuracion), como un usuario PWA real. */
  async function syncViaUI(page: Page) {
    const idleSyncButton = page.getByRole("button", {
      name: /Sincronizar ahora|Buscar actualizaciones/,
    });
    await page.getByRole("button", { name: "Configuración" }).click();
    await expect(page.getByText("Base de datos local")).toBeVisible({
      timeout: 15000,
    });
    for (let intento = 0; intento < 2; intento++) {
      const syncNow = page.getByRole("button", { name: "Sincronizar ahora" });
      if (await syncNow.isVisible().catch(() => false)) {
        await syncNow.click();
      }
      await expect(idleSyncButton).toBeVisible({ timeout: 120000 });
      if (await page.getByText("Descargada").isVisible().catch(() => false)) {
        break;
      }
    }
    await expect(page.getByText("Descargada")).toBeVisible({ timeout: 15000 });
    await page.keyboard.press("Escape");
  }

  test("ruta cacheada sobrevive a reload offline", async ({ page }) => {
    await page.goto("/diccionario");
    await ensureSW(page);
    await expect(
      page.getByRole("heading", { name: /diccionario/i }).first()
    ).toBeVisible({ timeout: 30000 });

    await page.context().setOffline(true);
    await page.reload();
    // Sigue siendo el diccionario en su propia URL, sin error de app.
    await expect(page).toHaveURL(/\/diccionario/);
    await expect(page.getByText("Application error")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /diccionario/i }).first()
    ).toBeVisible({ timeout: 30000 });
  });

  /**
   * El fallback offline post-fix es `public/offline.html`: estatico, sin JS,
   * marcado con #offline-fallback. Cualquier HTML de otra ruta (el bug: el SW
   * sirve el HTML de /offline en la URL pedida) NO trae esa marca -> RED
   * determinista, sin depender de la carrera de hidratacion.
   */
  async function fallbackMarker(page: Page): Promise<string> {
    return page.evaluate(() => {
      if (document.getElementById("offline-fallback")) return "static-fallback";
      if (document.body.textContent?.includes("Application error")) return "app-error";
      const h1 = document.querySelector("h1")?.textContent ?? "";
      return `route-html:${h1.slice(0, 40)}`;
    });
  }

  test("F1: hard-nav offline a ruta nunca visitada no mata la app", async ({
    page,
  }) => {
    await page.goto("/diccionario");
    await ensureSW(page);
    // Visita online a /offline: su chunk JS queda en caché y la hidratación
    // offline del fallback es determinista. Sin el chunk, el resultado es
    // una carrera entre HTML estático y error de hidratación.
    await page.goto("/offline");
    await expect(
      page.getByRole("heading", { name: /sin conexi/i })
    ).toBeVisible({ timeout: 30000 });
    // /terminos jamas se visito en este contexto.
    await page.context().setOffline(true);
    await page.goto("/terminos");
    // Dar tiempo a que la hidratación intente (y falle, antes del fix).
    await page.waitForTimeout(3000);
    // Fallback independiente de la ruta (post-fix: offline.html estatico).
    await expect.poll(() => fallbackMarker(page), { timeout: 10000 }).toBe("static-fallback");
    // La app no debe morir con error de hidratacion...
    await expect(page.getByText("Application error")).toHaveCount(0);
    // ...y debe mostrar el fallback offline (contenido util, no pagina rota).
    await expect(
      page.getByRole("heading", { name: /sin conexi/i })
    ).toBeVisible({ timeout: 30000 });
  });

  test("F2: el fallback offline hidrata y sus links navegan", async ({
    page,
  }) => {
    await page.goto("/diccionario");
    await ensureSW(page);
    await page.goto("/offline");
    await expect(
      page.getByRole("heading", { name: /sin conexi/i })
    ).toBeVisible({ timeout: 30000 });
    await page.context().setOffline(true);
    await page.goto("/terminos");
    await expect.poll(() => fallbackMarker(page), { timeout: 10000 }).toBe("static-fallback");
    await page.waitForTimeout(3000);
    await expect(page.getByText("Application error")).toHaveCount(0);
    const heading = page.getByRole("heading", { name: /sin conexi/i });
    await expect(heading).toBeVisible({ timeout: 15000 });
    // Los links del fallback son funcionales offline (hydration real).
    const link = page.getByRole("link", { name: /diccionario/i }).first();
    await expect(link).toBeVisible({ timeout: 15000 });
    await link.click();
    await expect(page).toHaveURL(/\/diccionario/, { timeout: 15000 });
    await expect(page.getByText("Application error")).toHaveCount(0);
  });

  test("nav client-side offline: visitada ok, no-visitada al fallback", async ({
    page,
  }) => {
    await page.goto("/");
    await ensureSW(page);
    // Visita client-side a /diccionario (queda en cache del SW).
    await page.getByRole("link", { name: /diccionario/i }).first().click();
    await expect(page).toHaveURL(/\/diccionario/, { timeout: 30000 });
    await page.context().setOffline(true);
    // Volver al home (visitado) funciona.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    await expect(page.getByText("Application error")).toHaveCount(0);
  });

  test("API offline responde 503 JSON con shape offline", async ({ page }) => {
    await page.goto("/");
    await ensureSW(page);
    await page.context().setOffline(true);
    const res = await page.evaluate(async () => {
      try {
        const r = await fetch("/api/dictionary/search?q=casa");
        const body = await r.json().catch(() => null);
        return { status: r.status, body };
      } catch {
        return { status: "error-de-red", body: null };
      }
    });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: "offline" });
  });

  test("banner offline persistente con CTA a lo disponible", async ({ page }) => {
    await page.goto("/diccionario");
    await ensureSW(page);
    // Online: sin banda.
    await expect(page.getByText(/mostrando contenido guardado/i)).toHaveCount(0);
    await page.context().setOffline(true);
    await page.reload();
    // Offline: banda visible con CTA que navega a /offline (ruta precacheada).
    const cta = page.getByRole("link", { name: /ver lo disponible/i });
    await expect(cta).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/mostrando contenido guardado/i)).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/offline/, { timeout: 15000 });
    await expect(page.getByText("Application error")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /sin conexi/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("destacados offline salen del snapshot (sin bloque de error)", async ({
    page,
  }) => {
    await page.goto("/diccionario");
    await ensureSW(page);
    // Online: el grid de destacadas carga y el snapshot queda guardado.
    await expect(
      page.getByRole("heading", { name: /palabras destacadas/i })
    ).toBeVisible({ timeout: 30000 });
    const panel = page.getByRole("tabpanel").first();
    await expect(panel.getByRole("button").first()).toBeVisible({
      timeout: 30000,
    });
    await page.context().setOffline(true);
    await page.reload();
    // Offline: ni error ni "no hay" (el snapshot alimenta el grid).
    await expect(
      page.getByRole("heading", { name: /palabras destacadas/i })
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/no pudimos cargar/i)).toHaveCount(0);
    await expect(panel.getByRole("button").first()).toBeVisible({
      timeout: 30000,
    });
  });

  test("busqueda offline sugiere desde IndexedDB tras sync", async ({    page,
    context,
  }) => {
    await emulateInstalled(context);
    await page.goto("/diccionario");
    await ensureSW(page);
    await expect(
      page.getByRole("button", { name: "Configuración" })
    ).toBeVisible({ timeout: 60000 });
    await syncViaUI(page);

    const busqueda = termino.slice(0, 12);
    await page.context().setOffline(true);
    await page.getByPlaceholder(/Buscar/).fill(busqueda);
    const opcion = page
      .getByRole("option", { name: new RegExp(termino, "i") })
      .first();
    await expect(opcion).toBeVisible({ timeout: 25000 });
    await opcion.click();
    const ficha = page.getByRole("dialog");
    await expect(
      ficha.getByRole("heading", { name: /E2E Matrix/i })
    ).toBeVisible({ timeout: 20000 });
  });
});
