/**
 * Cliente compartido de juegos (B2.1).
 *
 * - Palabras reales desde /api/games/words (con fallback a demo si falla).
 * - Progreso anónimo en localStorage (claves versionadas) + sessionKey.
 * - reportGameResult: persiste en backend cuando hay con qué (best-effort).
 */
import { DEMO_WORDS, type DemoWord } from "@/lib/demo-content"
import { stringSimilarity } from "@/lib/game-utils"
import { buildRound } from "@/lib/game-questions"
import { recentWordIds, trackWordIds } from "@/lib/game-recent"
import type { GameId } from "@/lib/game-ids"

export type { GameId } from "@/lib/game-ids"

export interface GameWord {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  illustrationUrl: string | null
  audioUrl: string | null
}

const LS_PREFIX = "piiyaak:game:v1"

export interface GameBest {
  bestScore: number
  bestStreak: number
  played: number
}

export interface FlashcardBuilt {
  prompt: string
  title: string
  options: string[]
  correctIndex: number
}

/**
 * Arma preguntas de opción múltiple para palabras dadas (lecciones),
 * con distractores del pool. Dirección es-nasa o nasa-es. Pasa por el
 * constructor compartido (game-questions) para heredar la garantía anti
 * duplicados: jamás una opción repetida y nunca la respuesta de una
 * pregunta futura entre las opciones de otra.
 */
export function buildFlashcardQuestions(
  askWords: GameWord[],
  pool: GameWord[],
  direction: "es-nasa" | "nasa-es" = "es-nasa"
): FlashcardBuilt[] {
  const answerOf = (w: GameWord) => (direction === "es-nasa" ? w.nasaYuwe : w.spanish)
  const askIds = new Set(askWords.map((w) => w.id))
  return buildRound({
    // Las preguntas van primero: buildRound toma las asks del inicio del pool.
    pool: [...askWords, ...pool.filter((w) => !askIds.has(w.id))],
    askCount: askWords.length,
    distractorCount: 3,
    answerOf,
    similarityOf: (a, b) => stringSimilarity(a.nasaYuwe, b.nasaYuwe),
  }).map((q) => ({
    prompt:
      direction === "es-nasa" ? "¿Cómo se dice en Nasa Yuwe?" : "¿Qué significa en español?",
    title: direction === "es-nasa" ? q.word.spanish : q.word.nasaYuwe,
    options: q.options,
    correctIndex: q.correctIndex,
  }))
}

function normalizeWords(input: unknown): GameWord[] {
  if (!Array.isArray(input)) return []
  return (input as Array<Partial<GameWord>>)
    .filter((w) => w?.id && w?.spanish && w?.nasaYuwe)
    .map((w) => ({
      id: w.id!,
      spanish: w.spanish!,
      nasaYuwe: w.nasaYuwe!,
      pronunciation: w.pronunciation ?? null,
      illustrationUrl: w.illustrationUrl ?? null,
      audioUrl: w.audioUrl ?? null,
    }))
}

async function apiGameWords(
  count: number,
  withAudio: boolean,
  exclude: readonly string[]
): Promise<GameWord[]> {
  try {
    const qs = [`count=${count}`]
    if (withAudio) qs.push("withAudio=1")
    if (exclude.length > 0) {
      qs.push(`exclude=${encodeURIComponent(exclude.join(","))}`)
    }
    const res = await fetch(`/api/games/words?${qs.join("&")}`)
    if (!res.ok) return []
    const data = await res.json()
    return normalizeWords(data?.words)
  } catch {
    return []
  }
}

const MIN_POOL = 4

/**
 * Palabras reales con variedad (escalera de exclusión adaptativa):
 * - pide un pool sobremuestreado (fetchLimit) para que los juegos reciban
 *   más palabras de las que preguntan: los distractores salen del resto
 *   no preguntado;
 * - excluye primero hasta 2×count palabras recientes; si el pool filtrado
 *   queda por debajo del mínimo (pools chicos, p. ej. pocos audios
 *   publicados), baja a excluir `count` recientes y, como último recurso,
 *   a sin exclusión. Así el buffer grande (48) nunca vacía el pool de
 *   Escucha (~32 palabras con audio).
 */
async function fetchGameWordsInner(
  count: number,
  withAudio: boolean
): Promise<GameWord[]> {
  const recent = recentWordIds()
  const fetchLimit = Math.min(48, Math.max(count * 2, count + 8))
  // Escalera 2×count → count → sin exclusión, sin peldaños repetidos.
  const attempts = [...new Set([
    Math.min(recent.length, count * 2),
    Math.min(recent.length, count),
    0,
  ])].sort((a, b) => b - a)
  for (const n of attempts) {
    const fresh = await apiGameWords(fetchLimit, withAudio, recent.slice(0, n))
    if (fresh.length >= MIN_POOL) {
      trackWordIds(fresh.map((w) => w.id))
      return fresh
    }
  }
  return []
}

export async function fetchGameWords(count: number): Promise<GameWord[]> {
  return fetchGameWordsInner(count, false)
}

/** Palabras reales o demo (el juego nunca queda vacío). */

export async function gameWordsOrDemo(count: number): Promise<GameWord[]> {
  // Con el sobremuestreo, `real` puede traer más de `count`: los juegos
  // preguntan `count` y sacan los distractores del resto.
  const real = await fetchGameWords(count)
  if (real.length >= 4) return real
  return DEMO_WORDS.slice(0, Math.max(count, 4)).map((w: DemoWord) => ({
    id: w.id,
    spanish: w.spanish,
    nasaYuwe: w.nasaYuwe,
    pronunciation: w.pronunciation ?? null,
    illustrationUrl: null,
    audioUrl: null,
  }))
}

/**
 * Palabras reales CON audio (juego Escucha). Sin fallback a demo: la
 * pronunciación nativa no se sintetiza, así que si hay menos de 4
 * devuelve `[]` para que el juego caiga a su estado de error real.
 */
export async function gameWordsWithAudio(count: number): Promise<GameWord[]> {
  const words = (await fetchGameWordsInner(count, true)).filter(
    (w) => w.audioUrl
  )
  if (words.length < 4) return []
  return words
}

export function loadGameBest(game: GameId): GameBest {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}:${game}`)
    if (!raw) return { bestScore: 0, bestStreak: 0, played: 0 }
    const parsed = JSON.parse(raw) as Partial<GameBest>
    return {
      bestScore: Number(parsed.bestScore) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
      played: Number(parsed.played) || 0,
    }
  } catch {
    return { bestScore: 0, bestStreak: 0, played: 0 }
  }
}

export function saveGameBest(game: GameId, score: number, streak: number): GameBest {
  const prev = loadGameBest(game)
  const next: GameBest = {
    bestScore: Math.max(prev.bestScore, score),
    bestStreak: Math.max(prev.bestStreak, streak),
    played: prev.played + 1,
  }
  try {
    localStorage.setItem(`${LS_PREFIX}:${game}`, JSON.stringify(next))
  } catch {
    // almacenamiento lleno/bloqueado: el juego sigue funcionando
  }
  return next
}

export function getSessionKey(): string {
  try {
    let key = localStorage.getItem(`${LS_PREFIX}:session`)
    if (!key) {
      key = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random()}`) as string
      localStorage.setItem(`${LS_PREFIX}:session`, key)
    }
    return key
  } catch {
    return `s-${Date.now()}`
  }
}

export async function reportGameResult(input: {
  game: GameId
  won: boolean
  score: number
  streak: number
}): Promise<boolean> {
  // Local siempre; backend best-effort (anónimo con sessionKey).
  saveGameBest(input.game, input.score, input.streak)
  try {
    const res = await fetch("/api/games/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, sessionKey: getSessionKey() }),
    })
    if (!res.ok) return false
    const body = await res.json()
    return body?.saved === true
  } catch {
    return false
  }
}
