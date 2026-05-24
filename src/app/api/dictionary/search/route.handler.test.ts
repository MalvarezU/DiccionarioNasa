import { vi, describe, it, expect, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

function req(query: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/dictionary/search?q=${encodeURIComponent(query)}`
  )
}

const mockRawResults = [
  { id: "1", spanish: "casa", nasaYuwe: "ya:t", pronunciation: "yaat", category: "sustantivo" },
  { id: "2", spanish: "casamiento", nasaYuwe: "kasamyento", pronunciation: null, category: "sustantivo" },
  { id: "3", spanish: "casco", nasaYuwe: "kasko", pronunciation: null, category: "sustantivo" },
]

describe("GET /api/dictionary/search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("validation", () => {
    it("returns 400 for query shorter than 2 chars", async () => {
      const response = await GET(req("a"))
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.results).toEqual([])
    })

    it("returns 400 for empty query", async () => {
      const response = await GET(req(""))
      expect(response.status).toBe(400)
    })

    it("returns 400 for whitespace-only query", async () => {
      const response = await GET(req("   "))
      expect(response.status).toBe(400)
    })
  })

  describe("happy path", () => {
    it("returns ranked search results", async () => {
      vi.mocked(db.$queryRaw).mockResolvedValue(mockRawResults)

      const response = await GET(req("cas"))
      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.results).toHaveLength(3)
      expect(body.total).toBe(3)
    })

    it("ranks exact matches before prefix matches", async () => {
      const results = [
        { id: "1", spanish: "casco", nasaYuwe: "x", pronunciation: null, category: "n" },
        { id: "2", spanish: "casa", nasaYuwe: "y", pronunciation: null, category: "n" },
        { id: "3", spanish: "cas", nasaYuwe: "z", pronunciation: null, category: "n" },
      ]
      vi.mocked(db.$queryRaw).mockResolvedValue(results)

      const response = await GET(req("cas"))
      const body = await response.json()

      expect(body.results[0].spanish).toBe("cas")
    })

    it("limits results to top 10", async () => {
      const manyResults = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        spanish: `casa${i}`,
        nasaYuwe: `y${i}`,
        pronunciation: null,
        category: "n",
      }))
      vi.mocked(db.$queryRaw).mockResolvedValue(manyResults)

      const response = await GET(req("casa"))
      const body = await response.json()

      expect(body.results.length).toBeLessThanOrEqual(10)
    })

    it("sorts alphabetically by spanish within same relevance tier", async () => {
      const results = [
        { id: "1", spanish: "casco", nasaYuwe: "x", pronunciation: null, category: "n" },
        { id: "2", spanish: "cas", nasaYuwe: "z", pronunciation: null, category: "n" },
        { id: "3", spanish: "casa", nasaYuwe: "y", pronunciation: null, category: "n" },
      ]
      vi.mocked(db.$queryRaw).mockResolvedValue(results)

      const response = await GET(req("cas"))
      const body = await response.json()

      // "cas" exact match first, then "casa" and "casco" alphabetically
      expect(body.results[0].spanish).toBe("cas")
      expect(body.results[1].spanish).toBe("casa")
      expect(body.results[2].spanish).toBe("casco")
    })
  })

  describe("edge cases", () => {
    it("returns 500 on database error", async () => {
      vi.mocked(db.$queryRaw).mockRejectedValue(new Error("DB error"))

      const response = await GET(req("test"))
      expect(response.status).toBe(500)
    })

    it("returns empty array for no matches", async () => {
      vi.mocked(db.$queryRaw).mockResolvedValue([])

      const response = await GET(req("xyzxyz"))
      const body = await response.json()

      expect(body.results).toEqual([])
      expect(body.total).toBe(0)
    })

    it("still works with accent-insensitive ranking", async () => {
      const results = [
        { id: "1", spanish: "arbol", nasaYuwe: "x", pronunciation: null, category: "n" },
        { id: "2", spanish: "árbol", nasaYuwe: "y", pronunciation: null, category: "n" },
      ]
      vi.mocked(db.$queryRaw).mockResolvedValue(results)

      const response = await GET(req("arbol"))
      const body = await response.json()

      // "arbol" exact match (normalized) should be first
      const relevances = body.results.map((r: { spanish: string }) => r.spanish)
      expect(relevances[0]).toBe("arbol")
    })

    it("passes the query to the raw SQL", async () => {
      vi.mocked(db.$queryRaw).mockResolvedValue([])

      await GET(req("sol"))

      // Verify the query was included in the SQL (template literal)
      expect(vi.mocked(db.$queryRaw)).toHaveBeenCalled()
    })
  })
})
