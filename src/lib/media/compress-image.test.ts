import { describe, it, expect } from "vitest"
import {
  targetDimensions,
  filenameForBlob,
  IMAGE_MAX_DIMENSION,
} from "./compress-image"

describe("targetDimensions", () => {
  it("no redimensiona si ya está dentro del máximo", () => {
    expect(targetDimensions(1200, 800)).toEqual({ width: 1200, height: 800 })
    expect(targetDimensions(800, 1200)).toEqual({ width: 800, height: 1200 })
    expect(targetDimensions(1600, 900, IMAGE_MAX_DIMENSION)).toEqual({ width: 1600, height: 900 })
  })

  it("foto horizontal de celular: redimensiona por el lado largo", () => {
    expect(targetDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 })
  })

  it("foto vertical de celular", () => {
    expect(targetDimensions(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it("preserva el ratio sin exceder nunca el máximo", () => {
    const r = targetDimensions(4032, 3024)
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(1600)
    expect(r.width / r.height).toBeCloseTo(4032 / 3024, 4)
  })

  it("entrada rara no lanza", () => {
    expect(targetDimensions(0, 0)).toEqual({ width: 1600, height: 1600 })
    expect(targetDimensions(-5, 100)).toEqual({ width: 1600, height: 1600 })
    expect(targetDimensions(NaN, 100)).toEqual({ width: 1600, height: 1600 })
  })
})

describe("filenameForBlob — el nombre no puede mentirle al validador", () => {
  it("webp", () => {
    expect(filenameForBlob("foto.png", "image/webp")).toBe("foto.webp")
  })

  it("png conservado", () => {
    expect(filenameForBlob("captura.png", "image/png")).toBe("captura.png")
  })

  it("jpeg", () => {
    expect(filenameForBlob("retrato.heic", "image/jpeg")).toBe("retrato.jpg")
  })

  it("sin nombre, solo extensión en el nombre final", () => {
    expect(filenameForBlob("", "image/jpeg")).toBe(".jpg")
  })
})
