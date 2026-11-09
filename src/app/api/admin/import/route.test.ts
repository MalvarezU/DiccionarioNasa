import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    dictionaryWord: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  }
  // La ruta usa `db.$transaction(async (tx) => ...)`: el mock ejecuta el
  // callback con el propio db mockeado como `tx`.
  db.$transaction = vi.fn(async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: unknown) => unknown)(db) : fn
  )
  return { db }
})

vi.mock("@/lib/content-version", () => ({
  bumpContentVersion: vi.fn(),
  getContentVersion: vi.fn(),
}))

import { requireAdmin, requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { POST } from "./route"

const adminSession = { user: { id: "admin1", name: "Admin", role: "admin" } } as never
const editorSession = { user: { id: "editor1", name: "Editor", role: "editor" } } as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
  vi.mocked(requireRole).mockResolvedValue({ session: editorSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
  vi.mocked(requireRole).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

function makeReq(words: Record<string, unknown>[]): Request {
  return new Request("http://localhost:3000/api/admin/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words }),
  })
}

describe("POST /api/admin/import", () => {
  beforeEach(() => vi.clearAllMocks())

  it("imports new words successfully", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(makeReq([{ spanish: "casa", nasaYuwe: "ya:t", category: "sustantivo" }]))
    const body = await res.json()

    expect(body.created).toBe(1)
    expect(body.skipped).toBe(0)
    expect(body.errors).toBe(0)
    // C1: mutación + bump en la misma transacción
    expect(vi.mocked(bumpContentVersion)).toHaveBeenCalledTimes(1)
  })

  it("returns 400 when words is not an array", async () => {
    allow()
    const res = await POST(
      new Request("http://localhost:3000/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: "not-an-array" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 when words array is empty", async () => {
    allow()
    const res = await POST(makeReq([]))
    expect(res.status).toBe(400)
  })

  it("returns 400 for more than 500 words", async () => {
    allow()
    const manyWords = Array.from({ length: 501 }, (_, i) => ({
      spanish: `word${i}`,
      nasaYuwe: `ny${i}`,
    }))
    const res = await POST(makeReq(manyWords))
    expect(res.status).toBe(400)
  })

  it("skips duplicates", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([{ spanish: "casa" }] as never)

    const res = await POST(makeReq([{ spanish: "casa", nasaYuwe: "ya:t" }]))
    const body = await res.json()

    expect(body.skipped).toBe(1)
    expect(body.created).toBe(0)
    // 0 filas efectivas → sin bump
    expect(vi.mocked(bumpContentVersion)).not.toHaveBeenCalled()
  })

  it("entra en BORRADOR por defecto y detecta duplicado insensible a mayúsculas [B1.10]", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([{ spanish: "CASA" }] as never)
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "n1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(
      makeReq([
        { spanish: "casa", nasaYuwe: "ya:t" },
        { spanish: "sol", nasaYuwe: "kiwe" },
      ])
    )
    const body = await res.json()

    expect(body.skipped).toBe(1)
    expect(body.created).toBe(1)
    expect(vi.mocked(db.dictionaryWord.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({ spanish: "sol", status: "DRAFT" }),
    })
    expect(vi.mocked(bumpContentVersion)).toHaveBeenCalledTimes(1)
  })

  it("counts rows with missing required fields as errors", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])

    const res = await POST(makeReq([
      { spanish: "", nasaYuwe: "" },
      { spanish: "sol", nasaYuwe: "" },
    ]))
    const body = await res.json()

    expect(body.errors).toBe(2)
    expect(body.created).toBe(0)
    // 0 filas efectivas → sin bump
    expect(vi.mocked(bumpContentVersion)).not.toHaveBeenCalled()
  })

  it("handles nasa_yuwe (underscore variant)", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(makeReq([{ spanish: "sol", nasa_yuwe: "kiwe" }]))
    const body = await res.json()

    expect(body.created).toBe(1)
    expect(vi.mocked(bumpContentVersion)).toHaveBeenCalledTimes(1)
  })

  it("normalizes status values", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeReq([{ spanish: "sol", nasaYuwe: "kiwe", status: "BORRADOR" }]))

    expect(vi.mocked(db.dictionaryWord.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      })
    )
    expect(vi.mocked(bumpContentVersion)).toHaveBeenCalledTimes(1)
  })

  it("creates audit log when at least one word is created", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeReq([{ spanish: "casa", nasaYuwe: "ya:t" }]))

    expect(vi.mocked(db.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "IMPORT" }) })
    )
    expect(vi.mocked(bumpContentVersion)).toHaveBeenCalledTimes(1)
  })

  it("registra una entrada por ficha con su entityId [B1.8]", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.create)
      .mockResolvedValueOnce({ id: "n1" } as never)
      .mockResolvedValueOnce({ id: "n2" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(
      makeReq([
        { spanish: "casa", nasaYuwe: "ya:t" },
        { spanish: "agua", nasaYuwe: "yu" },
      ])
    )
    const body = await res.json()
    expect(body.created).toBe(2)
    expect(vi.mocked(bumpContentVersion)).toHaveBeenCalledTimes(1)

    const fichaCalls = vi
      .mocked(db.auditLog.create)
      .mock.calls.filter(
        (c) =>
          (c[0] as { data: { entityId?: string } }).data.entityId !== undefined
      )
    expect(fichaCalls).toHaveLength(2)
    expect(fichaCalls[0][0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ action: "IMPORT", entityId: "n1", wordId: "n1" }),
      })
    )
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await POST(makeReq([{ spanish: "casa", nasaYuwe: "ya:t" }]))
    expect(res.status).toBe(401)
  })
})
