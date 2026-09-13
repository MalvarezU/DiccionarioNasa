import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  buildFlashcardQuestions,
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

  it("arma preguntas para palabras dadas con distractores", () => {
    const pool = [
      { id: "w1", spanish: "Casa", nasaYuwe: "Yat", pronunciation: null },
      { id: "w2", spanish: "Agua", nasaYuwe: "Yu", pronunciation: null },
      { id: "w3", spanish: "Sol", nasaYuwe: "Ate", pronunciation: null },
      { id: "w4", spanish: "Luna", nasaYuwe: "Ate2", pronunciation: null },
    ]
    const qs = buildFlashcardQuestions([pool[0]!], pool)
    expect(qs).toHaveLength(1)
    expect(qs[0]).toMatchObject({ title: "Casa", prompt: expect.stringContaining("Nasa Yuwe") })
    expect(qs[0]!.options).toHaveLength(4)
    expect(qs[0]!.options[qs[0]!.correctIndex]).toBe("Yat")

    const inv = buildFlashcardQuestions([pool[0]!], pool, "nasa-es")
    expect(inv[0]).toMatchObject({ title: "Yat" })
    expect(inv[0]!.options[inv[0]!.correctIndex]).toBe("Casa")
  })
})
