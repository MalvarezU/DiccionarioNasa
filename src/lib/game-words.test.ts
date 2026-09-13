import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  fetchGameWords,
  gameWordsOrDemo,
  getSessionKey,
  loadGameBest,
  reportGameResult,
  saveGameBest,
} from "./game-words"

describe("game-words [B2.1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    global.fetch = vi.fn()
  })

  it("trae palabras reales y filtra incompletas", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        words: [
          { id: "w1", spanish: "Casa", nasaYuwe: "Yat" },
          { id: "w2", spanish: "", nasaYuwe: "X" },
        ],
      }) as never
    )
    const words = await fetchGameWords(12)
    expect(words).toEqual([{ id: "w1", spanish: "Casa", nasaYuwe: "Yat" }])
    expect(fetch).toHaveBeenCalledWith("/api/games/words?count=12")
  })

  it("fallback a demo si la API falla o trae pocas", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("red"))
    const words = await gameWordsOrDemo(8)
    expect(words.length).toBeGreaterThanOrEqual(8)
    expect(words[0]).toMatchObject({ id: expect.any(String), spanish: expect.any(String) })
  })

  it("guarda mejores locales y usa sessionKey estable", () => {
    expect(loadGameBest("flashcards")).toEqual({ bestScore: 0, bestStreak: 0, played: 0 })
    const k1 = getSessionKey()
    const k2 = getSessionKey()
    expect(k1).toBe(k2)
    const best = saveGameBest("flashcards", 80, 4)
    expect(best).toEqual({ bestScore: 80, bestStreak: 4, played: 1 })
    expect(loadGameBest("flashcards").bestScore).toBe(80)
  })

  it("reporta al backend best-effort (guarda local aunque falle red)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("red"))
    expect(await reportGameResult({ game: "memory", won: true, score: 10, streak: 1 })).toBe(false)
    expect(loadGameBest("memory").played).toBe(1)

    vi.mocked(fetch).mockResolvedValue(Response.json({ saved: true }) as never)
    expect(await reportGameResult({ game: "memory", won: true, score: 10, streak: 1 })).toBe(true)
    const [, opts] = vi.mocked(fetch).mock.calls[0] as unknown as [string, { body: string }]
    expect(JSON.parse(opts.body)).toMatchObject({ game: "memory", sessionKey: expect.any(String) })
  })
})
