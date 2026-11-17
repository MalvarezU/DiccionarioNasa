import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: {
      findMany: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { GET, hashDateKey } from "./route"

function req(date?: string): Request {
  const url = date
    ? `http://localhost:3000/api/dictionary/suggested-words?date=${date}`
    : "http://localhost:3000/api/dictionary/suggested-words"
  return new Request(url)
}

let illustrated: { id: string }[] = []
let nonIllustrated: { id: string }[] = []

function fullRow(id: string) {
  return {
    id,
    spanish: `es-${id}`,
    nasaYuwe: `ny-${id}`,
    pronunciation: null,
    audioUrl: null,
    illustrationUrl: illustrated.some((x) => x.id === id) ? "https://img/" + id : null,
    culturalContext: null,
    category: null,
    examples: null,
  }
}

describe("GET /api/dictionary/suggested-words", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    illustrated = []
    nonIllustrated = []
    vi.mocked(db.dictionaryWord.findMany).mockImplementation((async (args: any) => {
      const w = args?.where
      if (w?.illustrationUrl?.not === null) return illustrated as never
      if (w?.illustrationUrl === null) return nonIllustrated as never
      if (w?.id?.in) return w.id.in.map((id: string) => fullRow(id)) as never
      return [] as never
    }) as any)
  })

  it("returns 5 words for the current date", async () => {
    illustrated = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}` }))
    const response = await GET(req("2026-05-24"))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body.words)).toBe(true)
    expect(body.words).toHaveLength(5)
    expect(body.date).toBe("2026-05-24")
  })

  it("accepts custom date parameter", async () => {
    illustrated = Array.from({ length: 5 }, (_, i) => ({ id: `i${i}` }))
    const response = await GET(req("2026-01-15"))
    const body = await response.json()
    expect(body.date).toBe("2026-01-15")
  })

  it("is deterministic: same date returns same 5 words", async () => {
    illustrated = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}` }))
    const r1 = await GET(req("2026-06-01"))
    const b1 = await r1.json()
    const r2 = await GET(req("2026-06-01"))
    const b2 = await r2.json()
    expect(b1.words.map((w: any) => w.id)).toEqual(b2.words.map((w: any) => w.id))
  })

  it("returns 400 for invalid date", async () => {
    const response = await GET(req("not-a-date"))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toBeDefined()
  })

  it("returns empty words when no words published", async () => {
    const response = await GET(req("2026-01-01"))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.words).toEqual([])
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockRejectedValue(new Error("DB error"))
    const response = await GET(req())
    expect(response.status).toBe(500)
  })

  it("prefers illustrated words when >=5 exist", async () => {
    illustrated = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}` }))
    nonIllustrated = Array.from({ length: 3 }, (_, i) => ({ id: `n${i}` }))
    const response = await GET(req("2026-03-15"))
    const body = await response.json()
    expect(body.words).toHaveLength(5)
    expect(body.words.every((w: any) => w.illustrationUrl !== null)).toBe(true)
  })

  it("fills with non-illustrated when fewer than 5 illustrated", async () => {
    illustrated = [{ id: "i0" }, { id: "i1" }]
    nonIllustrated = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}` }))
    const response = await GET(req("2026-03-15"))
    const body = await response.json()
    expect(body.words).toHaveLength(5)
    const illCount = body.words.filter((w: any) => w.illustrationUrl !== null).length
    expect(illCount).toBe(2)
  })

  it("returns fewer than 5 when total published < 5", async () => {
    illustrated = [{ id: "i0" }]
    nonIllustrated = [{ id: "n0" }]
    const response = await GET(req("2026-03-15"))
    const body = await response.json()
    expect(body.words.length).toBeLessThanOrEqual(2)
    expect(body.words.length).toBeGreaterThan(0)
  })

  it("parses examples JSON string into array", async () => {
    // override fullRow examples by mocking findMany full-rows branch
    illustrated = [{ id: "i0" }]
    // make full row return examples string
    const origImpl = vi.mocked(db.dictionaryWord.findMany).getMockImplementation()!
    vi.mocked(db.dictionaryWord.findMany).mockImplementation((async (args: any) => {
      const w = args?.where
      if (w?.illustrationUrl?.not === null) return illustrated as never
      if (w?.illustrationUrl === null) return [] as never
      if (w?.id?.in) {
        return [
          {
            id: "i0",
            spanish: "casa",
            nasaYuwe: "ya:t",
            pronunciation: null,
            audioUrl: null,
            illustrationUrl: "https://img/i0",
            culturalContext: null,
            category: null,
            examples: JSON.stringify([{ spanish: "Mi casa", nasaYuwe: "ya:t" }]),
          },
        ] as never
      }
      return [] as never
    }) as any)
    const response = await GET(req("2026-03-15"))
    const body = await response.json()
    expect(Array.isArray(body.words[0].examples)).toBe(true)
    expect(body.words[0].examples[0].spanish).toBe("Mi casa")
    // restore not needed (per test)
    void origImpl
  })

  it("only selects PUBLISHED words via illustrated/nonIllustrated queries", async () => {
    illustrated = [{ id: "i0" }]
    await GET(req("2026-01-01"))
    const calls = vi.mocked(db.dictionaryWord.findMany).mock.calls
    expect(calls[0][0]).toEqual(
      expect.objectContaining({ where: { status: "PUBLISHED", illustrationUrl: { not: null } } })
    )
    expect(calls[1][0]).toEqual(
      expect.objectContaining({ where: { status: "PUBLISHED", illustrationUrl: null } })
    )
  })
})

describe("hashDateKey", () => {
  it("is stable for the same input", () => {
    expect(hashDateKey("2026-06-01")).toBe(hashDateKey("2026-06-01"))
  })

  it("returns an unsigned 32-bit integer", () => {
    const h = hashDateKey("2026-01-01")
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(2 ** 32)
  })
})
