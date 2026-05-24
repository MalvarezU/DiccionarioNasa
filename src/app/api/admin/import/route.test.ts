import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
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
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(makeReq([{ spanish: "casa", nasaYuwe: "ya:t", category: "sustantivo" }]))
    const body = await res.json()

    expect(body.created).toBe(1)
    expect(body.skipped).toBe(0)
    expect(body.errors).toBe(0)
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
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue({ id: "existing" } as never)

    const res = await POST(makeReq([{ spanish: "casa", nasaYuwe: "ya:t" }]))
    const body = await res.json()

    expect(body.skipped).toBe(1)
    expect(body.created).toBe(0)
  })

  it("counts rows with missing required fields as errors", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null)

    const res = await POST(makeReq([
      { spanish: "", nasaYuwe: "" },
      { spanish: "sol", nasaYuwe: "" },
    ]))
    const body = await res.json()

    expect(body.errors).toBe(2)
    expect(body.created).toBe(0)
  })

  it("handles nasa_yuwe (underscore variant)", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(makeReq([{ spanish: "sol", nasa_yuwe: "kiwe" }]))
    const body = await res.json()

    expect(body.created).toBe(1)
  })

  it("normalizes status values", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeReq([{ spanish: "sol", nasaYuwe: "kiwe", status: "BORRADOR" }]))

    expect(vi.mocked(db.dictionaryWord.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      })
    )
  })

  it("creates audit log when at least one word is created", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeReq([{ spanish: "casa", nasaYuwe: "ya:t" }]))

    expect(vi.mocked(db.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "IMPORT" }) })
    )
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await POST(makeReq([{ spanish: "casa", nasaYuwe: "ya:t" }]))
    expect(res.status).toBe(401)
  })
})
