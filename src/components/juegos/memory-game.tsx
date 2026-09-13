"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { RefreshCw, CheckCircle2, Target, Timer, HelpCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  gameWordsOrDemo,
  reportGameResult,
  type GameWord,
} from "@/lib/game-words"

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

interface MemoryCard {
  id: string
  wordId: string
  text: string
  type: "spanish" | "nasaYuwe"
  flipped: boolean
  matched: boolean
}

export type MemoryDifficulty = 6 | 8 | 12
const DIFFICULTIES: Array<{ pairs: MemoryDifficulty; label: string }> = [
  { pairs: 6, label: "Fácil" },
  { pairs: 8, label: "Medio" },
  { pairs: 12, label: "Difícil" },
]

const STORE_KEY = "piiyaak:memory:v1"

interface StoredGame {
  cards: MemoryCard[]
  moves: number
  matched: number
  seconds: number
  numPairs: number
}

function loadStored(numPairs: number): StoredGame | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredGame>
    if (
      parsed.numPairs !== numPairs ||
      !Array.isArray(parsed.cards) ||
      parsed.cards.length !== numPairs * 2
    ) {
      return null
    }
    return parsed as StoredGame
  } catch {
    return null
  }
}

function buildDeck(pool: GameWord[], numPairs: number): MemoryCard[] {
  const cards: MemoryCard[] = []
  shuffle(pool)
    .slice(0, numPairs)
    .forEach((word) => {
      cards.push({
        id: `${word.id}-es`,
        wordId: word.id,
        text: word.spanish,
        type: "spanish",
        flipped: false,
        matched: false,
      })
      cards.push({
        id: `${word.id}-ny`,
        wordId: word.id,
        text: word.nasaYuwe,
        type: "nasaYuwe",
        flipped: false,
        matched: false,
      })
    })
  return shuffle(cards)
}

interface MemoryGameProps {
  words?: GameWord[]
  initialPairs?: MemoryDifficulty
}

export function MemoryGame({ words: providedWords, initialPairs = 6 }: MemoryGameProps = {}) {
  const [numPairs, setNumPairs] = useState<MemoryDifficulty>(initialPairs)
  const [pool, setPool] = useState<GameWord[] | null>(
    providedWords && providedWords.length >= 4 ? providedWords : null
  )
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [flippedIndices, setFlippedIndices] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [matched, setMatched] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [finished, setFinished] = useState(false)
  const [reported, setReported] = useState(false)

  const [gameKey, setGameKey] = useState(0)

  // Palabras reales (con fallback a demo)
  useEffect(() => {
    if (providedWords && providedWords.length >= 4) return
    let alive = true
    gameWordsOrDemo(12).then((words) => {
      if (alive) setPool(words)
    })
    return () => {
      alive = false
    }
  }, [providedWords])

  // Mazo inicial: restaurado de sesión o nuevo
  const initialCards = useMemo(() => {
    if (!pool || pool.length < 4) return null
    const stored = loadStored(numPairs)
    if (stored) return stored
    return {
      cards: buildDeck(pool, Math.min(numPairs, Math.floor(pool.length))),
      moves: 0,
      matched: 0,
      seconds: 0,
      numPairs,
    } as StoredGame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, numPairs, gameKey])

  // Sincronizar mazo inicial (evita redeclarar `cards`)
  useEffect(() => {
    if (!initialCards) return
    setCards(initialCards.cards)
    setMoves(initialCards.moves)
    setMatched(initialCards.matched)
    setSeconds(initialCards.seconds)
    setFlippedIndices([])
    setFinished(false)
    setReported(false)
  }, [initialCards])

  // Persistir partida (rotar/refrescar no la pierde — RNF-20)
  useEffect(() => {
    if (!cards.length || finished) return
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({ cards, moves, matched, seconds, numPairs })
      )
    } catch {
      // almacenamiento bloqueado: el juego sigue
    }
  }, [cards, moves, matched, seconds, numPairs, finished])

  const pairsDealt = cards.length > 0 ? cards.length / 2 : numPairs

  useEffect(() => {
    if (finished || matched === pairsDealt || cards.length === 0) return
    const interval = setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [finished, matched, pairsDealt, cards.length])

  const checkPair = useCallback(
    (flipped: number[], currentCards: MemoryCard[]) => {
      if (flipped.length !== 2) return
      const [i, j] = flipped
      const card1 = currentCards[i]
      const card2 = currentCards[j]
      setMoves((m) => m + 1)

      if (card1.wordId === card2.wordId && card1.type !== card2.type) {
        setCards((prev) =>
          prev.map((c, idx) =>
            idx === i || idx === j ? { ...c, matched: true } : c
          )
        )
        setMatched((m) => m + 1)
        setFlippedIndices([])
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, idx) =>
              idx === i || idx === j ? { ...c, flipped: false } : c
            )
          )
          setFlippedIndices([])
        }, 1000)
      }
    },
    []
  )

  useEffect(() => {
    if (flippedIndices.length === 2) {
      checkPair(flippedIndices, cards)
    }
  }, [flippedIndices, cards, checkPair])

  // Detectar fin del juego + reportar resultado
  useEffect(() => {
    if (pairsDealt === 0 || matched !== pairsDealt || finished) return
    setFinished(true)
  }, [matched, finished, pairsDealt])

  useEffect(() => {
    if (!finished || reported) return
    setReported(true)
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignorar
    }
    void reportGameResult({
      game: "memory",
      won: true,
      score: Math.max(0, 1000 - moves * 10 - seconds * 2),
      streak: 0,
    })
  }, [finished, reported, moves, seconds])

  function handleClick(index: number) {
    if (flippedIndices.length >= 2) return
    if (cards[index].flipped || cards[index].matched) return

    setCards((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, flipped: true } : c))
    )
    setFlippedIndices((prev) => [...prev, index])
  }

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${min}:${sec.toString().padStart(2, "0")}`
  }

  function restart() {
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignorar
    }
    setGameKey((k) => k + 1)
    setFlippedIndices([])
    setMoves(0)
    setMatched(0)
    setSeconds(0)
    setFinished(false)
    setReported(false)
  }

  function changeDifficulty(next: MemoryDifficulty) {
    if (next === numPairs) return
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignorar
    }
    setNumPairs(next)
    setGameKey((k) => k + 1)
    setFlippedIndices([])
    setMoves(0)
    setMatched(0)
    setSeconds(0)
    setFinished(false)
    setReported(false)
  }

  if (finished) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-secondary" />
          <h3 className="text-2xl font-serif text-foreground">
            ¡Felicitaciones!
          </h3>
          <p className="text-muted-foreground">
            Encontraste todas las parejas en{" "}
            <strong className="text-secondary">{moves}</strong> movimientos y{" "}
            <strong className="text-secondary">{formatTime(seconds)}</strong>
          </p>
          <Button
            onClick={restart}
            variant="outline"
            className="gap-2 mt-2"
          >
            <RefreshCw className="h-4 w-4" />
            Jugar de nuevo
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!pool || cards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" aria-busy="true" aria-label="Cargando juego">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: numPairs * 2 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">Cargando palabras...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-center gap-2" role="group" aria-label="Dificultad">
        {DIFFICULTIES.map((d) => (
          <Button
            key={d.pairs}
            variant={numPairs === d.pairs ? "default" : "outline"}
            size="sm"
            onClick={() => changeDifficulty(d.pairs)}
            aria-pressed={numPairs === d.pairs}
          >
            {d.label} ({d.pairs})
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between" role="status" aria-live="polite">
        <div className="flex gap-3">
          <Badge variant="secondary" className="gap-1.5 text-sm">
            <Target className="h-4 w-4" aria-hidden="true" />
            Movimientos: {moves}
          </Badge>
          <Badge variant="secondary" className="gap-1.5 text-sm">
            <Timer className="h-4 w-4" aria-hidden="true" />
            {formatTime(seconds)}
          </Badge>
        </div>
        <Badge variant="outline" className="gap-1.5 text-sm text-muted-foreground">
          Parejas: {matched}/{pairsDealt}
        </Badge>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3" role="group" aria-label="Tablero de memoria">
        {cards.map((card, index) => {
          const isFlipped = card.flipped || card.matched
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleClick(index)}
              disabled={isFlipped || flippedIndices.length >= 2}
              aria-label={
                isFlipped
                  ? `${card.text} (${card.type === "spanish" ? "Español" : "Nasa Yuwe"})`
                  : `Carta tapada ${index + 1}`
              }
              className={`relative aspect-[3/4] rounded-xl border-2 transition-all duration-300 ${
                isFlipped
                  ? card.matched
                    ? "border-secondary bg-secondary/10"
                    : "border-primary bg-primary/5"
                  : "border-muted-foreground/20 bg-muted/40 hover:border-primary/50 hover:bg-muted/60 cursor-pointer"
              }`}
            >
              {isFlipped ? (
                <span className="flex flex-col items-center justify-center h-full p-1 text-center">
                  <span
                    className={`font-serif font-medium ${
                      card.type === "spanish"
                        ? "text-foreground text-sm sm:text-base"
                        : "text-primary text-base sm:text-lg"
                    }`}
                  >
                    {card.text}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {card.type === "spanish" ? "Español" : "Nasa Yuwe"}
                  </span>
                </span>
              ) : (
                <span className="flex items-center justify-center h-full text-muted-foreground/40">
                  <HelpCircle className="h-7 w-7" aria-hidden="true" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}