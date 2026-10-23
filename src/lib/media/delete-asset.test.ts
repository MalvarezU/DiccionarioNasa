import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    mediaAsset: { findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  },
}))

const mockDeleteObject = vi.fn()

vi.mock("@/lib/r2", () => ({
  putObject: vi.fn(),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}))

import { db } from "@/lib/db"
import { deleteMediaAssetById, deleteMediaAssetByUrl } from "./delete-asset"

const ROW = { id: "m1", objectKey: "images/a.png" }

describe("deleteMediaAssetById", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteObject.mockResolvedValue(undefined)
  })

  it("borra fila y objeto", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue(ROW as never)
    vi.mocked(db.mediaAsset.delete).mockResolvedValue(ROW as never)

    expect(await deleteMediaAssetById("m1")).toEqual({ deleted: true, storageDeleted: true })
    expect(db.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: "m1" } })
    expect(mockDeleteObject).toHaveBeenCalledWith("images/a.png")
  })

  it("si R2 falla igual borra la fila y lo reporta", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue(ROW as never)
    vi.mocked(db.mediaAsset.delete).mockResolvedValue(ROW as never)
    mockDeleteObject.mockRejectedValue(new Error("R2 caído"))

    expect(await deleteMediaAssetById("m1")).toEqual({ deleted: true, storageDeleted: false })
  })

  it("404 lógico si no existe la fila", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue(null)
    expect(await deleteMediaAssetById("nope")).toEqual({ deleted: false, reason: "not-found" })
    expect(mockDeleteObject).not.toHaveBeenCalled()
  })

  it("id vacío no toca nada", async () => {
    expect(await deleteMediaAssetById("")).toEqual({ deleted: false, reason: "external-or-empty" })
  })
})

describe("deleteMediaAssetByUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteObject.mockResolvedValue(undefined)
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.test"
  })

  it("URL legacy /api/media/<id> resuelve por id", async () => {
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue(ROW as never)
    vi.mocked(db.mediaAsset.delete).mockResolvedValue(ROW as never)

    expect(await deleteMediaAssetByUrl("/api/media/m1")).toEqual({
      deleted: true,
      storageDeleted: true,
    })
  })

  it("URL pública R2 resuelve por objectKey", async () => {
    vi.mocked(db.mediaAsset.findFirst).mockResolvedValue(ROW as never)
    vi.mocked(db.mediaAsset.delete).mockResolvedValue(ROW as never)

    expect(await deleteMediaAssetByUrl("https://cdn.test/images/a.png")).toEqual({
      deleted: true,
      storageDeleted: true,
    })
    expect(db.mediaAsset.findFirst).toHaveBeenCalledWith({
      where: { objectKey: "images/a.png" },
      select: { id: true, objectKey: true },
    })
  })

  it("externa o vacía no toca nada", async () => {
    expect(await deleteMediaAssetByUrl("https://evil.com/a.png")).toEqual({
      deleted: false,
      reason: "external-or-empty",
    })
    expect(await deleteMediaAssetByUrl(null)).toEqual({
      deleted: false,
      reason: "external-or-empty",
    })
    expect(mockDeleteObject).not.toHaveBeenCalled()
  })
})
