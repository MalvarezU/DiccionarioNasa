import { describe, it, expect } from "vitest"
import { buildRound, dedupePool } from "./game-questions"
import { shuffle } from "./game-utils"

interface TestWord {
  id: string
  spanish: string
  nasaYuwe: string
}

function makeWords(n: number, prefix = "w"): TestWord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    spanish: `Palabra${i}`,
    nasaYuwe: `Nasa${i}`,
  }))
}

const answerOf = (w: { spanish: string }) => w.spanish

describe("dedupePool", () => {
  it("conserva la primera aparición por clave spanish||nasaYuwe", () => {
    const a = { spanish: "Casa", nasaYuwe: "Yat" }
    const b = { spanish: "Agua", nasaYuwe: "Yu" }
    const twin = { spanish: "Casa", nasaYuwe: "Yat" }
    expect(dedupePool([a, b, twin])).toEqual([a, b])
  })

  it("no muta la entrada y respeta el pool vacío", () => {
    expect(dedupePool([])).toEqual([])
    const input = [{ spanish: "A", nasaYuwe: "a" }]
    const out = dedupePool(input)
    expect(out).not.toBe(input)
    expect(input).toHaveLength(1)
  })
})

describe("buildRound", () => {
  it("respeta el orden de las preguntas y siempre incluye la respuesta correcta", () => {
    const pool = makeWords(16)
    const shuffled = shuffle(pool)
    const qs = buildRound({
      pool: shuffled,
      askCount: 4,
      distractorCount: 3,
      answerOf,
    })
    expect(qs).toHaveLength(4)
    // asks = dedupePool(pool).slice(0, 4): mismas palabras, mismo orden
    expect(qs.map((q) => q.word)).toEqual(shuffled.slice(0, 4))
    for (const q of qs) {
      expect(q.options).toHaveLength(4)
      expect(q.options[q.correctIndex]).toBe(answerOf(q.word))
    }
  })

  it("nunca repite un string de opción dentro de una pregunta", () => {
    const qs = buildRound({
      pool: shuffle(makeWords(12)),
      askCount: 6,
      distractorCount: 3,
      answerOf,
    })
    for (const q of qs) {
      expect(new Set(q.options).size).toBe(q.options.length)
    }
  })

  it("la respuesta de una pregunta futura jamás aparece en opciones previas (pool ≥ 4×ask, 100 semillas)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const pool = makeWords(32, `s${seed}`)
      const qs = buildRound({
        pool: shuffle(pool),
        askCount: 8,
        distractorCount: 3,
        answerOf,
      })
      expect(qs).toHaveLength(8)
      for (let i = 0; i < qs.length; i++) {
        for (let j = i + 1; j < qs.length; j++) {
          expect(qs[i]!.options).not.toContain(answerOf(qs[j]!.word))
        }
      }
    }
  })

  it("pool mínimo de 4 palabras: cada pregunta sale con ≥2 opciones, sin repetidos y con la correcta", () => {
    const qs = buildRound({
      pool: shuffle(makeWords(4)),
      askCount: 4,
      distractorCount: 3,
      answerOf,
    })
    expect(qs).toHaveLength(4)
    for (const q of qs) {
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.options[q.correctIndex]).toBe(answerOf(q.word))
    }
  })

  it("usa la similaridad: el candidato más parecido entra siempre como distractor", () => {
    const pool = [
      { id: "w0", spanish: "Kat", nasaYuwe: "kat" },
      { id: "w1", spanish: "Twin", nasaYuwe: "katt" },
      { id: "w2", spanish: "Zzz", nasaYuwe: "zzzz" },
      { id: "w3", spanish: "Qqq", nasaYuwe: "qqqq" },
      { id: "w4", spanish: "Www", nasaYuwe: "wwww" },
      { id: "w5", spanish: "Mmm", nasaYuwe: "mmmm" },
      { id: "w6", spanish: "Nnn", nasaYuwe: "nnnn" },
    ]
    const qs = buildRound({
      pool: shuffle(pool),
      askCount: 1,
      distractorCount: 3,
      answerOf: (w) => w.nasaYuwe,
      // "katt" (sim 2) siempre por encima del resto (sim 0)
      similarityOf: (a, b) => (b.nasaYuwe === "katt" ? 2 : 0),
    })
    expect(qs).toHaveLength(1)
    expect(qs[0]!.options).toContain("katt")
  })

  it("pools degenerados no lanzan: 1 palabra → 1 pregunta con su única opción", () => {
    const qs = buildRound({
      pool: [{ id: "solo", spanish: "Solo", nasaYuwe: "solo" }],
      askCount: 4,
      distractorCount: 3,
      answerOf,
    })
    expect(qs).toHaveLength(1)
    expect(qs[0]!.options).toEqual(["Solo"])
    expect(qs[0]!.correctIndex).toBe(0)
  })

  it("askCount 0 o pool vacío → sin preguntas", () => {
    expect(buildRound({ pool: [], askCount: 4, distractorCount: 3, answerOf })).toEqual([])
    expect(
      buildRound({ pool: makeWords(4), askCount: 0, distractorCount: 3, answerOf })
    ).toEqual([])
  })

  it("respuestas repetidas entre preguntas no rompen: opciones únicas y correcta presente", () => {
    // Dos palabras distintas por clave pero con la MISMA respuesta (spanish)
    const pool = [
      { id: "h1", spanish: "Mismo", nasaYuwe: "igual1" },
      { id: "h2", spanish: "Mismo", nasaYuwe: "igual2" },
      { id: "h3", spanish: "Otro", nasaYuwe: "otro" },
    ]
    const qs = buildRound({ pool, askCount: 3, distractorCount: 3, answerOf })
    expect(qs).toHaveLength(3)
    for (const q of qs) {
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.options[q.correctIndex]).toBe(answerOf(q.word))
    }
  })
})
