"use client"

import { useState, useMemo } from "react"
import { Volume2, RefreshCw, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DEMO_WORDS, type DemoWord } from "@/lib/demo-content"

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

interface FlashcardGameProps {
  questions?: {
    word: DemoWord
    options: string[]
    correctIndex: number
  }[]
}

export function FlashcardGame({ questions: providedQuestions }: FlashcardGameProps = {}) {
  // Intenta usar preguntas precalculadas (viene de server) o genera en cliente
  const [questionList] = useState(() => {
    if (providedQuestions?.length) return providedQuestions
    // Genera 8 preguntas en cliente (fallback)
    return shuffle(DEMO_WORDS).slice(0, 8).map((word) => {
      const distractors = shuffle(DEMO_WORDS.filter((w) => w.id !== word.id))
        .slice(0, 3)
        .map((w) => w.nasaYuwe)
      const options = shuffle([word.nasaYuwe, ...distractors])
      return {
        word,
        options,
        correctIndex: options.indexOf(word.nasaYuwe),
      }
    })
  })

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [finished, setFinished] = useState(false)

  const total = questionList.length
  const current = questionList[currentIndex]

  function handleAnswer(optionIndex: number) {
    if (selectedAnswer !== null) return
    setSelectedAnswer(optionIndex)

    if (optionIndex === current.correctIndex) {
      setCorrectCount((c) => c + 1)
      setStreak((s) => s + 1)
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

  function handleRestart() {
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setCorrectCount(0)
    setStreak(0)
    setFinished(false)
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
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pregunta {currentIndex + 1} de {total}
          </span>
          <div className="flex items-center gap-3">
            {streak >= 2 && (
              <Badge variant="secondary" className="gap-1 bg-secondary/10 text-secondary">
                🔥 Racha: {streak}
              </Badge>
            )}
            <span className="text-muted-foreground">
              ✓ {correctCount}
            </span>
          </div>
        </div>
        <Progress value={((currentIndex + 1) / total) * 100} className="h-2" />
      </div>

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="pt-8 pb-6 flex flex-col items-center gap-6">
          <p className="text-sm text-muted-foreground">¿Cómo se dice en Nasa Yuwe?</p>
          <h2 className="text-4xl font-serif font-bold text-primary text-center">
            {current.word.spanish}
          </h2>
          {current.word.pronunciation && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Volume2 className="h-4 w-4" />
              <span>[{current.word.pronunciation}]</span>
            </div>
          )}
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