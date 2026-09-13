"use client"

import { useState, useMemo, useEffect } from "react"
import { Volume2, RefreshCw, CheckCircle2, XCircle, Flame, Check, ArrowLeftRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { type DemoWord } from "@/lib/demo-content"
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

type Direction = "es-nasa" | "nasa-es"

interface FlashcardQuestion {
  prompt: string
  title: string
  options: string[]
  correctIndex: number
}

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
  if (direction === "es-nasa") {
    return provided.map((q) => ({
      prompt: "¿Cómo se dice en Nasa Yuwe?",
      title: q.word.spanish,
      options: q.options,
      correctIndex: q.correctIndex,
    }))
  }
  // Inversa: se pregunta el Nasa Yuwe y se elige en español
  const pool = provided.map((q) => q.word.spanish)
  return provided.map((q) => {
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
  questions?: {
    word: DemoWord
    options: string[]
    correctIndex: number
  }[]
  direction?: Direction
}

export function FlashcardGame({
  questions: providedQuestions,
  direction: initialDirection = "es-nasa",
}: FlashcardGameProps = {}) {
  const [direction, setDirection] = useState<Direction>(initialDirection)
  const [roundKey, setRoundKey] = useState(0)
  const [remoteWords, setRemoteWords] = useState<GameWord[] | null>(null)

  // Palabras reales (con fallback a demo si falla la red)
  useEffect(() => {
    if (providedQuestions?.length) return
    let alive = true
    gameWordsOrDemo(12).then((words) => {
      if (alive) setRemoteWords(words)
    })
    return () => {
      alive = false
    }
  }, [providedQuestions])

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

  const total = questionList?.length ?? 0
  const current = questionList?.[currentIndex]

  // Persiste el resultado al terminar (backend si hay sesión, local siempre)
  useEffect(() => {
    if (!finished || reported || total === 0) return
    setReported(true)
    void reportGameResult({
      game: "flashcards",
      won: correctCount >= total * 0.5,
      score: correctCount * 10,
      streak: bestStreak,
    })
  }, [finished, reported, total, correctCount, bestStreak])

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

  function handleAnswer(optionIndex: number) {
    if (selectedAnswer !== null || !current) return
    setSelectedAnswer(optionIndex)

    if (optionIndex === current.correctIndex) {
      setCorrectCount((c) => c + 1)
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        return next
      })
    } else {
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

  if (!questionList || !current) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" aria-busy="true" aria-label="Cargando juego">
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-2 bg-muted rounded" />
        </div>
        <Card className="border-primary/20">
          <CardContent className="pt-8 pb-6 flex flex-col items-center gap-6">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-10 w-56 bg-muted rounded" />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">Cargando palabras...</p>
      </div>
    )
  }

  if (finished) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-secondary" />
          <h3 className="text-2xl font-serif text-foreground">¡Completado!</h3>
          <p className="text-muted-foreground">
            Acertaste <strong className="text-secondary">{correctCount}</strong> de{" "}
            <strong>{total}</strong> palabras
          </p>
          <Badge
            variant="secondary"
            className="gap-1.5 text-sm bg-secondary/10 text-secondary border border-secondary/20"
          >
            {correctCount >= total * 0.8
              ? "¡Excelente!"
              : correctCount >= total * 0.5
                ? "Buen trabajo"
                : "Sigue practicando"}
          </Badge>
          <Button onClick={handleRestart} variant="outline" className="gap-2 mt-2">
            <RefreshCw className="h-4 w-4" />
            Jugar de nuevo
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-center gap-2" role="group" aria-label="Dirección del juego">
        <Button
          variant={direction === "es-nasa" ? "default" : "outline"}
          size="sm"
          onClick={() => handleDirectionChange("es-nasa")}
          className="gap-1.5"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          Español → Nasa Yuwe
        </Button>
        <Button
          variant={direction === "nasa-es" ? "default" : "outline"}
          size="sm"
          onClick={() => handleDirectionChange("nasa-es")}
          className="gap-1.5"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          Nasa Yuwe → Español
        </Button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pregunta {currentIndex + 1} de {total}
          </span>
          <div className="flex items-center gap-3">
            {streak >= 2 && (
              <Badge variant="secondary" className="gap-1 bg-secondary/10 text-secondary">
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                Racha: {streak}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Check className="h-4 w-4" aria-hidden="true" />
              <span aria-label={`${correctCount} aciertos`}>{correctCount}</span>
            </span>
          </div>
        </div>
        <Progress
          value={((currentIndex + 1) / total) * 100}
          className="h-2"
          aria-label={`Progreso: pregunta ${currentIndex + 1} de ${total}`}
        />
      </div>

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="pt-8 pb-6 flex flex-col items-center gap-6">
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
              className={`h-auto py-5 text-lg font-medium transition-all ${
                showResult
                  ? isCorrect
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : isSelected && !isCorrect
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "opacity-50"
                  : "hover:border-primary hover:bg-primary/5"
              }`}
            >
              <span className="flex items-center gap-2">
                {showResult && isCorrect && (
                  <CheckCircle2 className="h-5 w-5 text-secondary" />
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

      {selectedAnswer !== null && (
        <div className="flex justify-center">
          <Button onClick={handleNext} className="gap-2">
            {currentIndex + 1 >= total ? "Ver resultados" : "Siguiente"}
          </Button>
        </div>
      )}
    </div>
  )
}