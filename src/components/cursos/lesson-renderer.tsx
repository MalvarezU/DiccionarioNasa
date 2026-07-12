"use client"

import { useState } from "react"
import { CheckCircle2, Volume2, HelpCircle, Star } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { DemoLesson } from "@/lib/demo-content"

interface LessonRendererProps {
  lesson: DemoLesson
  isComplete: boolean
  onComplete: () => void
}

export function LessonRenderer({
  lesson,
  isComplete,
  onComplete,
}: LessonRendererProps) {
  if (lesson.type === "ficha") {
    return (
      <Card className="bg-muted/20">
        <CardContent className="pt-4 pb-4 space-y-3">
          <p className="text-sm text-muted-foreground">{lesson.description}</p>
          <div className="space-y-2">
            {lesson.content.words?.map((word) => (
              <div
                key={word.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg bg-background border border-outline-variant/20"
              >
                <div>
                  <p className="font-serif text-lg text-primary">
                    {word.nasaYuwe}
                  </p>
                  <p className="text-sm text-foreground">{word.spanish}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {word.pronunciation && (
                    <span className="flex items-center gap-1">
                      <Volume2 className="h-3 w-3" />
                      [{word.pronunciation}]
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {word.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={onComplete}
            disabled={isComplete}
            variant={isComplete ? "secondary" : "default"}
            className="w-full gap-2"
          >
            {isComplete ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Lección completada
              </>
            ) : (
              "Marcar como completada"
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Quiz
  return <QuizRenderer lesson={lesson} isComplete={isComplete} onComplete={onComplete} />
}

function QuizRenderer({
  lesson,
  isComplete,
  onComplete,
}: LessonRendererProps) {
  const questions = lesson.content.questions || []
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)

  const allAnswered = questions.every((_, idx) => answers[idx] !== undefined)
  const correctCount = questions.filter(
    (q, idx) => answers[idx] === q.correctIndex
  ).length

  function handleSelect(qIdx: number, optionIdx: number) {
    if (showResults) return
    setAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }))
  }

  function handleCheck() {
    setShowResults(true)
  }

  return (
    <Card className="bg-muted/20">
      <CardContent className="pt-4 pb-4 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <p className="text-sm text-muted-foreground">{lesson.description}</p>
        </div>

        {questions.map((q, qIdx) => (
          <div key={qIdx} className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {qIdx + 1}. {q.question}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {q.options.map((opt, oIdx) => {
                const isSelected = answers[qIdx] === oIdx
                const isCorrect = oIdx === q.correctIndex
                const showResult = showResults

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelect(qIdx, oIdx)}
                    disabled={showResults}
                    className={`p-2.5 rounded-lg border text-sm text-left transition-all ${
                      showResult
                        ? isCorrect
                          ? "border-secondary bg-secondary/10 text-secondary"
                          : isSelected && !isCorrect
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-outline-variant/20 opacity-50"
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "border-outline-variant/20 hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    {opt}
                    {showResult && isCorrect && (
                      <CheckCircle2 className="inline h-4 w-4 ml-2 text-secondary" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {showResults && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/5 border border-secondary/20">
            <Star className="h-5 w-5 text-secondary" />
            <p className="text-sm text-secondary">
              {correctCount} de {questions.length} correctas
            </p>
          </div>
        )}

        {!showResults ? (
          <Button
            onClick={handleCheck}
            disabled={!allAnswered}
            className="w-full"
          >
            Verificar respuestas
          </Button>
        ) : correctCount === questions.length ? (
          <Button
            onClick={onComplete}
            disabled={isComplete}
            variant={isComplete ? "secondary" : "default"}
            className="w-full gap-2"
          >
            {isComplete ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Lección completada
              </>
            ) : (
              "Completar lección"
            )}
          </Button>
        ) : (
          <Button
            onClick={() => {
              setAnswers({})
              setShowResults(false)
            }}
            variant="outline"
            className="w-full"
          >
            Intentar de nuevo
          </Button>
        )}
      </CardContent>
    </Card>
  )
}