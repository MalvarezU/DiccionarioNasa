import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { Script } from "node:vm"

const root = process.cwd()

describe("PWA [B3.2]", () => {
  it("sw.js parsea sin errores (evaluation failed = PWA muerta)", () => {
    const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf-8")
    // Compila sin ejecutar: un SyntaxError aca es el fallo total del SW.
    expect(() => new Script(sw, { filename: "sw.js" })).not.toThrow()
  })

  it("manifiesto válido e instalable", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "public/manifest.webmanifest"), "utf-8")
    ) as {
      name: string
      start_url: string
      display: string
      icons: Array<{ src: string; sizes: string }>
    }
    expect(manifest.name).toContain("Piiyaak")
    expect(manifest.start_url).toBe("/")
    expect(manifest.display).toBe("standalone")
    const sizes = manifest.icons.map((i) => i.sizes)
    expect(sizes).toContain("192x192")
    expect(sizes).toContain("512x512")
    for (const icon of manifest.icons) {
      expect(fs.existsSync(path.join(root, "public", icon.src))).toBe(true)
    }
  })

  it("service worker con shell versionado, fallback estatico y topes de medios", () => {
    const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf-8")
    // Fallback independiente de la ruta (F1/F7): offline.html estatico, nunca
    // el HTML de otra ruta.
    expect(sw).toContain("/offline.html")
    expect(sw).toContain("/manifest.webmanifest")
    expect(sw).toContain("/apple-touch-icon-180.png")
    expect(sw).toContain("AUDIO_MAX_ENTRIES")
    expect(sw).toContain("IMAGE_MAX_ENTRIES")
    // Nombres de cache de medios estables (media-sync.ts los comparte).
    expect(sw).toContain('AUDIO_CACHE = "piiyaak-audio-v1"')
    expect(sw).toContain('IMAGE_CACHE = "piiyaak-image-v1"')
    expect(sw).not.toContain("nasa-yuwe-shell-v1")
  })

  it("precache por asset sin todo-o-nada (F6)", () => {
    const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf-8")
    // Un 404 no tumba el precache: era cache.addAll atómico.
    expect(sw).toContain("Promise.allSettled")
    expect(sw).not.toMatch(/cache\.addAll\(/)
    expect(sw).toContain("sw-precache.js")
  })

  it("RSC del prefetcher en cache aparte con dedupe por pathname (F4)", () => {
    const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf-8")
    expect(sw).toContain('RSC_CACHE = "piiyaak-rsc-v1"')
    expect(sw).toMatch(/url\.pathname/)
  })

  it("presupuestos por bytes + aviso de quota en vez de tragar (F4)", () => {
    const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf-8")
    expect(sw).toContain("IMAGE_MAX_BYTES")
    expect(sw).toContain("AUDIO_MAX_BYTES")
    expect(sw).toContain("PIIYAAK_SW_QUOTA")
    expect(sw).toContain("SKIP_WAITING")
    expect(sw).toContain("putWithBudget")
    expect(sw).toContain("notifyClients")
  })

  it("registro con updateViaCache none + revalidacion al volver (F5)", () => {
    const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf-8")
    expect(layout).toContain("updateViaCache")
    expect(layout).toContain("visibilitychange")
    expect(layout).toContain("SWNotices")
  })
})

describe("PWA offline.html: fallback estatico sin JS", () => {
  it("existe, lleva el marker del contrato y no carga scripts", () => {
    const html = fs.readFileSync(path.join(root, "public/offline.html"), "utf-8")
    expect(html).toContain('id="offline-fallback"')
    expect(html).toContain("Sin conexi")
    expect(html).not.toMatch(/<script/i)
    for (const href of ["/diccionario", "/juegos", "/cursos"]) {
      expect(html).toContain(`href="${href}"`)
    }
  })
})

describe("PWA [B3.2] — service worker no cachea respuestas no-store", () => {
  const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf-8")

  it("la rama stale-while-revalidate consulta Cache-Control de la respuesta", () => {
    // Guardia: antes de cache.put, se lee el Cache-Control de la respuesta
    // y se omite el put si contiene no-store. Evita que el CSS/JS del dev
    // server (que se envía con no-store) quede stale en la caché del SW.
    expect(sw).toMatch(/res\.headers\.get\("Cache-Control"\)/)
    expect(sw).toMatch(/!cc\.includes\("no-store"\)/)
  })

  it("las cachés del shell subieron a v6 (precache versionado + runtime con cota)", () => {
    expect(sw).toContain('PRECACHE_CACHE = "piiyaak-precache-v6"')
    expect(sw).toContain('SHELL_CACHE = "piiyaak-shell-v6"')
    expect(sw).not.toContain("piiyaak-shell-v5")
    expect(sw).not.toContain("piiyaak-precache-v5")
  })
})
