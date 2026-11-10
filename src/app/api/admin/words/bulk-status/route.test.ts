import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    dictionaryWord: { findUnique: vi.fn(), update: vi.fn() },
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

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { POST } from "./route"

const adminSession = { user: { id: "admin1", name: "Admin", role: "admin" } } as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

describe("POST /api/admin/words/bulk-status", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates status for multiple words", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique)
      .mockResolvedValueOnce({ id: "w1", status: "DRAFT" } as never)
      .mockResolvedValueOnce({ id: "w2", status: "ARCHIVED" } as never)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ["w1", "w2"], status: "PUBLISHED" }),
      })
    )
    const body = await res.json()

    expect(body.updated).toBe(2)
    expect(body.skipped).toBe(0)
    expect(body.total).toBe(2)
    // BUMP-02: N filas efectivas = exactamente un bump.
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("skips words already in target status", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique)
      .mockResolvedValueOnce({ id: "w1", status: "PUBLISHED" } as never)
      .mockResolvedValueOnce({ id: "w2", status: "DRAFT" } as never)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ["w1", "w2"], status: "PUBLISHED" }),
      })
    )
    const body = await res.json()

    expect(body.updated).toBe(1)
    expect(body.skipped).toBe(1)
  })

  it("skips non-existent words", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique)
      .mockResolvedValueOnce(null)

    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ["nonexistent"], status: "PUBLISHED" }),
      })
    )
    const body = await res.json()

    expect(body.skipped).toBe(1)
    expect(body.updated).toBe(0)
    // BUMP-03: 0 filas efectivas → sin bump.
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })

  it("normalizes lowercase status and bumps once", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValueOnce({ id: "w1", status: "DRAFT" } as never)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ["w1"], status: "published" }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.updated).toBe(1)
    expect(vi.mocked(db.dictionaryWord.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PUBLISHED" } })
    )
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("returns 400 for invalid status without bump", async () => {
    allow()
    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ["w1"], status: "WRONG" }),
      })
    )
    expect(res.status).toBe(400)
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })

  it("returns 400 for empty wordIds", async () => {
    allow()
    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: [], status: "PUBLISHED" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid status", async () => {
    allow()
    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ["w1"], status: "DRAFT" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for more than 500 words", async () => {
    allow()
    const ids = Array.from({ length: 501 }, (_, i) => `w${i}`)
    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ids, status: "PUBLISHED" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ["w1"], status: "PUBLISHED" }),
      })
    )
    expect(res.status).toBe(401)
  })

  it("editor recibe 403 en lote (solo admin) [B1.5]", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      session: null,
      error: Response.json({ message: "Acceso denegado" }, { status: 403 }),
    })
    const res = await POST(
      new Request("http://localhost:3000/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: ["w1"], status: "PUBLISHED" }),
      })
    )
    expect(res.status).toBe(403)
  })
})
