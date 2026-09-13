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
    expect(sw).toContain("AUDIO_MAX_ENTRIES")
    expect(sw).not.toContain("nasa-yuwe-shell-v1")
  })
})
