"use client"

import { useState, useMemo } from "react"
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { DEMO_WORDS } from "@/lib/demo-content"

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const NUM_QUESTIONS = 5
const HUECOS_POR_NIVEL: Record<string, number> = {
  facil: 1,
  medio: 2,
  dificil: 3,
}

type Nivel = "facil" | "medio" | "dificil"

interface CompleteQuestion {
  word: typeof DEMO_WORDS[number]
  hiddenIndices: number[]
  display: (string | null)[]
}

function buildQuestion(
  word: typeof DEMO_WORDS[number],
  nivel: Nivel
): CompleteQuestion {
  const text = word.spanish.toLowerCase()
  const numHuecos = HUECOS_POR_NIVEL[nivel]
  const indices: number[] = []
  while (indices.length < numHuecos && indices.length < text.length - 1) {
    const idx = Math.floor(Math.random() * text.length)
    if (!indices.includes(idx)) indices.push(idx)
  }
  indices.sort((a, b) => a - b)
  const display = text.split("").map((char, i) =>
    indices.includes(i) ? null : char
  )
  return { word, hiddenIndices: indices, display }
}

export function CompleteWordGame({ nivel = "medio" }: { nivel?: Nivel }) {
  const [nivelState, setNivelState] = useState<Nivel>(nivel)
  const questions = useMemo(() => {
    return shuffle(DEMO_WORDS)
      .slice(0, NUM_QUESTIONS)
      .map((word) => buildQuestion(word, nivelState))
  }, [nivelState])

  const [questionIndex, setQuestionIndex] = useState(0)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [attempts, setAttempts] = useState(0)
  const [status, setStatus] = useState<"playing" | "correct" | "wrong" | "failed">(
    "playing"
  )
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  function handleInputChange(huecoIdx: number, value: string) {
    if (status !== "playing") return
    // Solo permitir 1 carácter
    const char = value.slice(-1).toLowerCase()
    if (char && !/[a-záéíóúñü']/i.test(char)) return
    setInputs((prev) => ({ ...prev, [huecoIdx]: char }))
  }

  function handleCheck() {
    const current = questions[questionIndex]
    const text = current.word.spanish.toLowerCase()
    let allCorrect = true
    for (const idx of current.hiddenIndices) {
      if ((inputs[idx] || "").toLowerCase() !== text[idx]) {
        allCorrect = false
        break
      }
    }

    if (allCorrect) {
      setStatus("correct")
      setCorrectCount((c) => c + 1)
    } else {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      if (newAttempts >= 3) {
        setStatus("failed")
      } else {
        setStatus("wrong")
        setTimeout(() => setStatus("playing"), 1500)
      }
    }
  }

  function handleNext() {
    if (questionIndex + 1 >= questions.length) {
      setFinished(true)
    } else {
      setQuestionIndex((i) => i + 1)
      setInputs({})
      setAttempts(0)
      setStatus("playing")
    }
  }

  function handleRestart() {
    setNivelState((n) => n)
    setQuestionIndex(0)
    setInputs({})
    setAttempts(0)
    setStatus("playing")
    setCorrectCount(0)
    setFinished(false)
  }

  if (finished) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-secondary" />
          <h3 className="text-2xl font-serif text-foreground">¡Completado!</h3>
          <p className="text-muted-foreground">
            Completaste <strong className="text-secondary">{correctCount}</strong> de{" "}
            <strong>{questions.length}</strong> palabras
          </p>
          <Button onClick={handleRestart} variant="outline" className="gap-2 mt-2">
            <RefreshCw className="h-4 w-4" />
            Jugar de nuevo
          </Button>
        </CardContent>
      </Card>
    )
  }

  const current = questions[questionIndex]
  const maxAttempts = 3

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Palabra {questionIndex + 1} de {questions.length}
          </span>
          <div className="flex gap-3">
            <Badge
              variant="outline"
              className={
                nivelState === "facil"
                  ? "bg-secondary/10 text-secondary border-secondary/30"
                  : "text-muted-foreground"
              }
            >
              Fácil
            </Badge>
            <Badge
              variant="outline"
              className={
                nivelState === "medio"
                  ? "bg-secondary/10 text-secondary border-secondary/30"
                  : "text-muted-foreground"
              }
            >
              Medio
            </Badge>
            <Badge
              variant="outline"
              className={
                nivelState === "dificil"
                  ? "bg-secondary/10 text-secondary border-secondary/30"
                  : "text-muted-foreground"
              }
            >
              Difícil
            </Badge>
          </div>
        </div>
        <Progress
          value={((questionIndex + 1) / questions.length) * 100}
          className="h-2"
        />
      </div>

      <Card
        className={`border-2 transition-colors ${
          status === "correct"
            ? "border-secondary bg-secondary/5"
            : status === "wrong"
              ? "border-destructive bg-destructive/5"
              : status === "failed"
                ? "border-muted-foreground bg-muted/20"
                : "border-primary/20"
        }`}
      >
        <CardContent className="pt-8 pb-6 flex flex-col items-center gap-6">
          <p className="text-sm text-muted-foreground">
            Escribe las letras que faltan:
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {current.display.map((char, idx) => {
              if (char === null) {
                const isCorrect =
                  status === "correct" ||
                  (status === "failed" &&
                    (inputs[idx] || "").toLowerCase() ===
                      current.word.spanish.toLowerCase()[idx])
                return (
                  <Input
                    key={idx}
                    value={inputs[idx] || ""}
                    onChange={(e) => handleInputChange(idx, e.target.value)}
                    disabled={status === "correct" || status === "failed"}
                    maxLength={1}
                    className={`w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold uppercase p-0 ${
                      status === "correct"
                        ? "border-secondary text-secondary"
                        : status === "wrong"
                          ? "border-destructive text-destructive"
                          : status === "failed"
                            ? isCorrect
                              ? "border-secondary text-secondary"
                              : "border-destructive text-destructive line-through"
                            : "border-primary"
                    }`}
                  />
                )
              }
              return (
                <span
                  key={idx}
                  className="w-10 h-14 sm:w-12 sm:h-16 flex items-center justify-center text-2xl font-bold text-foreground uppercase"
                >
                  {char}
                </span>
              )
            })}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Respuesta:</span>
            <span className="font-serif text-lg text-primary">
              {current.word.nasaYuwe}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${
                i < attempts ? "bg-destructive" : "bg-muted-foreground/20"
              }`}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            Intentos: {attempts}/{maxAttempts}
          </span>
        </div>

        {status === "playing" && (
          <Button onClick={handleCheck} className="gap-2">
            Verificar
          </Button>
        )}
        {status === "correct" && (
          <div className="flex items-center gap-2 text-secondary">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">¡Correcto!</span>
            <Button onClick={handleNext} variant="outline" className="gap-2 ml-2">
              Siguiente
            </Button>
          </div>
        )}
        {status === "wrong" && (
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Incorrecto</span>
          </div>
        )}
        {status === "failed" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5" />
              <span>
                La respuesta era{" "}
                <strong className="text-foreground">
                  {current.word.spanish}
                </strong>
              </span>
            </div>
            <Button onClick={handleNext} variant="outline" className="gap-2">
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}