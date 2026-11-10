"use client"

import { useCallback } from "react"
import { playCorrect, playWrong, playWin } from "@/lib/game-sound"

/**
 * Centralized game feedback (Fase 1.5 juice kit).
 * Sound helpers are stable callbacks; `streakClass` maps a streak count
 * to a badge tone so every game styles streaks the same way.
 */
export function streakClass(streak: number): string {
  if (streak >= 5) return "bg-secondary text-secondary-foreground border-secondary"
  if (streak >= 2)
    return "bg-secondary-container text-montana border border-secondary/30"
  return "bg-muted text-muted-foreground border border-transparent"
}

export interface GameFeedback {
  playCorrect: () => void
  playWrong: () => void
  playWin: () => void
}

export function useGameFeedback(): GameFeedback & {
  streakClass: typeof streakClass
} {
  const onCorrect = useCallback(() => playCorrect(), [])
  const onWrong = useCallback(() => playWrong(), [])
  const onWin = useCallback(() => playWin(), [])

  return {
    playCorrect: onCorrect,
    playWrong: onWrong,
    playWin: onWin,
    streakClass,
  }
}
