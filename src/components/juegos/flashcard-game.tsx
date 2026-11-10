"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { RefreshCw, CheckCircle2, XCircle, Flame, Check, ArrowLeftRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { type DemoWord } from "@/lib/demo-content"
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
  countUp,
  streakTier,
} from "@/lib/game-motion"

type Direction = "es-nasa" | "nasa-es"

interface FlashcardQuestion {
  prompt: string
  title: string
  options: string[]
  correctIndex: number
}

const MIN_FLASH_WORDS = 4

function buildQuestions(pool: GameWord[], direction: Direction): FlashcardQuestion[] {
  return shuffle(pool)
    .slice(0, 8)
    .map((word) => {
      const ask = direction === "es-nasa" ? word.spanish : word.nasaYuwe
      const answer = (w: GameWord) =>
        direction === "es-nasa" ? w.nasaYuwe : w.spanish
      const distractors = shuffle(pool.filter((w) => w.id !== word.id))
        .slice(0, 3)
        .map(answer)
      const options = shuffle([answer(word), ...distractors])
      return {
        prompt:
          direction === "es-nasa"
            ? "¿Cómo se dice en Nasa Yuwe?"
            : "¿Qué significa en español?",
        title: ask,
        options,
        correctIndex: options.indexOf(answer(word)),
      }
    })
}

function mapProvided(
  provided: NonNullable<FlashcardGameProps["questions"]>,
  direction: Direction
): FlashcardQuestion[] {
  if ("prompt" in provided[0]!) {
    // Ya vienen armadas (lecciones): se respetan tal cual
    return (provided as FlashcardQuestion[]).map((q) => ({ ...q }))
  }
  const legacy = provided as Array<{
    word: DemoWord
    options: string[]
    correctIndex: number
  }>
  if (direction === "es-nasa") {
    return legacy.map((q) => ({
      prompt: "¿Cómo se dice en Nasa Yuwe?",
      title: q.word.spanish,
      options: q.options,
      correctIndex: q.correctIndex,
    }))
  }
  // Inversa: se pregunta el Nasa Yuwe y se elige en español
  const pool = legacy.map((q) => q.word.spanish)
  return legacy.map((q) => {
    const distractors = shuffle(pool.filter((s) => s !== q.word.spanish)).slice(0, 3)
    const options = shuffle([q.word.spanish, ...distractors])
    return {
      prompt: "¿Qué significa en español?",
      title: q.options[q.correctIndex] ?? q.word.nasaYuwe,
      options,
      correctIndex: options.indexOf(q.word.spanish),
    }
  })
}

interface FlashcardGameProps {
  questions?: Array<
    | {
        word: DemoWord
        options: string[]
        correctIndex: number
      }
    | {
        prompt: string
        title: string
        options: string[]
        correctIndex: number
      }
  >
  direction?: Direction
  onFinish?: (result: { correct: number; total: number }) => void
}

export function FlashcardGame({
  questions: providedQuestions,
  direction: initialDirection = "es-nasa",
  onFinish,
}: FlashcardGameProps = {}) {
  const [direction, setDirection] = useState<Direction>(initialDirection)
  const [roundKey, setRoundKey] = useState(0)
  const [remoteWords, setRemoteWords] = useState<GameWord[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const { playCorrect, playWrong, playWin } = useGameFeedback()

  // Palabras reales (con fallback a demo si falla la red)
  useEffect(() => {
    if (providedQuestions?.length) return
    let alive = true
    gameWordsOrDemo(12).then((words) => {
      if (!alive) return
      if (words.length < MIN_FLASH_WORDS) setLoadFailed(true)
      else setRemoteWords(words)
    })
    return () => {
      alive = false
    }
  }, [providedQuestions, retryKey])

  // Preguntas: precalculadas del server o generadas (dirección + ronda)
  const questionList = useMemo<FlashcardQuestion[] | null>(() => {
    if (providedQuestions?.length) return mapProvided(providedQuestions, direction)
    if (!remoteWords) return null
    return buildQuestions(remoteWords, direction)
    // roundKey fuerza reconstruir al reiniciar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providedQuestions, remoteWords, direction, roundKey])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [finished, setFinished] = useState(false)
  const [reported, setReported] = useState(false)

  // Fase 2.5 — motion GSAP. Un momento hero por juego: transición de
  // pregunta (slide + fade); micros: pulso del badge al subir de tier de
  // racha y countUp del resultado final. Los flash-correct/wrong son
  // keyframes CSS del juice kit y quedan como están.
  const prevTierRef = useRef(0)

  // Hero: la pregunta entra deslizando al cambiar (o al montar/reiniciar).
  const motionRoot = useGsapGame((api) => {
    slideReveal(api.gsap, api.root.querySelector("[data-question]"))
  }, [currentIndex, direction, roundKey])

  // Micro: pulso del badge solo cuando SUBE el tier de la racha (1 → 2);
  // bajar (streak 0) o mantener no re-anima nada.
  const streakRoot = useGsapGame((api) => {
    const tier = streakTier(streak)
    if (tier > prevTierRef.current) {
      streakTierPulse(api.gsap, api.root.querySelector("[data-streak-badge]"))
    }
    prevTierRef.current = tier
  }, [streak])

  // Resultado final: countUp del puntaje (350ms).
  const resultRoot = useGsapGame((api) => {
    if (!finished) return
    countUp(
      api.gsap,
      api.root.querySelector<HTMLElement>("[data-countup]"),
      correctCount
    )
    // correctCount es el valor final cuando `finished` pasa a true
  }, [finished])

  const total = questionList?.length ?? 0
  const current = questionList?.[currentIndex]

  // Persiste el resultado al terminar (backend si hay sesión, local siempre)
  useEffect(() => {
    if (!finished || reported || total === 0) return
    setReported(true)
    onFinish?.({ correct: correctCount, total })
    if (correctCount >= total * 0.5) playWin()
    void reportGameResult({
      game: "flashcards",
      won: correctCount >= total * 0.5,
      score: correctCount * 10,
      streak: bestStreak,
    })
  }, [finished, reported, total, correctCount, bestStreak, onFinish, playWin])

  function handleRestart() {
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setFinished(false)
    setReported(false)
    setRoundKey((k) => k + 1)
  }

  function handleRetry() {
    setRemoteWords(null)
    setLoadFailed(false)
    setRetryKey((k) => k + 1)
  }

  function handleAnswer(optionIndex: number) {
    if (selectedAnswer !== null || !current) return
    setSelectedAnswer(optionIndex)

    if (optionIndex === current.correctIndex) {
      playCorrect()
      setCorrectCount((c) => c + 1)
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        return next
      })
    } else {
      playWrong()
      setStreak(0)
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= total) {
      setFinished(true)
    } else {
      setCurrentIndex((i) => i + 1)
      setSelectedAnswer(null)
    }
  }

  function handleDirectionChange(next: Direction) {
    if (next === direction) return
    setDirection(next)
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setFinished(false)
    setReported(false)
  }

  if (loadFailed) {
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

  if (!questionList || !current) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" aria-busy="true" aria-label="Cargando juego">
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
        <p className="text-center text-sm text-muted-foreground">Cargando palabras...</p>
      </div>
    )
  }

  if (finished) {
    const won = correctCount >= total * 0.5
    return (
      <div ref={resultRoot} className="relative max-w-2xl mx-auto">
        {won && <Confetti />}
      <Card>
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-secondary" />
          <h3 className="text-2xl font-serif text-foreground">¡Completado!</h3>
          <p className="text-muted-foreground">
            Acertaste{" "}
            <strong data-countup className="text-tertiary">{correctCount}</strong> de{" "}
            <strong>{total}</strong> palabras
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
          <Button onClick={handleRestart} variant="outline" className="gap-2 mt-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
            <RefreshCw className="h-4 w-4" />
            Jugar de nuevo
          </Button>
        </CardContent>
      </Card>
      </div>
    )
  }

  return (
    <div ref={motionRoot} className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-center gap-2" role="group" aria-label="Dirección del juego">
        <Button
          variant={direction === "es-nasa" ? "default" : "outline"}
          size="sm"
          onClick={() => handleDirectionChange("es-nasa")}
          className="gap-1.5 min-h-11 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          Español → Nasa Yuwe
        </Button>
        <Button
          variant={direction === "nasa-es" ? "default" : "outline"}
          size="sm"
          onClick={() => handleDirectionChange("nasa-es")}
          className="gap-1.5 min-h-11 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          Nasa Yuwe → Español
        </Button>
      </div>
      <div ref={streakRoot} className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-montana">
            Pregunta {currentIndex + 1} de {total}
          </span>
          <div className="flex items-center gap-3">
            {/* Columna reservada: el badge alterna visible/invisible sin
                colapsar el layout (regla reserve-then-fill). */}
            <span
              data-testid="flash-streak-slot"
              className="inline-flex min-h-7 min-w-24 items-center justify-end"
            >
              <Badge
                variant="secondary"
                data-streak-badge
                aria-hidden={streak < 2}
                className={`gap-1 border border-amarillo/60 bg-amarillo/20 text-montana ${
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
          value={((currentIndex + 1) / total) * 100}
          className="h-2 game-progress bg-surface-container-high [&_[data-slot=progress-indicator]]:bg-secondary"
          aria-label={`Progreso: pregunta ${currentIndex + 1} de ${total}`}
        />
      </div>

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent data-question className="pt-8 pb-6 flex flex-col items-center gap-6">
          <p className="text-sm text-muted-foreground">{current.prompt}</p>
          <h2 className="text-4xl font-serif font-bold text-primary text-center">
            {current.title}
          </h2>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {current.options.map((option, idx) => {
          const isSelected = selectedAnswer === idx
          const isCorrect = idx === current.correctIndex
          const showResult = selectedAnswer !== null

          return (
            <Button
              key={idx}
              variant="outline"
              size="lg"
              disabled={showResult}
              onClick={() => handleAnswer(idx)}
              data-testid="flash-option"
              className={`h-auto min-h-11 py-5 text-lg font-medium transition-all game-press focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
                showResult
                  ? isCorrect
                    ? "border-secondary bg-secondary-container text-montana anim-flash-correct"
                    : isSelected && !isCorrect
                      ? "border-destructive bg-destructive/10 text-destructive anim-flash-wrong"
                      : "opacity-50"
                  : "hover:border-primary hover:bg-primary/5"
              }`}
            >
              <span className="flex items-center gap-2">
                {showResult && isCorrect && (
                  <CheckCircle2 className="h-5 w-5 text-montana" />
                )}
                {showResult && isSelected && !isCorrect && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                {option}
              </span>
            </Button>
          )
        })}
      </div>

      {/* Contenedor siempre montado con altura reservada (min-h del
          botón): visible/invisible en vez de montar/desmontar, para que
          responder no mueva el documento (regla reserve-then-fill). */}
      <div
        data-testid="flash-next"
        aria-hidden={selectedAnswer === null}
        className="flex min-h-10 justify-center"
      >
        <Button
          onClick={handleNext}
          disabled={selectedAnswer === null}
          tabIndex={selectedAnswer === null ? -1 : 0}
          inert={selectedAnswer === null}
          className={`game-press gap-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
            selectedAnswer === null ? "invisible" : "visible"
          }`}
        >
          {currentIndex + 1 >= total ? "Ver resultados" : "Siguiente"}
        </Button>
      </div>
    </div>
  )
}