"use client"

import { useEffect, useState } from "react"
import { loadGameBest, type GameBest, type GameId } from "@/lib/game-words"

/**
 * Best score/streak line for a hub tile. LocalStorage only, read once on
 * mount (client-only via useEffect, no SSR break). Renders a fixed-height
 * placeholder before hydration data arrives to avoid layout shift.
 */
export function GameBestBadge({ game }: { game: GameId }) {
  const [best, setBest] = useState<GameBest | null>(null)

  useEffect(() => {
    setBest(loadGameBest(game))
  }, [game])

  const label =
    !best || best.played === 0
      ? "Aún sin jugar"
      : `Mejor: ${best.bestScore} pts · Racha: ${best.bestStreak}`

  return (
    <p className="mt-3 text-xs text-muted-foreground tabular-nums min-h-4">
      {best ? label : " "}
    </p>
  )
}
