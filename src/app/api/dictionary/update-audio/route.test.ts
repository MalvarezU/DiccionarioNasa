import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: {
      updateMany: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { POST } from "./route"

describe("POST /api/dictionary/update-audio", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates audio URLs for all predefined words", async () => {
    vi.mocked(db.dictionaryWord.updateMany).mockResolvedValue({ count: 1 } as never)

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results).toBeDefined()
    expect(body.results.length).toBe(9)
  })

  it("calls updateMany for each word in the audio map", async () => {
    vi.mocked(db.dictionaryWord.updateMany).mockResolvedValue({ count: 1 } as never)

    await POST()

    expect(db.dictionaryWord.updateMany).toHaveBeenCalledTimes(9)
  })

  it("includes the count of updated records in results", async () => {
    vi.mocked(db.dictionaryWord.updateMany).mockResolvedValue({ count: 0 } as never)

    const res = await POST()
    const body = await res.json()

    expect(body.results[0]).toContain(": 0 updated")
  })

  it("passes the correct spanish word and audioUrl to updateMany", async () => {
    vi.mocked(db.dictionaryWord.updateMany).mockResolvedValue({ count: 1 } as never)

    await POST()

    const firstCall = vi.mocked(db.dictionaryWord.updateMany).mock.calls[0][0]
    expect(firstCall.where).toHaveProperty("spanish")
    expect(firstCall.data).toHaveProperty("audioUrl")
  })
})