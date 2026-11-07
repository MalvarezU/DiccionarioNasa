"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { RefreshCw, CheckCircle2, Target, Timer, HelpCircle, XCircle, Flame } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  gameWordsOrDemo,
  reportGameResult,
  type GameWord,
} from "@/lib/game-words"
import { shuffle } from "@/lib/game-utils"
import { useGameFeedback } from "./game-feedback"
import { Confetti } from "./confetti"
import {
  useGsapGame,
  flipCard3D,
  matchBurst,
} from "@/lib/game-motion"

interface MemoryCard {
  id: string
  wordId: string
  text: string
  type: "spanish" | "nasaYuwe"
  illustrationUrl?: string | null
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
const MIN_MEMORY_WORDS = 4

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
        illustrationUrl: word.illustrationUrl ?? null,
        flipped: false,
        matched: false,
      })
      cards.push({
        id: `${word.id}-ny`,
        wordId: word.id,
        text: word.nasaYuwe,
        type: "nasaYuwe",
        illustrationUrl: word.illustrationUrl ?? null,
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
  const [streak, setStreak] = useState(0)
  const [missPair, setMissPair] = useState<number[]>([])
  const { playCorrect, playWrong, playWin, streakClass } = useGameFeedback()

  const [gameKey, setGameKey] = useState(0)
  const [retryKey, setRetryKey] = useState(0)

  // Fase 2.5 — motion GSAP: flip 3D real en cartas + matchBurst en parejas.
  // El shake/anim-flash-wrong de fallo y el anim-match-pop de parejas siguen
  // siendo los keyframes del juice kit CSS (composición, no competencia).
  const prevFlipRef = useRef<Map<string, boolean>>(new Map())
  const prevMatchRef = useRef<Map<string, boolean>>(new Map())

  const motionRoot = useGsapGame((api) => {
    const els = Array.from(
      api.root.querySelectorAll<HTMLElement>("[data-card-id]")
    )
    const ids = new Set(
      els.map((el) => el.getAttribute("data-card-id") ?? "")
    )
    // Mazo nuevo (restart / cambio de dificultad): limpiar el historial para
    // que el primer sync no anime deltas heredadas de otra partida.
    if (prevFlipRef.current.size > 0) {
      const sameDeck =
        prevFlipRef.current.size === ids.size &&
        [...prevFlipRef.current.keys()].every((k) => ids.has(k))
      if (!sameDeck) {
        prevFlipRef.current = new Map()
        prevMatchRef.current = new Map()
      }
    }

    // Lectura en batch, luego escrituras (evita layout thrashing).
    const fronts = els.map((el) => ({
      id: el.getAttribute("data-card-id") ?? "",
      inner: el.querySelector<HTMLElement>(".memory-flip-inner"),
      flipped: el.getAttribute("data-flip") === "1",
      matched: el.dataset.match === "1",
    }))

    for (const { id, inner, flipped, matched } of fronts) {
      const prevFlip = prevFlipRef.current.get(id)
      if (prevFlip === undefined) {
        // Primer sync del mazo: el CSS ya pinta el reposo vía `data-flip`,
        // solo se registra el punto de partida, sin imponer nada.
        prevFlipRef.current.set(id, flipped)
        prevMatchRef.current.set(id, matched)
        continue
      }
      if (prevFlip !== flipped) {
        flipCard3D(api.gsap, inner, flipped)
        prevFlipRef.current.set(id, flipped)
      }
      const prevMatch = prevMatchRef.current.get(id)
      if (prevMatch !== matched) {
        prevMatchRef.current.set(id, matched)
        if (matched) matchBurst(api.gsap, inner)
      }
    }
  }, [cards])

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
  }, [providedWords, retryKey])

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
    setMissPair([])
    setStreak(0)
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
        playCorrect()
        setStreak((s) => s + 1)
        setCards((prev) =>
          prev.map((c, idx) =>
            idx === i || idx === j ? { ...c, matched: true } : c
          )
        )
        setMatched((m) => m + 1)
        setFlippedIndices([])
      } else {
        playWrong()
        setStreak(0)
        setMissPair([i, j])
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, idx) =>
              idx === i || idx === j ? { ...c, flipped: false } : c
            )
          )
          setFlippedIndices([])
          setMissPair([])
        }, 1000)
      }
    },
    [playCorrect, playWrong]
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

  // Fanfarria al completar el tablero (Fase 2 juice kit)
  useEffect(() => {
    if (!finished) return
    playWin()
  }, [finished, playWin])

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

  function handleRetry() {
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignorar
    }
    setPool(null)
    setRetryKey((k) => k + 1)
  }

  function restart() {
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignorar
    }
    setGameKey((k) => k + 1)
    setFlippedIndices([])
    setMissPair([])
    setStreak(0)
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
    setMissPair([])
    setStreak(0)
    setMoves(0)
    setMatched(0)
    setSeconds(0)
    setFinished(false)
    setReported(false)
  }

  if (finished) {
    return (
      <div className="relative max-w-2xl mx-auto">
        <Confetti />
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-secondary" />
            <h3 className="text-2xl font-serif text-foreground">
              ¡Felicitaciones!
            </h3>
            <p className="text-muted-foreground">
              Encontraste todas las parejas en{" "}
              <strong className="text-montana">{moves}</strong> movimientos y{" "}
              <strong className="text-montana">{formatTime(seconds)}</strong>
            </p>
            <Button
              onClick={restart}
              variant="outline"
              className="game-press gap-2 mt-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Jugar de nuevo
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pool && pool.length < MIN_MEMORY_WORDS) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
          <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
          <h3 className="text-xl font-serif font-bold text-foreground">
            No se pudieron cargar las palabras
          </h3>
          <p className="text-sm text-muted-foreground">
            Revisa tu conexión e inténtalo de nuevo.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            <Button
              onClick={handleRetry}
              className="gap-2 game-press focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </Button>
            <Button
              asChild
              variant="outline"
              className="gap-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              <Link href="/juegos">Volver a juegos</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!pool || cards.length === 0) {
    return (
      <div
        ref={motionRoot}
        className="max-w-2xl mx-auto space-y-6"
        aria-busy="true"
        aria-label="Cargando juego"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: numPairs * 2 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">Cargando palabras...</p>
      </div>
    )
  }

  return (
    <div ref={motionRoot} className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-center gap-2" role="group" aria-label="Dificultad">
        {DIFFICULTIES.map((d) => (
          <Button
            key={d.pairs}
            variant={numPairs === d.pairs ? "default" : "outline"}
            size="sm"
            onClick={() => changeDifficulty(d.pairs)}
            aria-pressed={numPairs === d.pairs}
            className="game-press min-h-11 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            {d.label} ({d.pairs})
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between" role="status" aria-live="polite">
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="gap-1.5 text-sm">
            <Target className="h-4 w-4" aria-hidden="true" />
            Movimientos: {moves}
          </Badge>
          <Badge variant="secondary" className="gap-1.5 text-sm">
            <Timer className="h-4 w-4" aria-hidden="true" />
            {formatTime(seconds)}
          </Badge>
          {streak >= 3 && (
            <Badge variant="secondary" className={`gap-1.5 text-sm ${streakClass(streak)}`}>
              <Flame className="h-4 w-4" aria-hidden="true" />
              Racha: {streak}
            </Badge>
          )}
        </div>
        <Badge variant="outline" className="gap-1.5 text-sm border-tertiary/30 bg-tertiary-container text-tertiary">
          Parejas: {matched}/{pairsDealt}
        </Badge>
      </div>
      <Progress
        value={pairsDealt > 0 ? (matched / pairsDealt) * 100 : 0}
        className="h-2 game-progress bg-surface-container-high [&_[data-slot=progress-indicator]]:bg-secondary"
        aria-label={`Progreso: ${matched} de ${pairsDealt} parejas`}
      />

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3" role="group" aria-label="Tablero de memoria">
        {cards.map((card, index) => {
          const isFlipped = card.flipped || card.matched
          const isMiss = missPair.includes(index)
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleClick(index)}
              disabled={isFlipped || flippedIndices.length >= 2}
              data-card-id={card.id}
              data-flip={isFlipped ? "1" : "0"}
              data-match={card.matched ? "1" : "0"}
              aria-label={
                isFlipped
                  ? `${card.text} (${card.type === "spanish" ? "Español" : "Nasa Yuwe"})`
                  : `Carta tapada ${index + 1}`
              }
              className={`memory-flip-card group relative aspect-[3/4] min-h-11 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
                card.matched
                  ? "anim-match-pop"
                  : isMiss
                    ? "anim-flash-wrong"
                    : ""
              } ${!isFlipped ? "cursor-pointer" : ""}`}
            >
              {/* Flip 3D real (Fase 2.5): GSAP anime el inner. El dorso
                  (face-back) porta el estilo de estado (pareja/miss/revela)
                  y el frente (face-front) el de carta tapada + hover; la
                  composición con el juice kit queda intacta: el pop de la
                  pareja es `anim-match-pop` (escala) sobre el botón y el
                  burst de GSAP es rotateY sobre el inner. */}
              <span className="memory-flip-inner">
                <span className="memory-flip-face flex items-center justify-center rounded-xl border-2 border-muted-foreground/20 bg-muted/40 transition-colors group-hover:border-primary/50 group-hover:bg-muted/60">
                  <span className="text-muted-foreground/40" aria-hidden="true">
                    <HelpCircle className="h-7 w-7" />
                  </span>
                </span>
                <span
                  className={`memory-flip-face memory-flip-back flex rounded-xl border-2 transition-colors ${
                    card.matched
                      ? "border-secondary bg-secondary-container"
                      : isMiss
                        ? "border-destructive bg-destructive/10"
                        : "border-primary bg-primary/5"
                  } ${card.illustrationUrl ? "overflow-hidden" : ""}`}
                >
                  {card.illustrationUrl ? (
                    <span className="flex flex-col h-full w-full text-center">
                      <span className="relative block min-h-0 flex-1">
                        <img
                          src={card.illustrationUrl}
                          alt={card.text}
                          loading="lazy"
                          draggable={false}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </span>
                      <span className="flex flex-col items-center justify-center px-1 py-1.5">
                        <span
                          className={`font-serif font-medium leading-tight ${
                            card.type === "spanish"
                              ? "text-foreground text-sm sm:text-base"
                              : "text-primary text-base sm:text-lg"
                          }`}
                        >
                          {card.text}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {card.type === "spanish" ? "Español" : "Nasa Yuwe"}
                        </span>
                      </span>
                    </span>
                  ) : (
                    <span className="flex flex-col items-center justify-center h-full w-full p-1 text-center">
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
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}