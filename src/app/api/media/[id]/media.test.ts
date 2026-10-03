import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: { mediaAsset: { findUnique: vi.fn() } },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe("GET /api/media/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("404 si no existe", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue(null as never)
    const res = await GET({} as never, params("nope"))
    expect(res.status).toBe(404)
  })

  it("sirve los bytes con el MIME guardado y caché inmutable", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue({
      data: Buffer.from(bytes),
      mimeType: "image/png",
      size: bytes.byteLength,
    } as never)

    const res = await GET({} as never, params("m1"))

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/png")
    expect(res.headers.get("Content-Length")).toBe(String(bytes.byteLength))
    expect(res.headers.get("Cache-Control")).toContain("immutable")
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")

    const devuelto = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(devuelto)).toEqual(Array.from(bytes))
  })

  it("500 si la base falla", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockRejectedValue(new Error("boom"))
    const res = await GET({} as never, params("m1"))
    expect(res.status).toBe(500)
  })
})
