/**
 * Tokenizador de Nasa Yuwe para el juego "Ordena la palabra".
 *
 * Reglas (diseño v1):
 * - Normaliza `’` (U+2019) y `´` (U+00B4) a `'` antes de tokenizar.
 * - Compara en minúscula pero preserva el original para mostrar.
 * - Vocal + `'` es una sola ficha: a', e', i', u', ã', ũ'.
 * - Clusters indivisibles (minúscula o mayúscula inicial): txh, th, ph,
 *   kh, sx, nx, lx, px, çx, fx, jx, vx, tx, çh.
 * - Resto letra por letra; preserva ç/Ç ũ/Ũ ã/Ã.
 */

/** Vocales que forman una sola ficha con el apóstrofo que les sigue. */
const GLOTTAL_VOWELS = new Set(["a", "e", "i", "u", "ã", "ũ"])

/**
 * Clusters indivisibles, ordenados de largo a corto para matcheo greedy.
 * El matcheo es case-insensitive (cubre minúscula y mayúscula inicial).
 */
const CLUSTERS: readonly string[] = [
  "txh",
  "th",
  "ph",
  "kh",
  "sx",
  "nx",
  "lx",
  "px",
  "çx",
  "fx",
  "jx",
  "vx",
  "tx",
  "çh",
]

const CLUSTER_SET = new Set(CLUSTERS)
const CLUSTER_3 = new Set(CLUSTERS.filter((c) => c.length === 3))

/** `’` (U+2019) y `´` (U+00B4) → apóstrofo ASCII. */
export function normalizeOrdenaApos(word: string): string {
  return word.replace(/[\u2019\u00B4]/g, "'")
}

/**
 * Divide una palabra en fichas jugables.
 * La comparación es en minúscula; cada ficha conserva su forma original.
 */
export function tokenizeOrdena(word: string): string[] {
  const src = normalizeOrdenaApos(word)
  const lower = src.toLowerCase()
  const tokens: string[] = []
  let i = 0
  while (i < src.length) {
    const ch = lower[i]!
    // Vocal + apóstrofo: una sola ficha (a', E', ũ', ...)
    if (GLOTTAL_VOWELS.has(ch) && lower[i + 1] === "'") {
      tokens.push(src.slice(i, i + 2))
      i += 2
      continue
    }
    // Clusters: intenta largo 3 (txh) y luego largo 2 (th, çx, ...)
    const tri = lower.slice(i, i + 3)
    if (tri.length === 3 && CLUSTER_3.has(tri)) {
      tokens.push(src.slice(i, i + 3))
      i += 3
      continue
    }
    const duo = lower.slice(i, i + 2)
    if (duo.length === 2 && CLUSTER_SET.has(duo)) {
      tokens.push(src.slice(i, i + 2))
      i += 2
      continue
    }
    tokens.push(src[i]!)
    i += 1
  }
  return tokens
}

export interface OrdenaCandidate {
  spanish: string
  nasaYuwe: string
}

/**
 * Una palabra es jugable si da una partida real:
 * - ≥3 fichas (con ≤2 no hay nada que ordenar),
 * - sin espacios (una sola palabra),
 * - sin marcador "(Esp" (entradas con glosa),
 * - español no vacío y distinto del Nasa Yuwe (case-insensitive).
 */
export function isOrdenaEligible(word: OrdenaCandidate): boolean {
  const ny = word.nasaYuwe ?? ""
  const es = (word.spanish ?? "").trim()
  if (!es) return false
  if (/\s/.test(ny)) return false
  if (ny.includes("(Esp")) return false
  if (es.toLowerCase() === ny.toLowerCase()) return false
  return tokenizeOrdena(ny).length > 2
}
