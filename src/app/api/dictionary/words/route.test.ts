import { vi, describe, it, expect, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

function req(url: string): NextRequest {
  return new NextRequest(url)
}

const mockWords = [
  {
    id: "1",
    spanish: "casa",
    nasaYuwe: "ya:t",
    pronunciation: "yaat",
    audioUrl: "/audio/casa.mp3",
    culturalContext: "Vivienda",
    category: "sustantivo",
    examples: null,
  },
]

const mockWordWithExamples = {
  ...mockWords[0],
  examples: JSON.stringify([
    { spanish: "Mi casa", nasaYuwe: "ya:t" },
  ]),
}

describe("GET /api/dictionary/words", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns paginated words with default params", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(50)

    const response = await GET(req("http://localhost:3000/api/dictionary/words"))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.words).toHaveLength(1)
    expect(body.total).toBe(50)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(100)
    expect(body.totalPages).toBe(1)
  })

  it("respects page and pageSize params", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(250)

    const response = await GET(
      req("http://localhost:3000/api/dictionary/words?page=3&pageSize=10")
    )
    const body = await response.json()

    expect(body.page).toBe(3)
    expect(body.pageSize).toBe(10)
    expect(body.totalPages).toBe(25)

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    )
  })

  it("caps pageSize at 500", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(1000)

    await GET(
      req("http://localhost:3000/api/dictionary/words?pageSize=9999")
    )

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    )
  })

  it("enforces minimum pageSize of 1", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(100)

    await GET(
      req("http://localhost:3000/api/dictionary/words?pageSize=0")
    )

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    )
  })

  it("clamps page to minimum 1", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(100)

    const response = await GET(
      req("http://localhost:3000/api/dictionary/words?page=-5")
    )
    const body = await response.json()

    expect(body.page).toBe(1)
  })

  it("parses examples JSON for each word", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mockWordWithExamples])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(1)

    const response = await GET(req("http://localhost:3000/api/dictionary/words"))
    const body = await response.json()

    expect(Array.isArray(body.words[0].examples)).toBe(true)
    expect(body.words[0].examples[0].spanish).toBe("Mi casa")
  })

  it("orders by spanish ascending", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(1)

    await GET(req("http://localhost:3000/api/dictionary/words"))

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { spanish: "asc" } })
    )
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockRejectedValue(new Error("DB error"))

    const response = await GET(req("http://localhost:3000/api/dictionary/words"))
    expect(response.status).toBe(500)
  })
})
