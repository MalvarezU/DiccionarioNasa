import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

function req(date?: string): Request {
  const url = date
    ? `http://localhost:3000/api/dictionary/word-of-day?date=${date}`
    : "http://localhost:3000/api/dictionary/word-of-day"
  return new Request(url)
}

const mockWord = {
  id: "1",
  spanish: "casa",
  nasaYuwe: "ya:t",
  pronunciation: "yaat",
  audioUrl: "/audio/casa.mp3",
  culturalContext: "Vivienda",
  category: "sustantivo",
  examples: null,
}

const mockWordWithExamples = {
  ...mockWord,
  examples: JSON.stringify([{ spanish: "Mi casa", nasaYuwe: "ya:t" }]),
}

describe("GET /api/dictionary/word-of-day", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a word for the current date", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(10)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mockWord])

    const response = await GET(req())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.word).not.toBeNull()
    expect(body.word.spanish).toBe("casa")
    expect(body.date).toBeDefined()
  })

  it("accepts custom date parameter", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(100)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mockWord])

    const response = await GET(req("2026-01-15"))
    const body = await response.json()

    expect(body.date).toBe("2026-01-15")
    expect(body.word).not.toBeNull()
  })

  it("is deterministic: same date returns same word index", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(100)

    await GET(req("2026-06-01"))
    const { skip } = vi.mocked(db.dictionaryWord.findMany).mock.calls[0][0]

    vi.mocked(db.dictionaryWord.findMany).mockClear()

    await GET(req("2026-06-01"))
    const { skip: skip2 } = vi.mocked(db.dictionaryWord.findMany).mock.calls[0][0]

    expect(skip).toBe(skip2)
  })

  it("returns 400 for invalid date", async () => {
    const response = await GET(req("not-a-date"))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.message).toBeDefined()
  })

  it("returns word: null when no words published", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(0)

    const response = await GET(req("2026-01-01"))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.word).toBeNull()
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.dictionaryWord.count).mockRejectedValue(new Error("DB error"))

    const response = await GET(req())
    expect(response.status).toBe(500)
  })

  it("parses examples JSON string into array", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(50)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mockWordWithExamples])

    const response = await GET(req("2026-03-15"))
    const body = await response.json()

    expect(Array.isArray(body.word.examples)).toBe(true)
    expect(body.word.examples[0].spanish).toBe("Mi casa")
  })

  it("only selects PUBLISHED words", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(5)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mockWord])

    await GET(req("2026-01-01"))

    expect(vi.mocked(db.dictionaryWord.count)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" } })
    )
    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" } })
    )
  })

  it("selects exactly one word (take: 1)", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(100)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mockWord])

    await GET(req("2026-01-01"))

    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    )
  })
})
