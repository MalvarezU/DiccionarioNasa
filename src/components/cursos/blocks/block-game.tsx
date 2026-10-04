"use client"

import { useMemo } from "react"
import { MemoryGame } from "@/components/juegos/memory-game"
import { FlashcardGame } from "@/components/juegos/flashcard-game"
import { buildFlashcardQuestions, type GameWord } from "@/lib/game-words"
import type { CourseWordData } from "@/lib/courses/word-data"

/**
 * Juego embebido como actividad de lección: reutiliza los juegos que ya
 * existen, pero con un set de palabras ACOTADO al contenido de la lección
 * (los juegos del hub cargan palabras globales).
 *
 * La lección se aprueba al terminar la partida (memoria) o al acertar la
 * mitad o más (flashcards).
 */

const PARES_POR_DIFICULTAD = {
  easy: 6,
  medium: 8,
  hard: 12,
} as const

export function JuegoEmbebido({
  block,
  words,
  onAprobado,
}: {
  block: { id: string; game: "memory" | "flashcards"; wordIds: string[]; difficulty: "easy" | "medium" | "hard" }
  words: Map<string, CourseWordData>
  onAprobado: (score: number) => void
}) {
  const gameWords = useMemo<GameWord[]>(() => {
    return block.wordIds
      .map((id) => words.get(id))
      .filter((w): w is CourseWordData => Boolean(w))
      .map((w) => ({
        id: w.id,
        spanish: w.spanish,
        nasaYuwe: w.nasaYuwe,
        pronunciation: w.pronunciation,
      }))
  }, [block.wordIds, words])

  if (gameWords.length < 4) {
    return (
      <p className="rounded-lg border border-dashed border-outline-variant/40 px-4 py-3 text-sm text-muted-foreground">
        El juego necesita al menos 4 palabras disponibles del diccionario
        (tiene {gameWords.length}).
      </p>
    )
  }

  if (block.game === "memory") {
    return (
      <div data-testid="juego-embebido">
        <MemoryGame
          words={gameWords}
          initialPairs={PARES_POR_DIFICULTAD[block.difficulty]}
        />
      </div>
    )
  }

  return (
    <div data-testid="juego-embebido">
      <FlashcardGame
        questions={buildFlashcardQuestions(gameWords, gameWords, "es-nasa")}
        direction="es-nasa"
        onFinish={({ correct, total }) => {
          if (total > 0 && correct / total >= 0.5) {
            onAprobado(Math.round((correct / total) * 100))
          }
        }}
      />
    </div>
  )
}
