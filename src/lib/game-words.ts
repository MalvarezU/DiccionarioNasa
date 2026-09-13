/**
 * Cliente compartido de juegos (B2.1).
 *
 * - Palabras reales desde /api/games/words (con fallback a demo si falla).
 * - Progreso anónimo en localStorage (claves versionadas) + sessionKey.
 * - reportGameResult: persiste en backend cuando hay con qué (best-effort).
 */
import { DEMO_WORDS, type DemoWord } from "@/lib/demo-content"

export interface GameWord {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
}

export type GameId = "flashcards" | "memory" | "complete"

const LS_PREFIX = "piiyaak:game:v1"

export interface GameBest {
  bestScore: number
  bestStreak: number
  played: number
}

export async function fetchGameWords(count: number): Promise<GameWord[]> {
  try {
    const res = await fetch(`/api/games/words?count=${count}`)
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data.words)) return []
    return data.words.filter(
      (w: Partial<GameWord>) => w?.id && w?.spanish && w?.nasaYuwe
    )
  } catch {
    return []
  }
}

/** Palabras reales o demo (el juego nunca queda vacío). */
export async function gameWordsOrDemo(count: number): Promise<GameWord[]> {
  const real = await fetchGameWords(count)
  if (real.length >= 4) return real
  return DEMO_WORDS.slice(0, Math.max(count, 4)).map((w: DemoWord) => ({
    id: w.id,
    spanish: w.spanish,
    nasaYuwe: w.nasaYuwe,
    pronunciation: w.pronunciation ?? null,
  }))
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
