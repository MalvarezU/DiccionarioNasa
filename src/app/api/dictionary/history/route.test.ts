import { vi, describe, it, expect, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findUnique: vi.fn() },
    viewHistory: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  default: vi.fn(),
}))

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(),
}))

vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
}))

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}))

import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { GET, POST, DELETE } from "./route"

function req(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init)
}

const mockHistoryEntry = {
  id: "h1",
  wordId: "w1",
  createdAt: new Date().toISOString(),
  word: {
    id: "w1",
    spanish: "casa",
    nasaYuwe: "ya:t",
    pronunciation: "yaat",
    category: "sustantivo",
    audioUrl: null,
  },
}

describe("GET /api/dictionary/history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns history entries for authenticated user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.viewHistory.findMany).mockResolvedValue([mockHistoryEntry])

    const response = await GET()
    const body = await response.json()

    expect(body.history).toHaveLength(1)
    expect(body.history[0].word.spanish).toBe("casa")
  })

  it("returns empty history when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await GET()
    const body = await response.json()

    expect(body.history).toEqual([])
  })

  it("returns 500 on database error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.viewHistory.findMany).mockRejectedValue(new Error("DB error"))

    const response = await GET()
    expect(response.status).toBe(500)
  })
})

describe("POST /api/dictionary/history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a history entry", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({ id: "w1" } as never)
    vi.mocked(db.viewHistory.upsert).mockResolvedValue({ id: "h1" } as never)

    const response = await POST(
      req("http://localhost:3000/api/dictionary/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "w1" }),
      })
    )
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.id).toBe("h1")
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await POST(
      req("http://localhost:3000/api/dictionary/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "w1" }),
      })
    )
    expect(response.status).toBe(401)
  })

  it("returns 400 when wordId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })

    const response = await POST(
      req("http://localhost:3000/api/dictionary/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    )
    expect(response.status).toBe(400)
  })

  it("returns 404 when word does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(null)

    const response = await POST(
      req("http://localhost:3000/api/dictionary/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "nonexistent" }),
      })
    )
    expect(response.status).toBe(404)
  })

  it("upserts when entry already exists (bumps timestamp)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({ id: "w1" } as never)
    vi.mocked(db.viewHistory.upsert).mockResolvedValue({ id: "h1" } as never)

    const response = await POST(
      req("http://localhost:3000/api/dictionary/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "w1" }),
      })
    )
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(vi.mocked(db.viewHistory.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_wordId: { userId: "user1", wordId: "w1" } },
        create: { userId: "user1", wordId: "w1" },
        update: expect.objectContaining({ createdAt: expect.any(Date) }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.dictionaryWord.findUnique).mockRejectedValue(new Error("DB error"))

    const response = await POST(
      req("http://localhost:3000/api/dictionary/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "w1" }),
      })
    )
    expect(response.status).toBe(500)
  })
})

describe("DELETE /api/dictionary/history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("clears all history for authenticated user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.viewHistory.deleteMany).mockResolvedValue({ count: 3 } as never)

    const response = await DELETE()
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(vi.mocked(db.viewHistory.deleteMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user1" } })
    )
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await DELETE()
    expect(response.status).toBe(401)
  })

  it("returns 500 on database error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.viewHistory.deleteMany).mockRejectedValue(new Error("DB error"))

    const response = await DELETE()
    expect(response.status).toBe(500)
  })
})
