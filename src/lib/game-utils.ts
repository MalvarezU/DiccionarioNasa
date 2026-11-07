/**
 * Shared random helpers for games (Fase 1 base).
 *
 * Both helpers NEVER mutate the input array: they work on a copy.
 * Fisher-Yates is used so every permutation is equally likely.
 */

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
