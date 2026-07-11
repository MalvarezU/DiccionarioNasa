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

function makeRequest(query: string = "") {
  return {
    nextUrl: new URL(
      `http://localhost:3000/api/dictionary/export${query ? "?" + query : ""}`
    ),
  } as never
}

const mockWords = [
  {
    id: "w1",
    spanish: "Agua",
    nasaYuwe: "yu'",
    pronunciation: "yuʔ",
    audioUrl: null,
    culturalContext: null,
    category: "sustantivo",
    examples: '[{"spanish":"agua limpia","nasaYuwe":"yu we"}]',
    status: "PUBLISHED",
  },
  {
    id: "w2",
    spanish: "Casa",
    nasaYuwe: "Yat",
    pronunciation: "yat",
    audioUrl: null,
    culturalContext: "Construcción",
    category: "sustantivo",
    examples: null,
    status: "PUBLISHED",
  },
]

describe("GET /api/dictionary/export", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns paginated words with default params", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords as never)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(2)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.words).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(500)
    expect(body.hasMore).toBe(false)
  })

  it("parses examples JSON correctly", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords as never)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(2)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.words[0].examples).toEqual([
      { spanish: "agua limpia", nasaYuwe: "yu we" },
    ])
    expect(body.words[1].examples).toBeNull()
  })

  it("handles invalid examples JSON gracefully", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([
      { ...mockWords[0], examples: "dialecto Wila\"" },
    ] as never)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(1)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.words[0].examples).toBeNull()
  })

  it("respects page and pageSize params", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mockWords[1]] as never)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(50)

    const res = await GET(makeRequest("page=2&pageSize=1"))
    const body = await res.json()

    expect(body.page).toBe(2)
    expect(body.pageSize).toBe(1)
    expect(body.hasMore).toBe(true)
  })

  it("caps pageSize at 1000", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(0)

    const res = await GET(makeRequest("pageSize=5000"))
    const body = await res.json()

    expect(body.pageSize).toBe(1000)
  })

  it("defaults page to 1 for invalid values", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(0)

    const res = await GET(makeRequest("page=abc&pageSize=xyz"))
    const body = await res.json()

    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(500)
  })

  it("filters by since date when provided", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(0)

    await GET(makeRequest("since=2025-01-01T00:00:00.000Z"))

    expect(db.dictionaryWord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { updatedAt: { gt: new Date("2025-01-01T00:00:00.000Z") } },
      })
    )
  })

  it("returns 400 for invalid since date", async () => {
    const res = await GET(makeRequest("since=not-a-date"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain("Invalid")
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockRejectedValue(new Error("DB error"))

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })

  it("includes status field in response", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue(mockWords as never)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(2)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.words[0].status).toBe("PUBLISHED")
  })
})