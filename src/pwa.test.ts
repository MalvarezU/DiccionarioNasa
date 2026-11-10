import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

const root = process.cwd()

describe("PWA [B3.2]", () => {
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

  it("service worker con shell, offline y tope de audios", () => {
    const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf-8")
    expect(sw).toContain("/offline")
    expect(sw).toContain("/manifest.webmanifest")
    expect(sw).toContain("/apple-touch-icon-180.png")
    expect(sw).toContain("AUDIO_MAX_ENTRIES")
    expect(sw).not.toContain("nasa-yuwe-shell-v1")
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

  it("la caché del shell subió de v4 a v5 (limpia caché vieja con CSS stale)", () => {
    expect(sw).toContain('SHELL_CACHE = "piiyaak-shell-v5"')
    expect(sw).not.toContain('SHELL_CACHE = "piiyaak-shell-v4"')
  })
})
