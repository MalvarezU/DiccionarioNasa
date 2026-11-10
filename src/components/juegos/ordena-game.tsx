"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Flame,
  Lightbulb,
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
import {
  isOrdenaEligible,
  normalizeOrdenaApos,
  tokenizeOrdena,
} from "@/lib/ordena-tokenizer"
import { useGameFeedback } from "./game-feedback"
import { Confetti } from "./confetti"
import {
  useGsapGame,
  tileDropIn,
  tileSettleBack,
} from "@/lib/game-motion"

const NUM_ROUNDS = 8
const MIN_ORDENA_WORDS = 4
const MAX_ATTEMPTS = 3
const STORE_KEY = "piiyaak:ordenar:v1"

interface OrdenaTile {
  id: string
  text: string
}

interface OrdenaQuestion {
  word: GameWord
  tokens: string[]
  /** Respuesta canónica (apóstrofos normalizados, caso original). */
  answer: string
  tiles: OrdenaTile[]
}

interface StoredOrdena {
  ids: string[]
  index: number
  correct: number
  streak: number
  best: number
}

function loadStored(): StoredOrdena | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null
    const raw = sessionStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredOrdena>
    if (
      !Array.isArray(parsed.ids) ||
      parsed.ids.length < MIN_ORDENA_WORDS ||
      !parsed.ids.every((id) => typeof id === "string")
    ) {
      return null
    }
    const num = (v: unknown) => (Number.isFinite(v) ? Number(v) : 0)
    const index = num(parsed.index)
    if (index < 0 || index >= parsed.ids.length) return null
    return {
      ids: parsed.ids,
      index,
      correct: num(parsed.correct),
      streak: num(parsed.streak),
      best: num(parsed.best),
    }
  } catch {
    return null
  }
}

function buildQuestion(word: GameWord, qi: number): OrdenaQuestion {
  const tokens = tokenizeOrdena(word.nasaYuwe)
  const tiles = shuffle(
    tokens.map((text, i) => ({ id: `q${qi}-t${i}`, text }))
  )
  return { word, tokens, answer: normalizeOrdenaApos(word.nasaYuwe), tiles }
}

type RoundStatus = "playing" | "correct" | "failed"

export function OrdenaGame({
  words: providedWords,
  onFinish,
}: {
  words?: GameWord[]
  onFinish?: (result: { correct: number; total: number }) => void
} = {}) {
  const [roundKey, setRoundKey] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [pool, setPool] = useState<GameWord[] | null>(
    providedWords && providedWords.length >= 1 ? providedWords : null
  )
  const { playCorrect, playWrong, playWin, streakClass } = useGameFeedback()
  const checkRef = useRef<HTMLButtonElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)

  // Palabras reales (con fallback a demo si falla la red)
  useEffect(() => {
    if (providedWords && providedWords.length >= 1) return
    let alive = true
    gameWordsOrDemo(12).then((words) => {
      if (alive) setPool(words)
    })
    return () => {
      alive = false
    }
  }, [providedWords, retryKey])

  const eligible = useMemo(
    () => (pool ? pool.filter(isOrdenaEligible) : null),
    [pool]
  )
  const tooFew = eligible !== null && eligible.length < MIN_ORDENA_WORDS

  // Ronda inicial: restaurada de sesión o nueva (patrón memory-game)
  const initial = useMemo(() => {
    if (!eligible || eligible.length < MIN_ORDENA_WORDS) return null
    const stored = loadStored()
    if (stored) {
      const byId = new Map(eligible.map((w) => [w.id, w]))
      if (
        stored.index < stored.ids.length &&
        stored.ids.every((id) => byId.has(id))
      ) {
        const words = stored.ids
          .map((id) => byId.get(id)!)
          .slice(0, NUM_ROUNDS)
        if (stored.index < words.length) {
          return {
            questions: words.map((w, qi) => buildQuestion(w, qi)),
            index: stored.index,
            correct: Math.min(stored.correct, words.length),
            streak: stored.streak,
            best: stored.best,
          }
        }
      }
    }
    return {
      questions: shuffle(eligible)
        .slice(0, NUM_ROUNDS)
        .map((w, qi) => buildQuestion(w, qi)),
      index: 0,
      correct: 0,
      streak: 0,
      best: 0,
    }
  }, [eligible, roundKey])

  const [questions, setQuestions] = useState<OrdenaQuestion[] | null>(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [placedIds, setPlacedIds] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)
  const [status, setStatus] = useState<RoundStatus>("playing")
  const [hintLocked, setHintLocked] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [finished, setFinished] = useState(false)
  const [reported, setReported] = useState(false)

  // Fase 2.5 — motion GSAP. Momento marcado del juego: la ficha vuela al
  // slot (drop-in con bounce) y, al deshacer, retorna con un settle corto.
  // El presionado (game-press) y las recompensas del juice kit CSS quedan
  // como están: GSAP anima el span interno de la ficha, fuera del
  // `transition: transform` que `game-press` ya tiene en el botón.
  const prevPlacedRef = useRef<string[] | null>(null)

  const motionRoot = useGsapGame((api) => {
    const slots = api.root.querySelector<HTMLElement>(
      '[data-testid="ordena-slots"]'
    )
    const bank = api.root.querySelector<HTMLElement>(
      '[data-testid="ordena-bank"]'
    )
    const prev = prevPlacedRef.current
    prevPlacedRef.current = [...placedIds]
    if (prev === null) {
      // Primer sync (ronda restaurada o nueva): no hay deltas que animar.
      return
    }
    const addedIds = placedIds.filter((id) => !prev.includes(id))
    const removedIds = prev.filter((id) => !placedIds.includes(id))
    // Búsqueda única por ficha (slots primero, banca después).
    const find = (id: string) =>
      slots?.querySelector(`[data-tile-id="${id}"]`) ??
      bank?.querySelector(`[data-tile-id="${id}"]`) ??
      null
    addedIds.forEach((id) => tileDropIn(api.gsap, find(id)))
    removedIds.forEach((id) => tileSettleBack(api.gsap, find(id)))
  }, [placedIds])

  // Sincronizar ronda inicial (evita redeclarar `questions`)
  useEffect(() => {
    if (!initial || questions) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: aplica la ronda inicial o restaurada (patrón memory-game)
    setQuestions(initial.questions)
    setRoundIndex(initial.index)
    setCorrectCount(initial.correct)
    setStreak(initial.streak)
    setBestStreak(initial.best)
    setPlacedIds([])
    setAttempts(0)
    setStatus("playing")
    setHintLocked(false)
    setFinished(false)
    setReported(false)
  }, [initial])

  // Persistir progreso (recargar no pierde la partida)
  useEffect(() => {
    if (!questions || finished) return
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          ids: questions.map((q) => q.word.id),
          index: roundIndex,
          correct: correctCount,
          streak,
          best: bestStreak,
        } satisfies StoredOrdena)
      )
    } catch {
      // almacenamiento bloqueado: el juego sigue
    }
  }, [questions, roundIndex, correctCount, streak, bestStreak, finished])

  const total = questions?.length ?? 0
  const current = questions?.[roundIndex]
  const byId = useMemo(
    () => new Map((current?.tiles ?? []).map((t) => [t.id, t])),
    [current]
  )
  const placedTiles = placedIds
    .map((id) => byId.get(id))
    .filter((t): t is OrdenaTile => t !== undefined)
  const bankTiles = (current?.tiles ?? []).filter(
    (t) => !placedIds.includes(t.id)
  )
  const slotsFull = !!current && placedIds.length >= current.tokens.length

  function focusFeedback() {
    window.setTimeout(
      () => feedbackRef.current?.focus({ preventScroll: true }),
      50
    )
  }

  /** 2º intento: fija la primera ficha en su lugar (escalera de ayuda). */
  function applyHint(q: OrdenaQuestion, ids: string[]): string[] {
    const first = q.tokens[0]!
    const lookup = new Map(q.tiles.map((t) => [t.id, t]))
    if (lookup.get(ids[0])?.text === first) return ids
    const hintTile =
      q.tiles.find((t) => t.text === first && !ids.includes(t.id)) ??
      q.tiles.find((t) => t.text === first)!
    return [hintTile.id, ...ids.filter((id) => id !== hintTile.id)]
  }

  function handlePlace(tileId: string) {
    if (!current || status !== "playing" || slotsFull) return
    setPlacedIds((prev) => (prev.includes(tileId) ? prev : [...prev, tileId]))
  }

  function handleRemove(tileId: string, locked: boolean) {
    if (!current || status !== "playing" || locked) return
    setPlacedIds((prev) => prev.filter((id) => id !== tileId))
  }

  function handleCheck() {
    if (!current || status !== "playing" || !slotsFull) return
    const guess = placedTiles.map((t) => t.text).join("")
    if (guess === current.answer) {
      playCorrect()
      setStatus("correct")
      setCorrectCount((c) => c + 1)
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        return next
      })
    } else {
      playWrong()
      const next = attempts + 1
      setAttempts(next)
      setStreak(0)
      if (next >= MAX_ATTEMPTS) {
        setStatus("failed")
      } else if (next === 1) {
        setPlacedIds((prev) => applyHint(current, prev))
        setHintLocked(true)
      }
    }
    focusFeedback()
  }

  function resetRound() {
    setPlacedIds([])
    setAttempts(0)
    setStatus("playing")
    setHintLocked(false)
  }

  function handleNext() {
    if (!questions || roundIndex + 1 >= questions.length) {
      setFinished(true)
    } else {
      setRoundIndex((i) => i + 1)
      resetRound()
    }
  }

  function clearStored() {
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignorar
    }
  }

  function handleRestart() {
    clearStored()
    setQuestions(null)
    setRoundIndex(0)
    resetRound()
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setFinished(false)
    setReported(false)
    setRoundKey((k) => k + 1)
  }

  function handleRetry() {
    clearStored()
    setQuestions(null)
    setPool(providedWords && providedWords.length >= 1 ? providedWords : null)
    setRetryKey((k) => k + 1)
  }

  // Avance automático tras el acierto (Siguiente queda como fallback manual)
  useEffect(() => {
    if (status !== "correct") return
    const t = window.setTimeout(() => {
      handleNext()
    }, 800)
    return () => window.clearTimeout(t)
  }, [status, roundIndex])

  // Foco en Comprobar cuando la respuesta está completa (flujo de teclado)
  useEffect(() => {
    if (slotsFull && status === "playing") {
      checkRef.current?.focus({ preventScroll: true })
    }
  }, [slotsFull])

  // Persiste el resultado al terminar (backend si hay sesión, local siempre)
  useEffect(() => {
    if (!finished || reported || total === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: reporta una sola vez al terminar (patrón flashcard-game)
    setReported(true)
    clearStored()
    onFinish?.({ correct: correctCount, total })
    const won = correctCount >= total * 0.5
    if (won) playWin()
    void reportGameResult({
      game: "ordena",
      won,
      score: correctCount * 10,
      streak: bestStreak,
    })
  }, [finished, reported, total, correctCount, bestStreak, onFinish, playWin])

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

  if (!questions || !current) {
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
    return (
      <div className="relative max-w-2xl mx-auto">
        {won && <Confetti pieces={40} />}
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-secondary" />
            <h3 className="text-2xl font-serif text-foreground">¡Completado!</h3>
            <p className="text-muted-foreground">
              Ordenaste <strong className="text-montana">{correctCount}</strong>{" "}
              de <strong>{total}</strong> palabras
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

  const showFeedback = status === "correct" || status === "failed" || attempts > 0

  return (
    <div ref={motionRoot} className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-montana">
            Palabra {roundIndex + 1} de {total}
          </span>
          <div className="flex items-center gap-3">
            {/* Columna reservada: el badge alterna visible/invisible sin
                colapsar el layout (regla reserve-then-fill). */}
            <span
              data-testid="ordena-streak-slot"
              className="inline-flex min-h-7 min-w-24 items-center justify-end"
            >
              <Badge
                variant="secondary"
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
          value={((roundIndex + 1) / total) * 100}
          className="h-2 game-progress bg-surface-container-high [&_[data-slot=progress-indicator]]:bg-secondary"
          aria-label={`Progreso: palabra ${roundIndex + 1} de ${total}`}
        />
      </div>

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="pt-8 pb-6 flex flex-col items-center gap-6">
          <p className="text-sm text-muted-foreground">
            Arma esta palabra en Nasa Yuwe:
          </p>
          <h2 className="text-4xl font-serif font-bold text-primary text-center">
            {current.word.spanish}
          </h2>

          {/* Slots de respuesta */}
          <div
            className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 min-h-14"
            data-testid="ordena-slots"
            role="group"
            aria-label="Tu respuesta, toca una ficha puesta para quitarla"
          >
            {status === "failed" ? (
              current.tokens.map((token, i) => (
                <span
                  key={i}
                  className="min-h-11 px-3 py-2 rounded-lg border border-secondary bg-secondary-container text-lg font-bold text-montana"
                >
                  {token}
                </span>
              ))
            ) : (
              <>
                {placedTiles.map((tile, i) => {
                  const locked = hintLocked && i === 0
                  return (
                    <Button
                      key={tile.id}
                      variant="outline"
                      size="lg"
                      onClick={() => handleRemove(tile.id, locked)}
                      disabled={locked}
                      aria-label={
                        locked
                          ? `Ficha fija ${tile.text}`
                          : `Quitar ficha ${tile.text}`
                      }
                      className={`h-auto min-h-11 px-3 py-2 text-lg font-bold game-press focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
                        locked
                          ? "border-secondary bg-secondary-container text-montana cursor-default"
                          : "border-primary/40 hover:border-primary"
                      }`}
                    >
                      <span data-tile-id={tile.id} className="inline-flex">
                        {tile.text}
                      </span>
                    </Button>
                  )
                })}
                {Array.from({
                  length: current.tokens.length - placedTiles.length,
                }).map((_, i) => (
                  <span
                    key={`vacio-${i}`}
                    aria-hidden="true"
                    className="min-h-11 min-w-11 rounded-lg border-2 border-dashed border-primary/25"
                  />
                ))}
              </>
            )}
          </div>

          {/* Banco de fichas mezcladas */}
          {status !== "failed" && (
            <div
              className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
              data-testid="ordena-bank"
              role="group"
              aria-label="Fichas disponibles, toca una para ponerla"
            >
              {bankTiles.map((tile) => (
                <Button
                  key={tile.id}
                  variant="secondary"
                  size="lg"
                  disabled={slotsFull}
                  onClick={() => handlePlace(tile.id)}
                  aria-label={`Ficha ${tile.text}`}
                  className="h-auto min-h-11 px-3 py-2 text-lg font-bold game-press focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                  <span data-tile-id={tile.id} className="inline-flex">
                    {tile.text}
                  </span>
                </Button>
              ))}
            </div>
          )}

          {/* Pista con espacio reservado: visible/invisible en vez de
              montar/desmontar (regla reserve-then-fill). */}
          <div data-testid="ordena-hint" className="flex min-h-6 items-center justify-center">
            <p
              aria-hidden={!(hintLocked && status === "playing")}
              className={`flex items-center gap-1.5 text-sm text-montana ${
                hintLocked && status === "playing" ? "visible" : "invisible"
              }`}
            >
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              Pista: la primera ficha es «{current.tokens[0]}»
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="sr-only">
            Intentos fallidos: {attempts} de {MAX_ATTEMPTS}
          </span>
          <span
            role="img"
            aria-label={`${MAX_ATTEMPTS - attempts} intentos restantes de ${MAX_ATTEMPTS}`}
            className="flex items-center gap-2"
          >
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-3 w-3 rounded-full ${
                  i < attempts ? "bg-destructive" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </span>
          <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-tertiary ml-1">
            Intentos: {attempts}/{MAX_ATTEMPTS}
          </span>
        </div>

        {status === "playing" && (
          <Button
            ref={checkRef}
            onClick={handleCheck}
            disabled={!slotsFull}
            className="game-press gap-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            Comprobar
          </Button>
        )}
        {status !== "playing" && (
          <Button
            onClick={handleNext}
            variant="outline"
            className="game-press gap-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            Siguiente
          </Button>
        )}
      </div>

      {/* Feedback con altura reservada: el bloque siempre montado,
          visible/invisible según estado (regla reserve-then-fill). El banco
          de fichas en `failed` se revisó y se deja condicional: es contenido
          principal terminal (no un pill), y reservar su hueco dejaría un
          vacío muerto en vez de evitar un brinco. */}
      <div
        data-testid="ordena-feedback"
        className="flex min-h-8 items-center justify-center"
      >
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role={showFeedback ? (status === "playing" ? "alert" : "status") : undefined}
          aria-live={showFeedback ? (status === "playing" ? "assertive" : "polite") : undefined}
          aria-hidden={!showFeedback}
          className={`rounded-lg focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
            showFeedback ? "visible" : "invisible"
          }`}
        >
          {status === "correct" && (
            <p className="flex items-center gap-2 text-montana font-medium">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ¡Correcto!
            </p>
          )}
          {status === "failed" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5" aria-hidden="true" />
              <span>
                La respuesta era{" "}
                <strong className="text-foreground">{current.answer}</strong>
              </span>
            </p>
          )}
          {status === "playing" && attempts > 0 && (
            <p className="flex items-center gap-2 text-destructive font-medium">
              <XCircle className="h-5 w-5" aria-hidden="true" />
              Casi: prueba otro orden
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
