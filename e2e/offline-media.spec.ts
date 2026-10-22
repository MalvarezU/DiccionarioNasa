import { test, expect } from "@playwright/test"

/**
 * Offline media (Fase 5 R2): las imágenes servidas desde R2 deben sobrevivir
 * sin conexión gracias al service worker (IMAGE_CACHE), en modo cors Y no-cors.
 *
 * El modo no-cors es el que usan <img>/<audio> y da respuestas OPACAS
 * (status 0): antes de la Fase 5 el SW solo guardaba `res.ok` y el caché
 * nunca se llenaba. Cada modo usa su propia URL para probar el caché en frío.
 *
 * Requiere E2E_R2_IMAGE_URL (imagen real en el bucket de test) y deriva la
 * segunda URL cambiando fase5-probe.png → fase5-probe2.png.
 */
const IMAGE_URL = process.env.E2E_R2_IMAGE_URL ?? ""
const IMAGE_URL_2 = IMAGE_URL.replace("fase5-probe.png", "fase5-probe2.png")

test.describe("offline media R2 (Fase 5)", () => {
  test("imagen R2 sobrevive offline en modo cors y no-cors", async ({ page }) => {
    test.skip(!IMAGE_URL || !IMAGE_URL_2.includes("fase5-probe2"), "requiere E2E_R2_IMAGE_URL")

    await page.goto("/diccionario")
    // El layout registra el SW en el evento load; en tests ese listener puede
    // llegar tarde, así que se fuerza el registro (equivale al 2° visit).
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations()
      if (regs.length === 0) await navigator.serviceWorker.register("/sw.js")
    })
    await page.reload()
    await expect
      .poll(() => page.evaluate(() => (navigator.serviceWorker.controller ? "ok" : "")), {
        timeout: 15000,
      })
      .toBe("ok")

    // Online, caché frío por modo.
    const online = await page.evaluate(async ([corsUrl, opaqueUrl]: string[]) => {
      const cors = await fetch(corsUrl)
      const opaque = await fetch(opaqueUrl, { mode: "no-cors" })
      const img = await caches.open("piiyaak-image-v1").catch(() => null)
      const keys = img ? await img.keys() : []
      return {
        cors: cors.status,
        opaque: opaque.type,
        caches: await caches.keys(),
        entries: keys.length,
      }
    }, [IMAGE_URL_2, IMAGE_URL])

    expect(online.cors).toBe(200)
    expect(online.opaque).toBe("opaque")
    expect(online.caches).toContain("piiyaak-image-v1")
    expect(online.entries).toBeGreaterThanOrEqual(2)

    // Offline: ambas deben salir del SW.
    await page.context().setOffline(true)
    const offline = await page.evaluate(async ([corsUrl, opaqueUrl]: string[]) => {
      const cors = await fetch(corsUrl)
      const opaque = await fetch(opaqueUrl, { mode: "no-cors" })
      return { cors: cors.status, opaque: opaque.type }
    }, [IMAGE_URL_2, IMAGE_URL])

    expect(offline.cors).toBe(200)
    expect(offline.opaque).toBe("opaque")
  })
})
