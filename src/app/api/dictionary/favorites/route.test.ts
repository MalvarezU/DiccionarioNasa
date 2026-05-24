import { vi, describe, it, expect, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findUnique: vi.fn() },
    favorite: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
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
import { GET, POST } from "./route"

function req(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init)
}

const mockWord = { id: "w1", spanish: "casa", nasaYuwe: "ya:t" }
const mockFavorite = {
  id: "fav1",
  wordId: "w1",
  createdAt: new Date().toISOString(),
  word: mockWord,
}

describe("GET /api/dictionary/favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns isFavorite=true when word is favorited", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.favorite.findUnique).mockResolvedValue(mockFavorite)

    const response = await GET(req("http://localhost:3000/api/dictionary/favorites?wordId=w1"))
    const body = await response.json()

    expect(body.isFavorite).toBe(true)
  })

  it("returns isFavorite=false when word is not favorited", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.favorite.findUnique).mockResolvedValue(null)

    const response = await GET(req("http://localhost:3000/api/dictionary/favorites?wordId=w1"))
    const body = await response.json()

    expect(body.isFavorite).toBe(false)
  })

  it("returns all favorites when no wordId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.favorite.findMany).mockResolvedValue([mockFavorite])

    const response = await GET(req("http://localhost:3000/api/dictionary/favorites"))
    const body = await response.json()

    expect(body.favorites).toHaveLength(1)
  })

  it("returns empty favorites when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await GET(req("http://localhost:3000/api/dictionary/favorites?wordId=w1"))
    const body = await response.json()

    expect(body.isFavorite).toBe(false)
  })
})

describe("POST /api/dictionary/favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates favorite when word is not favorited", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(mockWord as never)
    vi.mocked(db.favorite.findUnique).mockResolvedValue(null)
    vi.mocked(db.favorite.create).mockResolvedValue({ id: "new" } as never)

    const response = await POST(
      req("http://localhost:3000/api/dictionary/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "w1" }),
      })
    )
    const body = await response.json()

    expect(body.isFavorite).toBe(true)
    expect(vi.mocked(db.favorite.create)).toHaveBeenCalled()
  })

  it("removes favorite when already favorited (toggle off)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(mockWord as never)
    vi.mocked(db.favorite.findUnique).mockResolvedValue(mockFavorite)
    vi.mocked(db.favorite.delete).mockResolvedValue({} as never)

    const response = await POST(
      req("http://localhost:3000/api/dictionary/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "w1" }),
      })
    )
    const body = await response.json()

    expect(body.isFavorite).toBe(false)
    expect(vi.mocked(db.favorite.delete)).toHaveBeenCalled()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await POST(
      req("http://localhost:3000/api/dictionary/favorites", {
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
      req("http://localhost:3000/api/dictionary/favorites", {
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
      req("http://localhost:3000/api/dictionary/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "nonexistent" }),
      })
    )
    expect(response.status).toBe(404)
  })

  it("returns 500 on database error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", role: "user" } as never,
    })
    vi.mocked(db.dictionaryWord.findUnique).mockRejectedValue(new Error("DB error"))

    const response = await POST(
      req("http://localhost:3000/api/dictionary/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: "w1" }),
      })
    )
    expect(response.status).toBe(500)
  })
})
