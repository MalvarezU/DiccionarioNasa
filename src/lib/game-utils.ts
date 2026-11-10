/**
 * Shared random helpers for games (Fase 1 base).
 *
 * Both helpers NEVER mutate the input array: they work on a copy.
 * Fisher-Yates is used so every permutation is equally likely.
 */

/**
 * Distancia de Levenshtein entre dos cadenas (ignora mayúsculas y
 * diacríticos). Sirve para medir qué tan parecidas se escriben dos
 * palabras (o cómo suenan, si se le pasa la pronunciación).
 */
export function levenshtein(a: string, b: string): number {
  const s1 = a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  const s2 = b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  if (s1 === s2) return 0
  if (s1.length === 0) return s2.length
  if (s2.length === 0) return s1.length
  let prev = Array.from({ length: s2.length + 1 }, (_, i) => i)
  for (let i = 1; i <= s1.length; i++) {
    let cur: number[] = [i]
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
    }
    prev = cur
  }
  return prev[s2.length]!
}

/**
 * Similaridad entre 0 y 1 (1 = idénticas). Útil para elegir distractores
 * parecidos y forzar discriminación fina (pares mínimos).
 */
export function stringSimilarity(a: string, b: string): number {
  const s1 = a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  const s2 = b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  if (s1 === s2) return 1
  const max = Math.max(s1.length, s2.length)
  if (max === 0) return 1
  return 1 - levenshtein(s1, s2) / max
}
/** Return a shuffled copy of `items` (input untouched). */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Return up to `count` random items from `items` (input untouched).
 * `count <= 0` yields `[]`; `count > length` yields the whole array shuffled.
 */
export function sampleRandom<T>(items: readonly T[], count: number): T[] {
  if (!Number.isFinite(count) || count <= 0) return []
  return shuffle(items).slice(0, Math.min(Math.floor(count), items.length))
}
