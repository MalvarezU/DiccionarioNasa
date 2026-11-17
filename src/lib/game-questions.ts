/**
 * Constructor compartido de preguntas de opción múltiple para los juegos.
 *
 * Centraliza la lógica que antes vivía duplicada (o solo en escucha):
 * - dedupePool: quita duplicados exactos (homónimos con el mismo par
 *   español/Nasa Yuwe) por clave `spanish||nasaYuwe`, conservando la
 *   primera aparición.
 * - buildRound: arma las preguntas con cero fuga de respuestas: los
 *   distractores salen primero de palabras NO preguntadas, luego de las
 *   ya preguntadas (refuerzo) y, solo si nada de eso alcanza (pools muy
 *   chicos), de las preguntas futuras.
 */
import { shuffle } from "@/lib/game-utils"

/** Clave de deduplicación de una palabra del pool. */
function poolKey<T extends { spanish: string; nasaYuwe: string }>(w: T): string {
  return `${w.spanish}||${w.nasaYuwe}`
}

/**
 * Quita duplicados por clave `spanish||nasaYuwe`, conservando la primera
 * aparición. No muta la entrada.
 */
export function dedupePool<T extends { spanish: string; nasaYuwe: string }>(
  pool: readonly T[]
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const w of pool) {
    const key = poolKey(w)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(w)
  }
  return out
}

export interface BuildRoundOptions<T> {
  /** Pool YA mezclado por el llamador: los empates de similaridad quedan aleatorios. */
  pool: readonly T[]
  askCount: number
  /** Distractores deseados por pregunta (se recortan si el pool no alcanza). */
  distractorCount: number
  answerOf: (w: T) => string
  /** Dado, los candidatos se ordenan de más parecido a menos (sort estable). */
  similarityOf?: (a: T, b: T) => number
}

export interface BuiltQuestion<T> {
  word: T
  options: string[]
  correctIndex: number
}

/**
 * Arma una tanda de preguntas de opción múltiple desde un solo pool.
 *
 * Reglas:
 * 1. Las preguntas son `dedupePool(pool).slice(0, askCount)` (orden del pool).
 * 2. Distractores por pregunta, en cascada:
 *    (a) palabras fuera de las preguntadas — cero fuga de respuestas;
 *    (b) ya preguntadas — refuerzo;
 *    (c) preguntas futuras — último recurso para pools mínimos.
 *    En (a) y (b) se excluye siempre la respuesta correcta y las de las
 *    preguntas futuras; en (c) solo la correcta y las ya usadas.
 * 3. Con `similarityOf` cada tier se ordena de más parecido a menos.
 * 4. Nunca se repite un string de opción dentro de la pregunta; si el pool
 *    no da `1 + distractorCount` opciones únicas se devuelven las que
 *    haya (≥2 en todo pool con ≥2 respuestas distintas; en pools
 *    degenerados de una sola respuesta, 1). Nunca lanza ni devuelve una
 *    pregunta sin la opción correcta.
 */
export function buildRound<T extends { spanish: string; nasaYuwe: string }>(
  opts: BuildRoundOptions<T>
): BuiltQuestion<T>[] {
  const { pool, askCount, distractorCount, answerOf, similarityOf } = opts
  const askN = Math.max(0, Math.floor(askCount))
  if (askN === 0) return []
  const asks = dedupePool(pool).slice(0, askN)
  const answers = asks.map(answerOf)
  const wantDistractors = Math.max(0, Math.floor(distractorCount))

  // Tier (a): pool menos las preguntadas (por clave, cubre también a sus
  // homónimos), ya deduplicado.
  const askKeys = new Set(asks.map(poolKey))
  const rest = dedupePool(pool.filter((w) => !askKeys.has(poolKey(w))))

  return asks.map((word, i) => {
    const correct = answers[i]!
    // Respuestas prohibidas en (a)/(b): la correcta y las de las rondas futuras.
    const forbidden = new Set(answers.slice(i + 1))
    forbidden.add(correct)
    const used = new Set<string>([correct])
    const distractors: T[] = []

    const take = (candidates: readonly T[], checkForbidden: boolean): void => {
      if (distractors.length >= wantDistractors) return
      const ordered = similarityOf
        ? // Sort estable (ES2019): el pool llega mezclado, así que los
          // empates conservan ese orden aleatorio.
          [...candidates].sort(
            (a, b) => similarityOf(word, b) - similarityOf(word, a)
          )
        : candidates
      for (const candidate of ordered) {
        if (distractors.length >= wantDistractors) return
        const answer = answerOf(candidate)
        if (used.has(answer)) continue
        if (checkForbidden && forbidden.has(answer)) continue
        used.add(answer)
        distractors.push(candidate)
      }
    }

    // (a) no preguntadas; (b) ya preguntadas (refuerzo);
    // (c) futuras, solo si (a)+(b) no llenan (pools muy chicos).
    take(rest, true)
    take(asks.slice(0, i), true)
    take(asks.slice(i + 1), false)

    const options = shuffle([correct, ...distractors.map(answerOf)])
    return { word, options, correctIndex: options.indexOf(correct) }
  })
}
