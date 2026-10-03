/**
 * Migración de lecciones legacy -> documento de bloques.
 *
 * Vive en la librería (y no dentro del script) para poder testear el mapeo sin
 * base de datos. El script `prisma/backfill-lesson-blocks.ts` es solo el
 * recorrido de la tabla; la lógica está acá.
 */

import type { LessonBlock } from "./blocks"

export type LegacyLesson = {
  id: string
  type: string
  wordId: string | null
  payload: string | null
}

/** El payload de QUIZ guardaba `{ questions: [{ wordSpanish }] }`. */
export function quizWordsFromPayload(payload: string | null): string[] {
  if (!payload) return []
  try {
    const parsed = JSON.parse(payload) as {
      questions?: Array<{ wordSpanish?: unknown }>
    }
    if (!Array.isArray(parsed.questions)) return []
    return parsed.questions
      .map((q) => (typeof q?.wordSpanish === "string" ? q.wordSpanish.trim() : ""))
      .filter((w) => w.length > 0)
  } catch {
    // Payload corrupto: se trata como vacío en vez de romper el backfill.
    return []
  }
}

/**
 * Convierte una lección legacy en sus bloques, preservando el comportamiento
 * exacto de cada tipo. Sin datos suficientes devuelve `[]`: es preferible una
 * lección vacía que una inventada.
 */
export function blocksForLegacyLesson(
  lesson: LegacyLesson,
  blockId: (lessonId: string, index: number) => string
): LessonBlock[] {
  switch (lesson.type) {
    case "READ":
      return lesson.wordId
        ? [{ id: blockId(lesson.id, 0), type: "word", wordId: lesson.wordId }]
        : []
    case "QUIZ": {
      const words = quizWordsFromPayload(lesson.payload)
      return words.length > 0
        ? [{ id: blockId(lesson.id, 0), type: "legacy-quiz-words", words }]
        : []
    }
    case "COMPLETE":
      return lesson.wordId
        ? [{ id: blockId(lesson.id, 0), type: "legacy-complete-word", wordId: lesson.wordId }]
        : []
    default:
      return []
  }
}

/** Id determinístico: re-correr el backfill no genera ids nuevos. */
export function deterministicBlockId(lessonId: string, index: number): string {
  return `blk_${lessonId.slice(-10)}_${index}`
}
