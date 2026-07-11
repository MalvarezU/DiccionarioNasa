import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: {
      findUnique: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

function makeRequest(id: string) {
  return {
    nextUrl: new URL(`http://localhost:3000/api/dictionary/words/${id}`),
  } as never
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) } as never
}

const mockWord = {
  id: "w1",
  spanish: "Casa",
  nasaYuwe: "Yat",
  pronunciation: "yat",
  audioUrl: null,
  culturalContext: "Construcción",
  category: "sustantivo",
  examples: '[{"spanish":"mi casa","nasaYuwe":"mith yat"}]',
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
}

describe("GET /api/dictionary/words/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 200 with word when found", async () => {
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(mockWord as never)
    const res = await GET(makeRequest("w1"), makeParams("w1"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.id).toBe("w1")
    expect(body.spanish).toBe("Casa")
    expect(body.examples).toEqual([{ spanish: "mi casa", nasaYuwe: "mith yat" }])
  })

  it("returns 404 when word not found", async () => {
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest("nonexistent"), makeParams("nonexistent"))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.message).toBe("Word not found")
  })

  it("returns null examples when examples field is null", async () => {
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({
      ...mockWord,
      examples: null,
    } as never)
    const res = await GET(makeRequest("w1"), makeParams("w1"))
    const body = await res.json()
    expect(body.examples).toBeNull()
  })

  it("returns null examples when examples is invalid JSON", async () => {
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({
      ...mockWord,
      examples: "dialecto Wila\"",
    } as never)
    const res = await GET(makeRequest("w1"), makeParams("w1"))
    const body = await res.json()
    expect(body.examples).toBeNull()
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.dictionaryWord.findUnique).mockRejectedValue(new Error("DB error"))
    const res = await GET(makeRequest("w1"), makeParams("w1"))
    expect(res.status).toBe(500)
  })

  it("calls findUnique with correct id", async () => {
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(mockWord as never)
    await GET(makeRequest("test-id-123"), makeParams("test-id-123"))
    expect(db.dictionaryWord.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "test-id-123" } })
    )
  })
})