import { describe, it, expect } from "vitest"
import {
  detectImageType,
  validateImageUpload,
  looksLikeSvg,
  looksLikeGif,
  MAX_IMAGE_BYTES,
} from "./image"

// Cabeceras reales mínimas: alcanzan para la detección por firma.
const png = () =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
const webp = () => {
  const b = new Uint8Array(16)
  b.set([0x52, 0x49, 0x46, 0x46], 0) // "RIFF"
  b.set([0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
  return b
}
const avif = () => {
  const b = new Uint8Array(16)
  b.set([0x66, 0x74, 0x79, 0x70], 4) // "ftyp"
  b.set([0x61, 0x76, 0x69, 0x66], 8) // "avif"
  return b
}
const svg = () => new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const gif = () => new TextEncoder().encode("GIF89a........")
const basura = () => new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])

describe("detectImageType — por firma binaria", () => {
  it.each([
    ["PNG", png, "image/png"],
    ["JPEG", jpeg, "image/jpeg"],
    ["WebP", webp, "image/webp"],
    ["AVIF", avif, "image/avif"],
  ])("detecta %s", (_n, make, esperado) => {
    expect(detectImageType(make())).toBe(esperado)
  })

  it("devuelve null con contenido que no es imagen", () => {
    expect(detectImageType(basura())).toBeNull()
    expect(detectImageType(svg())).toBeNull()
    expect(detectImageType(new Uint8Array(0))).toBeNull()
  })

  it("no confunde un archivo truncado con una imagen válida", () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50]))).toBeNull()
  })
})

describe("looksLikeSvg / looksLikeGif", () => {
  it("reconoce SVG por contenido", () => {
    expect(looksLikeSvg(svg())).toBe(true)
    expect(looksLikeSvg(png())).toBe(false)
  })

  it("reconoce GIF", () => {
    expect(looksLikeGif(gif())).toBe(true)
    expect(looksLikeGif(png())).toBe(false)
  })
})

describe("validateImageUpload — acepta lo válido", () => {
  it("PNG con extensión coincidente", () => {
    const r = validateImageUpload({ filename: "foto.png", size: png().length, bytes: png() })
    expect(r).toEqual({ ok: true, mimeType: "image/png", ext: "png" })
  })

  it("JPEG con alias .jpeg", () => {
    const r = validateImageUpload({ filename: "foto.jpeg", size: jpeg().length, bytes: jpeg() })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.mimeType).toBe("image/jpeg")
  })

  it("acepta sin extensión (manda el contenido)", () => {
    const r = validateImageUpload({ filename: "foto", size: png().length, bytes: png() })
    expect(r.ok).toBe(true)
  })

  it("ignora el MIME declarado por el cliente (no se le pasa)", () => {
    // Un PNG renombrado a .png es válido aunque el navegador mande
    // "application/octet-stream". La validación no depende de eso.
    const r = validateImageUpload({ filename: "x.png", size: png().length, bytes: png() })
    expect(r.ok).toBe(true)
  })
})

describe("validateImageUpload — rechaza lo peligroso o inválido", () => {
  it("rechaza SVG disfrazado de PNG (vector de XSS)", () => {
    const bytes = svg()
    const r = validateImageUpload({ filename: "inocente.png", size: bytes.length, bytes })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/SVG/)
  })

  it("rechaza GIF", () => {
    const bytes = gif()
    const r = validateImageUpload({ filename: "anim.gif", size: bytes.length, bytes })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/GIF/)
  })

  it("rechaza contenido que no es imagen", () => {
    const bytes = basura()
    const r = validateImageUpload({ filename: "x.png", size: bytes.length, bytes })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/Formato no soportado/)
  })

  it("rechaza extensión que no coincide con el contenido", () => {
    const bytes = png()
    const r = validateImageUpload({ filename: "mentira.jpg", size: bytes.length, bytes })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/no coincide/)
  })

  it("rechaza archivo vacío", () => {
    const r = validateImageUpload({ filename: "x.png", size: 0, bytes: new Uint8Array(0) })
    expect(r.ok).toBe(false)
  })

  it("rechaza por encima del límite de tamaño", () => {
    const bytes = png()
    const r = validateImageUpload({
      filename: "grande.png",
      size: MAX_IMAGE_BYTES + 1,
      bytes,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/superar/)
  })

  it("acepta justo en el límite", () => {
    const bytes = png()
    const r = validateImageUpload({ filename: "ok.png", size: MAX_IMAGE_BYTES, bytes })
    expect(r.ok).toBe(true)
  })
})
