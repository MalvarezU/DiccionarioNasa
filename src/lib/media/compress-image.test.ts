import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  targetDimensions,
  filenameForBlob,
  IMAGE_MAX_DIMENSION,
  ILLUSTRATION_SIZE,
  squareCrop,
  compressToIllustration,
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

describe("squareCrop — recorte cuadrado centrado", () => {
  it("horizontal: centra en X", () => {
    expect(squareCrop(800, 600)).toEqual({ sx: 100, sy: 0, side: 600 })
  })

  it("vertical: centra en Y", () => {
    expect(squareCrop(600, 800)).toEqual({ sx: 0, sy: 100, side: 600 })
  })

  it("cuadrada: sin desplazamiento", () => {
    expect(squareCrop(512, 512)).toEqual({ sx: 0, sy: 0, side: 512 })
  })

  it("entrada rara no lanza", () => {
    expect(squareCrop(0, 0)).toEqual({ sx: 0, sy: 0, side: ILLUSTRATION_SIZE })
    expect(squareCrop(NaN, -5)).toEqual({ sx: 0, sy: 0, side: ILLUSTRATION_SIZE })
  })
})

describe("compressToIllustration — 512px WebP uniforme", () => {
  const realCreateImageBitmap = (globalThis as Record<string, unknown>).createImageBitmap
  const realDocument = (globalThis as Record<string, unknown>).document

  const drawCalls: unknown[][] = []
  let toBlobType = ""
  let toBlobQuality = 0

  function stubBrowser(bitmapW: number, bitmapH: number) {
    drawCalls.length = 0
    ;(globalThis as Record<string, unknown>).createImageBitmap = async () => ({
      width: bitmapW,
      height: bitmapH,
    })
    ;(globalThis as Record<string, unknown>).document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: (...args: unknown[]) => drawCalls.push(args),
        }),
        toBlob: (cb: (b: Blob | null) => void, type: string, quality: number) => {
          toBlobType = type
          toBlobQuality = quality
          cb(new Blob(["x"], { type }))
        },
      }),
    }
  }

  afterEach(() => {
    ;(globalThis as Record<string, unknown>).createImageBitmap = realCreateImageBitmap
    ;(globalThis as Record<string, unknown>).document = realDocument
    vi.unstubAllGlobals?.()
  })

  it("crop centrado + canvas 512 + webp", async () => {
    stubBrowser(800, 600)
    const file = new File(["foto"], "foto.png", { type: "image/png" })

    const out = await compressToIllustration(file)

    expect(out.name).toBe("foto.webp")
    expect(out.type).toBe("image/webp")
    expect(toBlobType).toBe("image/webp")
    expect(toBlobQuality).toBe(0.85)
    // drawImage(bitmap, sx, sy, side, side, dx, dy, 512, 512)
    expect(drawCalls).toHaveLength(1)
    expect(drawCalls[0]!.slice(1)).toEqual([100, 0, 600, 600, 0, 0, 512, 512])
  })

  it("vertical centra en Y", async () => {
    stubBrowser(600, 900)
    const out = await compressToIllustration(new File(["f"], "v.jpg", { type: "image/jpeg" }))
    expect(out.name).toBe("v.webp")
    expect(drawCalls[0]!.slice(1)).toEqual([0, 150, 600, 600, 0, 0, 512, 512])
  })

  it("sin bitmap devuelve el original", async () => {
    ;(globalThis as Record<string, unknown>).createImageBitmap = async () => {
      throw new Error("no bitmap")
    }
    const file = new File(["f"], "x.png", { type: "image/png" })
    expect(await compressToIllustration(file)).toBe(file)
  })
})
