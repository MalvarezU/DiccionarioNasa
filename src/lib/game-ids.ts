/**
 * Single source of truth para los ids de juego (cliente + API).
 *
 * Prisma guarda `game` como String plano: agregar un juego NO requiere
 * migración, solo extender esta lista. Tanto `game-words.ts` como la
 * route `/api/games/result` importan de aquí.
 */
export const GAME_IDS = ["flashcards", "memory", "complete", "ordena", "relacionar", "escucha"] as const

export type GameId = (typeof GAME_IDS)[number]

export function isGameId(value: unknown): value is GameId {
  return (
    typeof value === "string" && (GAME_IDS as readonly string[]).includes(value)
  )
}
