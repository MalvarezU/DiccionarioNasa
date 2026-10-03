import { describe, it, expect } from "vitest"
import {
  blocksForLegacyLesson,
  quizWordsFromPayload,
  deterministicBlockId,
} from "./legacy-migration"

const lesson = (over: Partial<Parameters<typeof blocksForLegacyLesson>[0]>) => ({
  id: "clesson1234567890",
  type: "READ",
  wordId: null as string | null,
  payload: null as string | null,
  ...over,
})

const id = deterministicBlockId

describe("quizWordsFromPayload", () => {
  it("extrae las palabras del payload de QUIZ", () => {
    const payload = JSON.stringify({
      questions: [{ wordSpanish: "agua" }, { wordSpanish: "sol" }],
    })
    expect(quizWordsFromPayload(payload)).toEqual(["agua", "sol"])
  })

  it("ignora entradas sin wordSpanish y recorta espacios", () => {
    const payload = JSON.stringify({
      questions: [{ wordSpanish: "  agua  " }, { otro: 1 }, { wordSpanish: "" }],
    })
    expect(quizWordsFromPayload(payload)).toEqual(["agua"])
  })

  it("devuelve [] con payload nulo, corrupto o con forma inesperada", () => {
    expect(quizWordsFromPayload(null)).toEqual([])
    expect(quizWordsFromPayload("{no es json")).toEqual([])
    expect(quizWordsFromPayload(JSON.stringify({ questions: "x" }))).toEqual([])
    expect(quizWordsFromPayload(JSON.stringify({}))).toEqual([])
  })
})

describe("blocksForLegacyLesson — preserva el comportamiento", () => {
  it("READ con palabra -> bloque word", () => {
    const blocks = blocksForLegacyLesson(lesson({ type: "READ", wordId: "w1" }), id)
    expect(blocks).toEqual([{ id: id("clesson1234567890", 0), type: "word", wordId: "w1" }])
  })

  it("QUIZ con palabras -> bloque legacy-quiz-words", () => {
    const payload = JSON.stringify({ questions: [{ wordSpanish: "agua" }] })
    const blocks = blocksForLegacyLesson(lesson({ type: "QUIZ", payload }), id)
    expect(blocks).toEqual([
      { id: id("clesson1234567890", 0), type: "legacy-quiz-words", words: ["agua"] },
    ])
  })

  it("COMPLETE con palabra -> bloque legacy-complete-word", () => {
    const blocks = blocksForLegacyLesson(lesson({ type: "COMPLETE", wordId: "w2" }), id)
    expect(blocks).toEqual([
      { id: id("clesson1234567890", 0), type: "legacy-complete-word", wordId: "w2" },
    ])
  })

  it("sin datos suficientes devuelve [] (no inventa contenido)", () => {
    expect(blocksForLegacyLesson(lesson({ type: "READ", wordId: null }), id)).toEqual([])
    expect(blocksForLegacyLesson(lesson({ type: "QUIZ", payload: null }), id)).toEqual([])
    expect(blocksForLegacyLesson(lesson({ type: "COMPLETE", wordId: null }), id)).toEqual([])
    expect(blocksForLegacyLesson(lesson({ type: "DESCONOCIDO" }), id)).toEqual([])
  })
})

describe("deterministicBlockId — el backfill es idempotente", () => {
  it("mismo id para la misma lección e índice", () => {
    expect(id("abc", 0)).toBe(id("abc", 0))
  })

  it("distinto id para distinto índice", () => {
    expect(id("abc", 0)).not.toBe(id("abc", 1))
  })

  it("produce ids que el validador acepta", () => {
    // Si el id no validara, el backfill guardaría documentos que la API
    // después rechazaría.
    const generado = id("cmurhmw8c0001ck0i36i500ut", 0)
    expect(/^[A-Za-z0-9_-]+$/.test(generado)).toBe(true)
    expect(generado.length).toBeLessThanOrEqual(64)
  })
})
