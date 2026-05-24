import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { count: vi.fn() },
    user: { count: vi.fn() },
    favorite: { count: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET } from "./route"

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: { user: { id: "admin1", role: "admin" } } as never,
    error: null,
  })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

describe("GET /api/admin/stats", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns all dashboard stats", async () => {
    allow()
    vi.mocked(db.dictionaryWord.count).mockResolvedValueOnce(100) // totalWords
      .mockResolvedValueOnce(10)  // draftCount
      .mockResolvedValueOnce(80)  // publishedCount
      .mockResolvedValueOnce(10)  // archivedCount
      .mockResolvedValueOnce(50)  // wordsWithAudio
      .mockResolvedValueOnce(30)  // publishedWithoutAudio
      .mockResolvedValueOnce(7)   // recentWords
    vi.mocked(db.user.count).mockResolvedValue(20)
    vi.mocked(db.favorite.count).mockResolvedValue(200)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])

    const res = await GET()
    const body = await res.json()

    expect(body.totalWords).toBe(100)
    expect(body.draftCount).toBe(10)
    expect(body.publishedCount).toBe(80)
    expect(body.archivedCount).toBe(10)
    expect(body.wordsWithAudio).toBe(50)
    expect(body.publishedWithoutAudio).toBe(30)
    expect(body.totalUsers).toBe(20)
    expect(body.totalFavorites).toBe(200)
    expect(body.recentWords).toBe(7)
    expect(body.recentAuditLogs).toEqual([])
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 500 on DB error", async () => {
    allow()
    vi.mocked(db.dictionaryWord.count).mockRejectedValue(new Error("DB error"))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
