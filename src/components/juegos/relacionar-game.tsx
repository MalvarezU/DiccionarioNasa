"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Flame,
  Check,
} from "lucide-react"
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
  slideReveal,
  streakTierPulse,
  streakTier,
} from "@/lib/game-motion"
import { playStreakTier } from "@/lib/game-sound"

export type RelacionarDificultad = "facil" | "medio" | "dificil"

const REL_DIFFICULTIES: Array<{
  value: RelacionarDificultad
  label: string
  pairs: number
  rounds: number
}> = [
  { value: "facil", label: "Fácil", pairs: 5, rounds: 3 },
  { value: "medio", label: "Medio", pairs: 6, rounds: 4 },
  { value: "dificil", label: "Difícil", pairs: 8, rounds: 4 },
]

const DEFAULT_REL_PAIRS = 5
const MAX_RELACIONAR_WORDS = 32 // Difícil: 4 rondas × 8 parejas
const MIN_RELACIONAR_WORDS = 5
const MISS_MS = 600
const NEXT_MS = 900
const STORE_KEY = "piiyaak:relacionar:v1"

interface StoredRelacionar {
  ids: string[]
  index: number
  correct: number
  streak: number
  best: number
  pairsPerRound: number
}

const VALID_REL_PAIRS = new Set(REL_DIFFICULTIES.map((d) => d.pairs))

function loadStored(pairsPerRound: number): StoredRelacionar | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null
    const raw = sessionStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredRelacionar>
    if (
      !Array.isArray(parsed.ids) ||
      parsed.ids.length < MIN_RELACIONAR_WORDS ||
      !parsed.ids.every((id) => typeof id === "string")
    ) {
      return null
    }
    // Solo restaura si la tanda guardada es del mismo nivel actual.
    const storedPairs =
      typeof parsed.pairsPerRound === "number" &&
      VALID_REL_PAIRS.has(parsed.pairsPerRound)
        ? parsed.pairsPerRound
        : DEFAULT_REL_PAIRS
    if (storedPairs !== pairsPerRound) return null
    const num = (v: unknown) => (Number.isFinite(v) ? Number(v) : 0)
    const index = num(parsed.index)
    if (index < 0 || index * pairsPerRound >= parsed.ids.length) return null
    return {
      ids: parsed.ids,
      index,
      correct: num(parsed.correct),
      streak: num(parsed.streak),
      best: num(parsed.best),
      pairsPerRound: storedPairs,
    }
  } catch {
    return null
  }
}

/** Parte el pool en rondas de `pairsPerRound` (máximo `numRounds`);
    con pool chico salen menos rondas, igual que antes. */
function buildRounds(
  pool: GameWord[],
  pairsPerRound: number,
  numRounds: number
): GameWord[][] {
  const picked = shuffle(pool).slice(0, pairsPerRound * numRounds)
  const rounds: GameWord[][] = []
  for (let i = 0; i < picked.length; i += pairsPerRound) {
    const chunk = picked.slice(i, i + pairsPerRound)
    if (chunk.length === pairsPerRound) rounds.push(chunk)
  }
  return rounds
}

interface Miss {
  left: string
  right: string
  key: number
}

export function RelacionarGame({
  words: providedWords,
  onFinish,
}: {
  words?: GameWord[]
  onFinish?: (result: { correct: number; total: number }) => void
} = {}) {
  const [roundKey, setRoundKey] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [difficulty, setDifficulty] =
    useState<RelacionarDificultad>("facil")
  const diff = REL_DIFFICULTIES.find((d) => d.value === difficulty)!
  const pairsPerRound = diff.pairs
  const numRounds = diff.rounds
  const [pool, setPool] = useState<GameWord[] | null>(
    providedWords && providedWords.length >= 1 ? providedWords : null
  )
  const { playCorrect, playWrong, playWin, streakClass } = useGameFeedback()
  const missTimer = useRef<number | null>(null)

  // Palabras reales (con fallback a demo si falla la red)
  useEffect(() => {
    if (providedWords && providedWords.length >= 1) return
    let alive = true
    gameWordsOrDemo(MAX_RELACIONAR_WORDS).then((words) => {
      if (alive) setPool(words)
    })
    return () => {
      alive = false
    }
  }, [providedWords, retryKey])

  const tooFew = pool !== null && pool.length < MIN_RELACIONAR_WORDS

  // Rondas iniciales: restauradas de sesión o nuevas (patrón ordena-game)
  const initial = useMemo(() => {
    if (!pool || pool.length < MIN_RELACIONAR_WORDS) return null
    const stored = loadStored(pairsPerRound)
    if (stored) {
      const byId = new Map(pool.map((w) => [w.id, w]))
      if (stored.ids.every((id) => byId.has(id))) {
        const words = stored.ids.map((id) => byId.get(id)!)
        const rounds: GameWord[][] = []
        for (let i = 0; i < words.length; i += pairsPerRound) {
          const chunk = words.slice(i, i + pairsPerRound)
          if (chunk.length === pairsPerRound) rounds.push(chunk)
        }
        if (stored.index < rounds.length) {
          return {
            rounds,
            index: stored.index,
            correct: Math.min(stored.correct, rounds.length * pairsPerRound),
            streak: stored.streak,
            best: stored.best,
          }
        }
      }
    }
    const rounds = buildRounds(pool, pairsPerRound, numRounds)
    if (rounds.length === 0) return null
    return { rounds, index: 0, correct: 0, streak: 0, best: 0 }
  }, [pool, roundKey, pairsPerRound, numRounds])

  const [rounds, setRounds] = useState<GameWord[][] | null>(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [matchedIds, setMatchedIds] = useState<string[]>([])
  const [selLeft, setSelLeft] = useState<string | null>(null)
  const [selRight, setSelRight] = useState<string | null>(null)
  const [miss, setMiss] = useState<Miss | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [liveMsg, setLiveMsg] = useState("")
  const [finished, setFinished] = useState(false)
  const [reported, setReported] = useState(false)

  const current = rounds?.[roundIndex] ?? null
  const total = rounds ? rounds.length * pairsPerRound : 0
  const roundDone = current !== null && matchedIds.length >= current.length

  // Columna derecha (Nasa Yuwe) mezclada; la izquierda queda en orden fijo.
  const rightOrder = useMemo(
    () => (current ? shuffle(current) : []),
    [current]
  )

  // Sincronizar rondas iniciales (evita redeclarar `rounds`)
  useEffect(() => {
    if (!initial || rounds) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: aplica las rondas iniciales o restauradas (patrón memory-game)
    setRounds(initial.rounds)
    setRoundIndex(initial.index)
    setCorrectCount(initial.correct)
    setStreak(initial.streak)
    setBestStreak(initial.best)
    setMatchedIds([])
    setSelLeft(null)
    setSelRight(null)
    setMiss(null)
    setLiveMsg("")
    setFinished(false)
    setReported(false)
  }, [initial])

  // Persistir progreso (recargar no pierde la partida)
  useEffect(() => {
    if (!rounds || finished) return
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          ids: rounds.flat().map((w) => w.id),
          index: roundIndex,
          correct: correctCount,
          streak,
          best: bestStreak,
          pairsPerRound,
        } satisfies StoredRelacionar)
      )
    } catch {
      // almacenamiento bloqueado: el juego sigue
    }
  }, [rounds, roundIndex, correctCount, streak, bestStreak, finished, pairsPerRound])

  // Fase motion: un solo contexto GSAP. Entrada de ronda (slide), pulso 2D
  // sobre la pareja recién unida y pulso del badge al subir de tier.
  // Nada de flip 3D ni backface-visibility: solo escalas planas.
  const prevRoundRef = useRef<number | null>(null)
  const prevMatchRef = useRef<string[]>([])
  const prevTierRef = useRef(0)

  const motionRoot = useGsapGame(
    (api) => {
      if (prevRoundRef.current !== roundIndex) {
        prevRoundRef.current = roundIndex
        prevMatchRef.current = [...matchedIds]
        slideReveal(api.gsap, api.root.querySelector("[data-round]"))
      } else {
        const prev = prevMatchRef.current
        prevMatchRef.current = [...matchedIds]
        matchedIds
          .filter((id) => !prev.includes(id))
          .forEach((id) => {
            api.root
              .querySelectorAll(`[data-pair="${id}"]`)
              .forEach((el) => streakTierPulse(api.gsap, el))
          })
      }
      const tier = streakTier(streak)
      if (tier > prevTierRef.current) {
        streakTierPulse(api.gsap, api.root.querySelector("[data-streak-badge]"))
      }
      prevTierRef.current = tier
    },
    [roundIndex, matchedIds, streak]
  )

  function resetRoundState() {
    setMatchedIds([])
    setSelLeft(null)
    setSelRight(null)
    setMiss(null)
    setLiveMsg("")
  }

  function advance() {
    if (!rounds || !roundDone) return
    if (roundIndex + 1 >= rounds.length) {
      setFinished(true)
    } else {
      setRoundIndex((i) => i + 1)
      resetRoundState()
    }
  }

  // Avance automático al completar la ronda (Siguiente queda como fallback)
  useEffect(() => {
    if (!roundDone || finished) return
    const t = window.setTimeout(advance, NEXT_MS)
    return () => window.clearTimeout(t)
  }, [roundDone, roundIndex, finished])

  // Limpieza del temporizador del shake al desmontar
  useEffect(() => {
    return () => {
      if (missTimer.current !== null) window.clearTimeout(missTimer.current)
    }
  }, [])

  // Persiste el resultado al terminar (backend si hay sesión, local siempre)
  useEffect(() => {
    if (!finished || reported || total === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: reporta una sola vez al terminar (patrón flashcard-game)
    setReported(true)
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignorar
    }
    onFinish?.({ correct: correctCount, total })
    const won = correctCount >= total * 0.5
    if (won) playWin()
    void reportGameResult({
      game: "relacionar",
      won,
      score: correctCount * 10,
      streak: bestStreak,
    })
  }, [finished, reported, total, correctCount, bestStreak, onFinish, playWin])

  function clearStored() {
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignorar
    }
  }

  function handleRestart() {
    clearStored()
    if (missTimer.current !== null) window.clearTimeout(missTimer.current)
    setRounds(null)
    setRoundIndex(0)
    resetRoundState()
    setAttempts(0)
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setFinished(false)
    setReported(false)
    setRoundKey((k) => k + 1)
  }

  function handleRetry() {
    clearStored()
    setRounds(null)
    setPool(providedWords && providedWords.length >= 1 ? providedWords : null)
    setRetryKey((k) => k + 1)
  }

  function changeDifficulty(next: RelacionarDificultad) {
    if (next === difficulty) return
    clearStored()
    if (missTimer.current !== null) window.clearTimeout(missTimer.current)
    setDifficulty(next)
    setRounds(null)
    setRoundIndex(0)
    resetRoundState()
    setAttempts(0)
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setFinished(false)
    setReported(false)
    setRoundKey((k) => k + 1)
  }

  function evaluatePair(leftId: string, rightId: string) {
    const leftWord = current?.find((w) => w.id === leftId)
    setAttempts((a) => a + 1)
    if (leftId === rightId && leftWord) {
      const nextTier = streakTier(streak + 1)
      if (nextTier > streakTier(streak) && nextTier !== 0) {
        playStreakTier(nextTier)
      }
      playCorrect()
      setMatchedIds((prev) => (prev.includes(leftId) ? prev : [...prev, leftId]))
      setSelLeft(null)
      setSelRight(null)
      setCorrectCount((c) => c + 1)
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        return next
      })
      setLiveMsg(`¡Correcto! ${leftWord.spanish} es ${leftWord.nasaYuwe}`)
    } else {
      playWrong()
      setStreak(0)
      setMiss((m) => ({ left: leftId, right: rightId, key: (m?.key ?? 0) + 1 }))
      setLiveMsg("No son pareja, intenta de nuevo")
      if (missTimer.current !== null) window.clearTimeout(missTimer.current)
      missTimer.current = window.setTimeout(() => {
        setMiss(null)
        setSelLeft(null)
        setSelRight(null)
      }, MISS_MS)
    }
  }

  function handlePick(side: "left" | "right", id: string) {
    if (!current || finished || miss !== null) return
    if (matchedIds.includes(id)) return
    if (side === "left") {
      if (selRight !== null) {
        setSelLeft(id)
        evaluatePair(id, selRight)
      } else {
        setSelLeft((prev) => (prev === id ? null : id))
      }
    } else {
      if (selLeft !== null) {
        setSelRight(id)
        evaluatePair(selLeft, id)
      } else {
        setSelRight((prev) => (prev === id ? null : id))
      }
    }
  }

  if (tooFew) {
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

  if (!rounds || !current) {
    return (
      <div
        className="max-w-2xl mx-auto space-y-6"
        aria-busy="true"
        aria-label="Cargando juego"
      >
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3 rounded" />
          <Skeleton className="h-2 rounded" />
        </div>
        <Card className="border-primary/20">
          <CardContent className="pt-8 pb-6 flex flex-col items-center gap-6">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-10 w-56 rounded" />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Cargando palabras...
        </p>
      </div>
    )
  }

  if (finished) {
    const won = correctCount >= total * 0.5
    const ratio = total > 0 ? correctCount / total : 0
    return (
      <div className="relative max-w-2xl mx-auto">
        {won && <Confetti pieces={ratio >= 0.8 ? 60 : 40} />}
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-secondary" />
            <h3 className="text-2xl font-serif text-foreground">¡Completado!</h3>
            <p className="text-muted-foreground">
              Relacionaste <strong className="text-montana">{correctCount}</strong>{" "}
              de <strong>{total}</strong> parejas
            </p>
            <Badge
              variant="secondary"
              className="gap-1.5 text-sm bg-secondary-container text-montana border border-secondary/30"
            >
              {correctCount >= total * 0.8
                ? "¡Excelente!"
                : correctCount >= total * 0.5
                  ? "Buen trabajo"
                  : "Sigue practicando"}
            </Badge>
            <Button
              onClick={handleRestart}
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

  const missIds = miss ? [miss.left, miss.right] : []

  function pairButtonClass(
    id: string,
    selected: boolean,
    label: "es" | "ny"
  ): string {
    const base =
      "h-auto min-h-11 w-full px-3 py-3 text-base sm:text-lg font-medium game-press focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    if (matchedIds.includes(id)) {
      return `${base} border-secondary bg-secondary-container text-montana`
    }
    if (missIds.includes(id)) {
      return `${base} border-destructive bg-destructive/10 text-destructive anim-flash-wrong`
    }
    if (selected) {
      return `${base} border-primary bg-primary/10 text-primary`
    }
    return `${base} hover:border-primary hover:bg-primary/5 ${
      label === "ny" ? "font-serif font-bold" : ""
    }`
  }

  return (
    <div ref={motionRoot} className="max-w-2xl mx-auto space-y-6">
      {/* Dificultad: mismo patrón visual que memoria (chips con aria-pressed). */}
      <div className="flex items-center justify-center gap-2" role="group" aria-label="Dificultad">
        {REL_DIFFICULTIES.map((d) => (
          <Button
            key={d.value}
            variant={difficulty === d.value ? "default" : "outline"}
            size="sm"
            onClick={() => changeDifficulty(d.value)}
            aria-pressed={difficulty === d.value}
            className="game-press min-h-11 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            {d.label} ({d.pairs}×{d.rounds})
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-montana">
            Ronda {roundIndex + 1} de {rounds.length}
          </span>
          <div className="flex items-center gap-3">
            {/* Columna reservada: el badge alterna visible/invisible sin
                colapsar el layout (regla reserve-then-fill). */}
            <span
              data-testid="relacionar-streak-slot"
              className="inline-flex min-h-7 min-w-24 items-center justify-end"
            >
              <Badge
                variant="secondary"
                data-streak-badge
                aria-hidden={streak < 2}
                className={`gap-1 ${streakClass(streak)} ${
                  streak >= 2 ? "visible" : "invisible"
                }`}
              >
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                Racha: {streak}
              </Badge>
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Check className="h-4 w-4" aria-hidden="true" />
              <span aria-label={`${correctCount} aciertos`}>{correctCount}</span>
            </span>
          </div>
        </div>
        <Progress
          value={total > 0 ? (correctCount / total) * 100 : 0}
          className="h-2 game-progress bg-surface-container-high [&_[data-slot=progress-indicator]]:bg-secondary"
          aria-label={`Progreso: ${correctCount} de ${total} parejas`}
        />
      </div>

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent data-round className="pt-8 pb-6 flex flex-col items-center gap-6">
          <p className="text-sm text-muted-foreground">
            Toca una palabra de cada lado para unir cada pareja. Llevas{" "}
            {matchedIds.length} de {current.length} en esta ronda.
          </p>
          <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
            <div
              role="group"
              aria-label="Español: elige una palabra"
              className="flex flex-col gap-2"
            >
              {current.map((word) => (
                <Button
                  key={word.id}
                  variant="outline"
                  onClick={() => handlePick("left", word.id)}
                  disabled={matchedIds.includes(word.id) || miss !== null}
                  aria-pressed={selLeft === word.id}
                  aria-label={word.spanish}
                  className={pairButtonClass(word.id, selLeft === word.id, "es")}
                >
                  <span data-pair={word.id} className="inline-flex">
                    {word.spanish}
                  </span>
                </Button>
              ))}
            </div>
            <div
              role="group"
              aria-label="Nasa Yuwe: elige su pareja"
              className="flex flex-col gap-2"
            >
              {rightOrder.map((word) => (
                <Button
                  key={word.id}
                  variant="outline"
                  onClick={() => handlePick("right", word.id)}
                  disabled={matchedIds.includes(word.id) || miss !== null}
                  aria-pressed={selRight === word.id}
                  aria-label={word.nasaYuwe}
                  className={pairButtonClass(word.id, selRight === word.id, "ny")}
                >
                  <span data-pair={word.id} className="inline-flex">
                    {word.nasaYuwe}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-tertiary">
          Intentos: {attempts}
        </span>

        {/* Slot reservado: Siguiente/Ver resultados aparece sin mover el
            documento (regla reserve-then-fill). */}
        <div
          data-testid="relacionar-next"
          aria-hidden={!roundDone}
          className="flex min-h-10 items-center justify-end"
        >
          <Button
            onClick={advance}
            disabled={!roundDone}
            tabIndex={roundDone ? 0 : -1}
            inert={!roundDone}
            className={`game-press gap-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
              roundDone ? "visible" : "invisible"
            }`}
          >
            {roundIndex + 1 >= rounds.length ? "Ver resultados" : "Siguiente ronda"}
          </Button>
        </div>
      </div>

      {/* Mensaje de acierto/error con altura reservada: siempre montado,
          visible/invisible según estado (regla reserve-then-fill). */}
      <div
        data-testid="relacionar-feedback"
        className="flex min-h-8 items-center justify-center"
      >
        <p
          role="status"
          aria-live="polite"
          aria-hidden={!liveMsg}
          className={`flex items-center gap-2 font-medium ${
            liveMsg ? "visible" : "invisible"
          } ${liveMsg.startsWith("¡Correcto") ? "text-montana" : "text-destructive"}`}
        >
          {liveMsg.startsWith("¡Correcto") ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            liveMsg && <XCircle className="h-5 w-5" aria-hidden="true" />
          )}
          {liveMsg || " "}
        </p>
      </div>
    </div>
  )
}
