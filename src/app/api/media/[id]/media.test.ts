import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }))

vi.mock("@/lib/db", () => ({
  db: { mediaAsset: { findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() } },
}))

const mockDeleteObject = vi.fn()

vi.mock("@/lib/r2", () => ({
  putObject: vi.fn(),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}))

import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET, DELETE } from "./route"

const params = (id: string) => ({ params: Promise.resolve({ id }) })

const editorOk = {
  session: { user: { id: "e1", role: "editor" }, expires: "2099-01-01T00:00:00Z" },
  error: null,
}

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

describe("DELETE /api/media/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(editorOk as never)
    mockDeleteObject.mockResolvedValue(undefined)
  })

  it("exige rol editor", async () => {
    const denegado = Response.json({ message: "Acceso denegado" }, { status: 403 })
    vi.mocked(requireRole).mockResolvedValue({ session: null, error: denegado } as never)

    const res = await DELETE({} as never, params("m1"))
    expect(res.status).toBe(403)
    expect(db.mediaAsset.delete).not.toHaveBeenCalled()
  })

  it("404 si no existe", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue(null as never)
    const res = await DELETE({} as never, params("nope"))
    expect(res.status).toBe(404)
  })

  it("borra fila y objeto, reporta storageDeleted", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue({
      id: "m1",
      objectKey: "images/a.png",
    } as never)
    vi.mocked(db.mediaAsset.delete).mockResolvedValue({ id: "m1" } as never)

    const res = await DELETE({} as never, params("m1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ id: "m1", storageDeleted: true })
    expect(mockDeleteObject).toHaveBeenCalledWith("images/a.png")
  })

  it("si R2 falla igual responde 200 con storageDeleted false", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue({
      id: "m1",
      objectKey: "images/a.png",
    } as never)
    vi.mocked(db.mediaAsset.delete).mockResolvedValue({ id: "m1" } as never)
    mockDeleteObject.mockRejectedValue(new Error("R2 caído"))

    const res = await DELETE({} as never, params("m1"))
    expect(res.status).toBe(200)
    expect((await res.json()).storageDeleted).toBe(false)
  })
})
