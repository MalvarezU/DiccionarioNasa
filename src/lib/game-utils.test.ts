import { describe, it, expect } from "vitest"
import { sampleRandom, shuffle } from "./game-utils"

describe("game-utils [Fase 1]", () => {
  it("shuffle devuelve copia con los mismos elementos sin mutar el input", () => {
    const input = ["a", "b", "c", "d", "e"]
    const snapshot = [...input]
    const out = shuffle(input)
    expect(out).toHaveLength(input.length)
    expect([...out].sort()).toEqual([...snapshot].sort())
    expect(input).toEqual(snapshot)
  })

  it("shuffle maneja vacíos y singletons", () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(["x"])).toEqual(["x"])
  })

  it("sampleRandom respeta el conteo sin mutar el input", () => {
    const input = [1, 2, 3, 4, 5, 6]
    const snapshot = [...input]
    const sample = sampleRandom(input, 3)
    expect(sample).toHaveLength(3)
    for (const item of sample) expect(input).toContain(item)
    expect(new Set(sample).size).toBe(3)
    expect(input).toEqual(snapshot)
  })

  it("sampleRandom satura y valida el conteo", () => {
    const input = ["a", "b"]
    expect(sampleRandom(input, 10)).toHaveLength(2)
    expect(sampleRandom(input, 0)).toEqual([])
    expect(sampleRandom(input, -2)).toEqual([])
    expect(sampleRandom([], 4)).toEqual([])
    expect(input).toEqual(["a", "b"])
  })
})
