import { describe, it, expect, vi, beforeEach } from "vitest"
import { saveSearchHistory } from "./save-search-history"

describe("saveSearchHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }))
  })

  it("POSTs the trimmed query fire-and-forget", () => {
    saveSearchHistory("  nasa  ")
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/dictionary/search-history",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "nasa" }),
      })
    )
  })

  it("does not fetch on empty or blank queries", () => {
    saveSearchHistory("")
    saveSearchHistory("   ")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("truncates queries over 100 chars (server max)", () => {
    saveSearchHistory("x".repeat(150))
    expect(global.fetch).toHaveBeenCalledOnce()
    const body = JSON.parse(
      (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string
    )
    expect(body.query).toHaveLength(100)
  })

  it("never throws, even offline", () => {
    vi.mocked(global.fetch).mockImplementation(() => {
      throw new Error("offline")
    })
    expect(() => saveSearchHistory("nasa")).not.toThrow()
  })
})
