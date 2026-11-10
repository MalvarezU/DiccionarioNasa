import { test, expect } from "@playwright/test";
import * as path from "path";
import { config as dotenv } from "dotenv";

// Igual que e2e/teardown.ts: sin DATABASE_URL exportado se intenta el env de
// test local antes que .env. Jamas tocar prod desde esta spec.
if (!process.env.DATABASE_URL) {
  dotenv({ path: path.resolve(__dirname, "../.env.test.mysql") });
}
if (!process.env.DATABASE_URL) {
  dotenv({ path: path.resolve(__dirname, "../.env.test") });
}
dotenv({ path: path.resolve(__dirname, "../.env") });

/**
 * PWA offline sin R2 (ficha + audio locales).
 *
 * Flujo publico, sin sesion ni credenciales externas:
 *  1. Siembra una palabra "E2E Pwa Offline *" con audio estatico mismo-origen
 *     (/audio/*.mp3 vive en public/, lo sirve el servidor).
 *  2. Registra el SW, sincroniza por la UI (dialogo Configuracion, como un
 *     usuario PWA real) y verifica que IndexedDB quedo poblada.
 *  3. Pre-calienta el audio online con un clic real en Escuchar (el SW lo
 *     guarda en piiyaak-audio-v1).
 *  4. Sin conexion: buscar sugiere desde IndexedDB, la ficha abre y muestra
 *     los ejemplos (esto atrapo el bug JSON.parse de examples), y el audio
 *     sale del cache del SW en vez del 503 offline.
 *
 * Notas de robustez (headless + SW):
 * - No se usa waitForResponse para el <audio>: el request del elemento puede
 *   resolverse sin emitir evento de respuesta observable. En su lugar se
 *   afirma el estado del reproductor (Pausar = hay datos) y la Cache API.
 * - El boton Configuracion es PWA-only (display-mode: standalone): se emula
 *   instalado via addInitScript antes de navegar.
 *
 * Limpieza: la palabra "E2E *" la borra el teardown global (e2e/teardown.ts);
 * el afterAll la borra tambien como cortesia. El AuditLog no se toca.
 */
test.describe("PWA offline: ficha y audio sin conexion", () => {
  test.describe.configure({ timeout: 180000 });

  const stamp = Date.now();
  const termino = `E2E Pwa Offline ${stamp}`;
  const ejemploEs = `Ejemplo sin conexion ${stamp}`;
  const audioPath = "/audio/Kupe.mp3";
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
          nasaYuwe: `Pwa Offline ${stamp}`,
          pronunciation: "pwa",
          audioUrl: audioPath,
          culturalContext: "Palabra sembrada por la spec pwa-offline",
          category: "sustantivo",
          examples: JSON.stringify([
            { spanish: ejemploEs, nasaYuwe: `Nasa offline ${stamp}` },
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

  test("sincroniza por UI y la ficha con audio sobrevive offline", async ({
    page,
    context,
  }) => {
    // El boton Configuracion es PWA-only (display-mode: standalone): en un
    // tab de escritorio no existe, asi que se emula instalado antes de navegar.
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
      (window as Window).matchMedia = (query: string) =>
        query === "(display-mode: standalone)"
          ? (standalone as unknown as MediaQueryList)
          : original(query);
    });

    await page.goto("/diccionario");
    // El layout registra el SW en el evento load; en tests ese listener puede
    // llegar tarde, asi que se fuerza el registro (equivale a la 2da visita).
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
    // Prueba de hidratacion: sin este boton, React no hidrato (nada de lo
    // que sigue seria un sync real) y hay que fallar rapido y claro.
    await expect(
      page.getByRole("button", { name: "Configuración" })
    ).toBeVisible({ timeout: 60000 });

    // La palabra sembrada viaja por el export publico.
    const exportRes = await page.request.get(
      `/api/dictionary/export?page=1&pageSize=500`
    );
    expect(exportRes.ok()).toBe(true);
    const exportData = await exportRes.json();
    expect(
      (exportData.words as Array<{ spanish: string }>).some((w) =>
        w.spanish.startsWith("E2E Pwa Offline")
      )
    ).toBe(true);

    // Sincronizacion por UI (ruta preferida: la que usa un usuario PWA).
    // El auto-sync al montar puede haberla terminado (boton "Buscar
    // actualizaciones"), estar en curso (boton "Sincronizando...") o no haber
    // arrancado ("Sincronizar ahora"): los tres desembocan en quietud con el
    // boton de reposo visible. Un intento manual extra cubre un auto-sync
    // fallido previo.
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
      await expect(idleSyncButton).toBeVisible({ timeout: 100000 });
      if (
        await page.getByText("Descargada").isVisible().catch(() => false)
      ) {
        break;
      }
    }
    await expect(page.getByText("Descargada")).toBeVisible({ timeout: 15000 });
    const syncedCount = await page.evaluate(async () => {
      const open = indexedDB.open("NasaYuweDictionary");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      try {
        const count = await new Promise<number>((resolve, reject) => {
          const tx = db.transaction("words", "readonly");
          const req = tx.objectStore("words").count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        return count;
      } finally {
        db.close();
      }
    });
    expect(syncedCount).toBeGreaterThan(0);
    await page.keyboard.press("Escape");

    const audioCached = () =>
      page.evaluate(async (url: string) => {
        try {
          const cache = await caches.open("piiyaak-audio-v1");
          return (await cache.match(url)) ? "si" : "no";
        } catch {
          return "sin-cache-api";
        }
      }, audioPath);

    // Online: buscar y reproducir con un clic real (el SW guarda el audio en
    // piiyaak-audio-v1 al interceptar el request del elemento).
    const busqueda = termino.slice(0, 13);
    await page.getByPlaceholder(/Buscar/).fill(busqueda);
    const opcion = page
      .getByRole("option", { name: new RegExp(termino, "i") })
      .first();
    await expect(opcion).toBeVisible({ timeout: 25000 });
    await opcion.getByRole("button", { name: /escuchar/i }).click();
    // "Pausar" = el elemento tiene datos y esta sonando (no abrio la ficha:
    // el boton detiene la propagacion y la opcion seguiria visible si no).
    await expect(opcion.getByRole("button", { name: /pausar/i })).toBeVisible({
      timeout: 20000,
    });
    await expect.poll(audioCached, { timeout: 30000 }).toBe("si");
    await opcion.getByRole("button", { name: /pausar/i }).click();

    // Sin conexion: la busqueda sugiere desde IndexedDB...
    await context.setOffline(true);
    await page.getByPlaceholder(/Buscar/).fill("");
    await page.getByPlaceholder(/Buscar/).fill(busqueda);
    const opcionOffline = page
      .getByRole("option", { name: new RegExp(termino, "i") })
      .first();
    await expect(opcionOffline).toBeVisible({ timeout: 25000 });

    // ...la ficha abre desde IndexedDB con sus ejemplos (regresion
    // JSON.parse de examples: antes mostraba "No se encontro la palabra")...
    await opcionOffline.click();
    const ficha = page.getByRole("dialog");
    await expect(
      ficha.getByRole("heading", { name: /pwa offline/i })
    ).toBeVisible({ timeout: 20000 });
    await expect(ficha.getByText(ejemploEs)).toBeVisible({ timeout: 20000 });
    await page.keyboard.press("Escape");

    // ...y el audio sale del cache del SW, no del 503 offline: el clic lo
    // pone a sonar y el fetch del medio responde 200 desde el SW.
    await page.getByPlaceholder(/Buscar/).fill("");
    await page.getByPlaceholder(/Buscar/).fill(busqueda);
    const opcionAudio = page
      .getByRole("option", { name: new RegExp(termino, "i") })
      .first();
    await expect(opcionAudio).toBeVisible({ timeout: 25000 });
    await opcionAudio.getByRole("button", { name: /escuchar/i }).click();
    await expect(
      opcionAudio.getByRole("button", { name: /pausar/i })
    ).toBeVisible({ timeout: 20000 });
    const audioOfflineStatus = await page.evaluate(async (url: string) => {
      try {
        return (await fetch(url)).status;
      } catch {
        return "error-de-red";
      }
    }, audioPath);
    expect(audioOfflineStatus).not.toBe(503);
    expect(audioOfflineStatus).toBe(200);
  });
});
