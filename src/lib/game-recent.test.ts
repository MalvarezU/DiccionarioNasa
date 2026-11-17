import { describe, it, expect, vi, beforeEach } from "vitest"
import { RECENT_MAX, recentWordIds, trackWordIds } from "./game-recent"

const KEY = "piiyaak:game:v1:recent"

describe("game-recent [B2.1]", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("round-trip: trackWordIds guarda y recentWordIds lee (más reciente primero)", () => {
    trackWordIds(["a", "b", "c"])
    expect(recentWordIds()).toEqual(["a", "b", "c"])
  })

  it("respeta el cap de 48 (RECENT_MAX) y conserva los más recientes", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `id${i}`)
    trackWordIds(ids)
    const stored = recentWordIds()
    expect(stored).toHaveLength(RECENT_MAX)
    expect(stored[0]).toBe("id0")
    expect(stored).toContain("id47")
    expect(stored).not.toContain("id59")
  })

  it("deduplica preservando la recencia (el repetido sube al frente)", () => {
    trackWordIds(["a", "b"])
    trackWordIds(["b", "c"])
    expect(recentWordIds()).toEqual(["b", "c", "a"])
  })

  it("tolera JSON corrupto y valores no-array", () => {
    localStorage.setItem(KEY, "{bad json")
    expect(recentWordIds()).toEqual([])
    localStorage.setItem(KEY, JSON.stringify({ hola: 1 }))
    expect(recentWordIds()).toEqual([])
    localStorage.setItem(KEY, JSON.stringify("no"))
    expect(recentWordIds()).toEqual([])
  })

  it("filtra entradas que no son string", () => {
    localStorage.setItem(KEY, JSON.stringify([1, "ok", null, "bien"]))
    expect(recentWordIds()).toEqual(["ok", "bien"])
  })

  it("traga fallos de escritura (storage lleno/bloqueado) sin perder lo previo", () => {
    trackWordIds(["a"])
    const spy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError")
      })
    expect(() => trackWordIds(["b"])).not.toThrow()
    spy.mockRestore()
    expect(recentWordIds()).toEqual(["a"])
  })

  it("ignora un track vacío (no escribe)", () => {
    trackWordIds([])
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it("es SSR-safe: sin window no lee ni escribe", () => {
    const spySet = vi.spyOn(window.localStorage, "setItem")
    vi.stubGlobal("window", undefined)
    try {
      expect(recentWordIds()).toEqual([])
      expect(() => trackWordIds(["x"])).not.toThrow()
      expect(spySet).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
