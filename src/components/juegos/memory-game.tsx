"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { RefreshCw, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DEMO_WORDS } from "@/lib/demo-content"

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

const NUM_PAIRS = 6

export function MemoryGame() {
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [flippedIndices, setFlippedIndices] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [matched, setMatched] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [finished, setFinished] = useState(false)

  const [gameKey, setGameKey] = useState(0)

  const cards = useMemo(() => {
    const pairs = shuffle(DEMO_WORDS).slice(0, NUM_PAIRS)
    const newCards: MemoryCard[] = []
    pairs.forEach((word) => {
      newCards.push({
        id: `${word.id}-es`,
        wordId: word.id,
        text: word.spanish,
        type: "spanish",
        flipped: false,
        matched: false,
      })
      newCards.push({
        id: `${word.id}-ny`,
        wordId: word.id,
        text: word.nasaYuwe,
        type: "nasaYuwe",
        flipped: false,
        matched: false,
      })
    })
    return shuffle(newCards)
  }, [gameKey])

  useEffect(() => {
    if (finished || matched === NUM_PAIRS) return
    const interval = setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [finished, matched])

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
        const timeout = setTimeout(() => {
          setCards((prev) =>
            prev.map((c, idx) =>
              idx === i || idx === j ? { ...c, flipped: false } : c
            )
          )
          setFlippedIndices([])
        }, 1000)
        return () => clearTimeout(timeout)
      }
    },
    []
  )

  useEffect(() => {
    if (flippedIndices.length === 2) {
      return checkPair(flippedIndices, cards) as unknown as () => void
    }
  }, [flippedIndices, cards, checkPair])

  // Detectar fin del juego
  useEffect(() => {
    if (matched === NUM_PAIRS && !finished) {
      setFinished(true)
    }
  }, [matched, finished])

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
            onClick={() => {
              setGameKey((k) => k + 1)
              setFlippedIndices([])
              setMoves(0)
              setMatched(0)
              setSeconds(0)
              setFinished(false)
            }}
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Badge variant="secondary" className="gap-1.5 text-sm">
            🎯 Movimientos: {moves}
          </Badge>
          <Badge variant="secondary" className="gap-1.5 text-sm">
            ⏱️ {formatTime(seconds)}
          </Badge>
        </div>
        <Badge variant="outline" className="gap-1.5 text-sm text-muted-foreground">
          Parejas: {matched}/{NUM_PAIRS}
        </Badge>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {cards.map((card, index) => {
          const isFlipped = card.flipped || card.matched
          return (
            <button
              key={card.id}
              onClick={() => handleClick(index)}
              disabled={isFlipped || flippedIndices.length >= 2}
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
                  <span className="text-[9px] text-muted-foreground mt-1">
                    {card.type === "spanish" ? "Español" : "Nasa Yuwe"}
                  </span>
                </span>
              ) : (
                <span className="flex items-center justify-center h-full text-2xl text-muted-foreground/30">
                  ?
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}