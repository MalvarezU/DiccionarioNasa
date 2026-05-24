import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET, POST } from "./route"

const adminSession = { user: { id: "admin1", name: "Admin", email: "a@b.com", role: "admin" } } as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

const mockWord = {
  id: "w1",
  spanish: "casa",
  nasaYuwe: "ya:t",
  pronunciation: "yaat",
  audioUrl: null,
  culturalContext: "Vivienda",
  category: "sustantivo",
  status: "PUBLISHED",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe("GET /api/admin/words", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns paginated words with filters", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mockWord])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(50)

    const res = await GET(new Request("http://localhost:3000/api/admin/words?page=1&pageSize=20"))
    const body = await res.json()

    expect(body.words).toHaveLength(1)
    expect(body.total).toBe(50)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(20)
  })

  it("filters by status", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(0)

    await GET(new Request("http://localhost:3000/api/admin/words?status=DRAFT"))

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "DRAFT" } })
    )
  })

  it("filters by search query", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(0)

    await GET(new Request("http://localhost:3000/api/admin/words?search=casa"))

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ spanish: { contains: "casa" } }, { nasaYuwe: { contains: "casa" } }] },
      })
    )
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await GET(new Request("http://localhost:3000/api/admin/words"))
    expect(res.status).toBe(401)
  })

  it("returns 500 on DB error", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockRejectedValue(new Error("DB error"))
    const res = await GET(new Request("http://localhost:3000/api/admin/words"))
    expect(res.status).toBe(500)
  })
})

describe("POST /api/admin/words", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a new word", async () => {
    allow()
    vi.mocked(db.dictionaryWord.create).mockResolvedValue(mockWord)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(
      new Request("http://localhost:3000/api/admin/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spanish: "casa",
          nasaYuwe: "ya:t",
          category: "sustantivo",
          examples: [{ spanish: "Mi casa", nasaYuwe: "ya:t" }],
        }),
      })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.word.spanish).toBe("casa")
  })

  it("returns 400 when required fields missing", async () => {
    allow()
    const res = await POST(
      new Request("http://localhost:3000/api/admin/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spanish: "casa" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await POST(
      new Request("http://localhost:3000/api/admin/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spanish: "casa", nasaYuwe: "ya:t" }),
      })
    )
    expect(res.status).toBe(401)
  })

  it("returns 500 on DB error", async () => {
    allow()
    vi.mocked(db.dictionaryWord.create).mockRejectedValue(new Error("DB error"))

    const res = await POST(
      new Request("http://localhost:3000/api/admin/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spanish: "casa", nasaYuwe: "ya:t" }),
      })
    )
    expect(res.status).toBe(500)
  })
})
