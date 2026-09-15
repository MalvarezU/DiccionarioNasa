"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Volume2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FlashcardGame } from "@/components/juegos/flashcard-game"
import { CompleteWordGame } from "@/components/juegos/complete-word-game"
import {
  buildFlashcardQuestions,
  gameWordsOrDemo,
  type GameWord,
} from "@/lib/game-words"

export interface RealLesson {
  id: string
  title: string
  type: "READ" | "QUIZ" | "COMPLETE"
  /** Numeración visible "1.1, 1.2…" — persistida en BD (estable al reordenar). */
  lessonNumber: number | null
  wordId: string | null
  payload: string | null
  word: {
    id: string
    spanish: string
    nasaYuwe: string
    pronunciation: string | null
    audioUrl: string | null
    culturalContext: string | null
    category: string | null
  } | null
}

interface LessonRendererProps {
  lesson: RealLesson
  isComplete: boolean
  onComplete: (lessonId: string) => void
}

function CompleteButton({
  done,
  onClick,
  children,
}: {
  done: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      onClick={onClick}
      disabled={done}
      variant={done ? "secondary" : "default"}
      className="w-full gap-2"
    >
      {done ? (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Lección completada
        </>
      ) : (
        children
      )}
    </Button>
  )
}

function ReadLesson({ lesson, isComplete, onComplete }: LessonRendererProps) {
  const word = lesson.word
  return (
    <Card className="bg-muted/20">
      <CardContent className="pt-4 pb-4 space-y-3">
        <p className="text-sm font-medium text-foreground">{lesson.title}</p>
        {word ? (
          <div className="p-3 rounded-lg bg-background border border-outline-variant/20 space-y-2">
            <p className="font-serif text-xl text-primary">{word.nasaYuwe}</p>
            <p className="text-sm text-foreground">{word.spanish}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {word.pronunciation && (
                <span className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />[{word.pronunciation}]
                </span>
              )}
              {word.category && (
                <Badge variant="outline" className="text-[10px]">
                  {word.category}
                </Badge>
              )}
            </div>
            {word.audioUrl && (
              <audio controls src={word.audioUrl} className="w-full h-8" aria-label={`Audio de ${word.spanish}`} />
            )}
            {word.culturalContext && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {word.culturalContext}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Esta lección aún no tiene palabra asignada.
          </p>
        )}
        <CompleteButton done={isComplete} onClick={() => onComplete(lesson.id)}>
          Marcar como completada
        </CompleteButton>
      </CardContent>
    </Card>
  )
}

function parseQuizWords(payload: string | null): string[] {
  if (!payload) return []
  try {
    const parsed = JSON.parse(payload) as { questions?: Array<{ wordSpanish?: string }> }
    if (!Array.isArray(parsed.questions)) return []
    return parsed.questions
      .map((q) => (typeof q?.wordSpanish === "string" ? q.wordSpanish.trim() : ""))
      .filter(Boolean)
  } catch {
    return []
  }
}

function QuizLesson({ lesson, isComplete, onComplete }: LessonRendererProps) {
  const wanted = useMemo(() => parseQuizWords(lesson.payload), [lesson.payload])
  const [words, setWords] = useState<GameWord[] | null>(null)

  useEffect(() => {
    let alive = true
    gameWordsOrDemo(24).then((pool) => {
      if (!alive) return
      const bySpanish = new Map(pool.map((w) => [w.spanish.toLowerCase(), w]))
      const matched = wanted
        .map((s) => bySpanish.get(s.toLowerCase()))
        .filter((w): w is GameWord => !!w)
      setWords(matched.length > 0 ? matched : pool.slice(0, 4))
    })
    return () => {
      alive = false
    }
  }, [wanted])

  if (!words) {
    return (
      <Card className="bg-muted/20">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground">Cargando quiz...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <FlashcardGame
        questions={buildFlashcardQuestions(words, words.length >= 4 ? words : [...words, ...words, ...words, ...words])}
        onFinish={({ correct, total }) => {
          if (total > 0 && correct / total >= 0.5) onComplete(lesson.id)
        }}
      />
      {isComplete && (
        <p className="flex items-center gap-2 text-sm text-secondary">
          <CheckCircle2 className="h-4 w-4" />
          Lección completada
        </p>
      )}
    </div>
  )
}

function CompleteLesson({ lesson, isComplete, onComplete }: LessonRendererProps) {
  const [words, setWords] = useState<GameWord[] | null>(null)

  useEffect(() => {
    let alive = true
    gameWordsOrDemo(24).then((pool) => {
      if (!alive) return
      if (lesson.word) {
        setWords([
          {
            id: lesson.word.id,
            spanish: lesson.word.spanish,
            nasaYuwe: lesson.word.nasaYuwe,
            pronunciation: lesson.word.pronunciation,
          },
        ])
      } else {
        setWords(pool.slice(0, 4))
      }
    })
    return () => {
      alive = false
    }
  }, [lesson.word])

  if (!words) {
    return (
      <Card className="bg-muted/20">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground">Cargando ejercicio...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <CompleteWordGame
        words={words}
        onFinish={({ correct, total }) => {
          if (total > 0 && correct / total >= 0.5) onComplete(lesson.id)
        }}
      />
      {isComplete && (
        <p className="flex items-center gap-2 text-sm text-secondary">
          <CheckCircle2 className="h-4 w-4" />
          Lección completada
        </p>
      )}
    </div>
  )
}

export function LessonRenderer(props: LessonRendererProps) {
  if (props.lesson.type === "QUIZ") return <QuizLesson {...props} />
  if (props.lesson.type === "COMPLETE") return <CompleteLesson {...props} />
  return <ReadLesson {...props} />
}
