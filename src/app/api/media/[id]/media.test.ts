import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: { mediaAsset: { findUnique: vi.fn() } },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe("GET /api/media/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.test"
  })

  it("404 si no existe", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue(null as never)
    const res = await GET({} as never, params("nope"))
    expect(res.status).toBe(404)
  })

  it("302 a la URL pública R2 del objeto", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue({
      objectKey: "images/abc.png",
    } as never)

    const res = await GET({} as never, params("m1"))

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("https://cdn.test/images/abc.png")
  })

  it("503 si R2 no está configurado", async () => {
    delete process.env.R2_PUBLIC_BASE_URL
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue({
      objectKey: "images/abc.png",
    } as never)

    const res = await GET({} as never, params("m1"))
    expect(res.status).toBe(503)
  })

  it("500 si la base falla", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockRejectedValue(new Error("boom"))
    const res = await GET({} as never, params("m1"))
    expect(res.status).toBe(500)
  })
})
