/**
 * Cliente compartido de juegos (B2.1).
 *
 * - Palabras reales desde /api/games/words (con fallback a demo si falla).
 * - Progreso anónimo en localStorage (claves versionadas) + sessionKey.
 * - reportGameResult: persiste en backend cuando hay con qué (best-effort).
 */
import { DEMO_WORDS, type DemoWord } from "@/lib/demo-content"
import { shuffle } from "@/lib/game-utils"
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
 * con distractores del pool. Dirección es-nasa o nasa-es.
 */
export function buildFlashcardQuestions(
  askWords: GameWord[],
  pool: GameWord[],
  direction: "es-nasa" | "nasa-es" = "es-nasa"
): FlashcardBuilt[] {
  const answer = (w: GameWord) => (direction === "es-nasa" ? w.nasaYuwe : w.spanish)
  return askWords.map((word) => {
    const distractors = shuffle(pool.filter((w) => w.id !== word.id))
      .slice(0, 3)
      .map(answer)
    const options = shuffle([answer(word), ...distractors])
    return {
      prompt:
        direction === "es-nasa" ? "¿Cómo se dice en Nasa Yuwe?" : "¿Qué significa en español?",
      title: direction === "es-nasa" ? word.spanish : word.nasaYuwe,
      options,
      correctIndex: options.indexOf(answer(word)),
    }
  })
}

/**
 * Ring buffer de palabras servidas recientemente (variedad real entre
 * sesiones): los helpers pasan `exclude=` a la API y guardan lo servido.
 * Es compartido entre juegos: una palabra vista en cualquier juego se
 * aparta un rato en todos, así el repertorio rota en vez de repetir el
 * mismo grupo (el diccionario tiene cientos de palabras).
 */
const RECENT_KEY = `${LS_PREFIX}:recent`
const RECENT_MAX = 24

function recentWordIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : []
  } catch {
    return []
  }
}

function trackWordIds(ids: readonly string[]): void {
  if (ids.length === 0) return
  try {
    const prev = recentWordIds()
    const seen = new Set(ids)
    const next = [...ids, ...prev.filter((id) => !seen.has(id))].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // almacenamiento lleno/bloqueado: solo pierde variedad, no funcionalidad
  }
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

/**
 * Palabras reales con variedad: excluye las servidas recientemente y, si
 * el pool filtrado queda por debajo del mínimo del juego (pools chicos,
 * p. ej. pocos audios publicados), reintenta sin exclusión.
 */
async function fetchGameWordsInner(
  count: number,
  withAudio: boolean
): Promise<GameWord[]> {
  const recent = recentWordIds().slice(0, count)
  if (recent.length > 0) {
    const fresh = await apiGameWords(count, withAudio, recent)
    if (fresh.length >= 4) {
      trackWordIds(fresh.map((w) => w.id))
      return fresh
    }
  }
  const plain = await apiGameWords(count, withAudio, [])
  if (plain.length >= 4) trackWordIds(plain.map((w) => w.id))
  return plain
}

export async function fetchGameWords(count: number): Promise<GameWord[]> {
  return fetchGameWordsInner(count, false)
}

/** Palabras reales o demo (el juego nunca queda vacío). */

export async function gameWordsOrDemo(count: number): Promise<GameWord[]> {  const real = await fetchGameWords(count)
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
