import { vi, describe, it, expect, beforeEach } from "vitest"

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

const mockWords = [
  {
    id: "1",
    spanish: "casa",
    nasaYuwe: "ya:t",
    pronunciation: "yaat",
    category: "sustantivo",
    culturalContext: "Vivienda",
  },
  {
    id: "2",
    spanish: "sol",
    nasaYuwe: "kiwe",
    pronunciation: "kiwe",
    category: "sustantivo",
    culturalContext: "Astro",
  },
]

describe("GET /api/dictionary/featured", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns featured words and total count", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(42)

    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.words).toHaveLength(2)
    expect(body.totalWords).toBe(42)
  })

  it("only queries PUBLISHED words", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(0)

    await GET()

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" } })
    )
    expect(vi.mocked(db.dictionaryWord.count)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" } })
    )
  })

  it("limits to 12 words", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(100)

    await GET()

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 12 })
    )
  })

  it("returns 200 with empty array when no words", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(0)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.words).toEqual([])
    expect(body.totalWords).toBe(0)
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockRejectedValue(new Error("DB error"))

    const response = await GET()
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.words).toEqual([])
  })

  it("orders by spanish ascending", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(2)

    await GET()

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { spanish: "asc" } })
    )
  })
})
