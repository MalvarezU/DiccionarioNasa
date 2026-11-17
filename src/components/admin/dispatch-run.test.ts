import { describe, it, expect } from "vitest"

import { maxRunId, pickDispatchedRun } from "./dispatch-run"

interface FakeRun {
  id: number
  createdAt: string
}

function run(id: number, createdAt = "2026-11-17T11:19:35Z"): FakeRun {
  return { id, createdAt }
}

describe("pickDispatchedRun", () => {
  it("devuelve el más nuevo entre los que superan la base", () => {
    const runs = [run(100), run(101), run(102)]
    expect(pickDispatchedRun(runs, 100)?.id).toBe(102)
  })

  it("ignora el orden de la lista", () => {
    const runs = [run(105), run(101), run(110), run(103)]
    expect(pickDispatchedRun(runs, 100)?.id).toBe(110)
  })

  it("lista vacía → undefined", () => {
    expect(pickDispatchedRun([], 0)).toBeUndefined()
  })

  it("sin runs sobre la base → undefined (el polling sigue esperando)", () => {
    const runs = [run(98), run(99), run(100)]
    expect(pickDispatchedRun(runs, 100)).toBeUndefined()
  })

  it("el id manda aunque createdAt sea anterior (caso real: precisión de segundos + skew)", () => {
    // El run nuevo existe en GitHub con createdAt "2026-11-17T11:19:35Z",
    // ANTERIOR al reloj del navegador que despachó después. Por fecha el
    // filtro viejo lo descartaba para siempre; por id se encuentra.
    const runs = [
      run(100, "2026-11-17T11:19:30Z"),
      run(101, "2026-11-17T11:19:35Z"),
    ]
    expect(pickDispatchedRun(runs, 100)?.id).toBe(101)
  })

  it("empate de ids sobre la base: devuelve uno de ellos", () => {
    const runs = [run(101, "2026-11-17T11:19:35Z"), run(101, "2026-11-17T11:19:36Z")]
    expect(pickDispatchedRun(runs, 100)?.id).toBe(101)
  })
})

describe("maxRunId", () => {
  it("lista vacía → 0", () => {
    expect(maxRunId([])).toBe(0)
  })

  it("devuelve el id máximo sin importar el orden", () => {
    expect(maxRunId([run(3), run(9), run(5)])).toBe(9)
  })
})
