/**
 * Datos de palabra compartidos entre el render del estudiante, la vista
 * previa del editor y los bloques que referencian varias palabras
 * (vocabulary, quiz, game).
 *
 * La forma es la misma que ya devuelve el detalle de curso
 * (/api/courses/[id] con `word.select`) y el listado del diccionario, para
 * no duplicar contratos.
 */

export type CourseWordData = {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string | null
}

/** Lote de ids que se piden al backend. */
export const MAX_WORDS_PER_REQUEST = 60

/**
 * Trae varias palabras por id. Los bloques de vocabulario/quiz/juego
 * referencian palabras por id y necesitan sus datos para renderizarse.
 *
 * Devuelve un Map: los ids que no existan o no estén publicados simplemente
 * no aparecen (un bloque puede quedar con una palabra menos, no se rompe).
 */
export async function fetchWordsByIds(
  ids: readonly string[]
): Promise<Map<string, CourseWordData>> {
  const únicos = [...new Set(ids)].slice(0, MAX_WORDS_PER_REQUEST)
  if (únicos.length === 0) return new Map()

  const res = await fetch(`/api/dictionary/words?ids=${únicos.join(",")}`)
  if (!res.ok) {
    // Sin datos, los bloques muestran su estado vacío en vez de explotar.
    return new Map()
  }
  const body = (await res.json()) as { words?: CourseWordData[] }
  const words = Array.isArray(body.words) ? body.words : []
  return new Map(words.map((w) => [w.id, w]))
}

import type { LessonBlock } from "./blocks"

/** Los ids de palabra usados por el documento de una lección. */
export function wordIdsUsedByContent(blocks: readonly LessonBlock[]): string[] {
  const ids: string[] = []
  for (const block of blocks) {
    if (block.type === "word" || block.type === "legacy-complete-word") {
      ids.push(block.wordId)
    } else if (block.type === "vocabulary" || block.type === "game") {
      ids.push(...block.wordIds)
    }
  }
  return [...new Set(ids)]
}
