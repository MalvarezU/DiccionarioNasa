import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { __resetRateLimitStore } from "@/lib/rate-limit"
import { POST } from "./route"

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  } as never
}

describe("POST /api/dictionary/suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitStore()
  })

  it("accepts a valid suggestion", async () => {
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await POST(
      makeRequest({ term: "casa", comment: "palabra nueva" })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toContain("Sugerencia")
  })

  it("stores suggestion with action SUGGEST", async () => {
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeRequest({ term: "agua" }))

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "SUGGEST",
          entity: "DictionaryWord",
        }),
      })
    )
  })

  it("serializes term and comment as JSON changes", async () => {
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeRequest({ term: "sol", comment: " Astro del dia " }))

    const call = vi.mocked(db.auditLog.create).mock.calls[0][0]
    const changes = JSON.parse(call.data.changes as string)
    expect(changes.term).toBe("sol")
    expect(changes.comment).toBe("Astro del dia")
    expect(changes.source).toBe("community")
  })

  it("returns 400 when term is missing", async () => {
    const res = await POST(makeRequest({ comment: "test" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain("2 caracteres")
  })

  it("returns 400 when term is too short (< 2 chars)", async () => {
    const res = await POST(makeRequest({ term: "a" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when term is not a string", async () => {
    const res = await POST(makeRequest({ term: 123 }))
    expect(res.status).toBe(400)
  })

  it("trims the term before storing", async () => {
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeRequest({ term: "  casa  " }))

    const call = vi.mocked(db.auditLog.create).mock.calls[0][0]
    const changes = JSON.parse(call.data.changes as string)
    expect(changes.term).toBe("casa")
  })

  it("stores null comment when not provided", async () => {
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeRequest({ term: "casa" }))

    const call = vi.mocked(db.auditLog.create).mock.calls[0][0]
    const changes = JSON.parse(call.data.changes as string)
    expect(changes.comment).toBeNull()
  })

  it("stores empty comment as null", async () => {
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    await POST(makeRequest({ term: "casa", comment: "   " }))

    const call = vi.mocked(db.auditLog.create).mock.calls[0][0]
    const changes = JSON.parse(call.data.changes as string)
    expect(changes.comment).toBeNull()
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.auditLog.create).mockRejectedValue(new Error("DB error"))

    const res = await POST(makeRequest({ term: "casa" }))
    expect(res.status).toBe(500)
  })

  it("returns 400 when term exceeds max length", async () => {
    const res = await POST(makeRequest({ term: "a".repeat(101) }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when comment exceeds max length", async () => {
    const res = await POST(
      makeRequest({ term: "casa", comment: "b".repeat(501) })
    )
    expect(res.status).toBe(400)
  })

  it("returns 429 after exceeding 5 requests per minute", async () => {
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ term: `casa${i}` }))
      expect(res.status).toBe(200)
    }

    const limited = await POST(makeRequest({ term: "casa5" }))
    expect(limited.status).toBe(429)
    expect(limited.headers.get("Retry-After")).toBeDefined()
  })
})