"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
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
  stampIn,
  countUp,
} from "@/lib/game-motion"

const NUM_QUESTIONS = 5
// Rango de huecos por nivel (CA-51): fácil 1-2, medio 3-4, difícil 5+
const HUECOS_POR_NIVEL: Record<string, { min: number; max: number }> = {
  facil: { min: 1, max: 2 },
  medio: { min: 3, max: 4 },
  dificil: { min: 5, max: 7 },
}

type Nivel = "facil" | "medio" | "dificil"

interface CompleteQuestion {
  word: GameWord
  hiddenIndices: number[]
  display: (string | null)[]
}

function buildQuestion(word: GameWord, nivel: Nivel): CompleteQuestion {
  const text = word.spanish.toLowerCase()
  const { min, max } = HUECOS_POR_NIVEL[nivel]
  const target = Math.min(
    Math.max(1, text.length - 1),
    min + Math.floor(Math.random() * (max - min + 1))
  )
  const indices: number[] = []
  while (indices.length < target) {
    const idx = Math.floor(Math.random() * text.length)
    if (!indices.includes(idx)) indices.push(idx)
  }
  indices.sort((a, b) => a - b)
  const display = text.split("").map((char, i) =>
    indices.includes(i) ? null : char
  )
  return { word, hiddenIndices: indices, display }
}

export function CompleteWordGame({
  nivel = "medio",
  words: providedWords,
  onFinish,
}: {
  nivel?: Nivel
  words?: GameWord[]
  onFinish?: (result: { correct: number; total: number }) => void
}) {
  const [nivelState, setNivelState] = useState<Nivel>(nivel)
  const [roundKey, setRoundKey] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [pool, setPool] = useState<GameWord[] | null>(
    providedWords && providedWords.length >= 1 ? providedWords : null
  )

  useEffect(() => {
    if (providedWords && providedWords.length >= 1) return
    let alive = true
    gameWordsOrDemo(10).then((words) => {
      if (alive) setPool(words)
    })
    return () => {
      alive = false
    }
  }, [providedWords, retryKey])

  const questions = useMemo(() => {
    if (!pool) return null
    return shuffle(pool)
      .slice(0, NUM_QUESTIONS)
      .map((word) => buildQuestion(word, nivelState))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, nivelState, roundKey])

  const [questionIndex, setQuestionIndex] = useState(0)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [attempts, setAttempts] = useState(0)
  const [status, setStatus] = useState<"playing" | "correct" | "wrong" | "failed">(
    "playing"
  )
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [reported, setReported] = useState(false)
  const { playCorrect, playWrong, playWin } = useGameFeedback()
  const rowRef = useRef<HTMLDivElement>(null)

  // Fase 2.5 — motion GSAP. Hero del juego: selo "¡correcto!" (stamp) que
  // cae en su lugar al acertar; micros: entrada suave de la palabra nueva y
  // countUp del resultado final. El shake de error es
  // `anim-complete-wrong` (keyframe del juice kit CSS), queda intacto; el
  // foco automático y el avance por acierto tampoco se tocan.
  const prevStatusRef = useRef<string>("playing")

  // Entrada suave de la palabra (cuando cambia de pregunta / nivel / ronda).
  const wordRoot = useGsapGame((api) => {
    slideReveal(api.gsap, api.root.querySelector("[data-word-q]"))
  }, [questionIndex, nivelState, roundKey])

  // Stamp solo en la transición playing → correct (el re-render de la fila
  // de estado no re-anima).
  const stampRoot = useGsapGame((api) => {
    if (status === "correct" && prevStatusRef.current !== "correct") {
      stampIn(api.gsap, api.root.querySelector("[data-stamp]"))
    }
    prevStatusRef.current = status
  }, [status])

  // Resultado final: countUp de la cifra de aciertos.
  const resultRoot = useGsapGame((api) => {
    if (!finished) return
    countUp(
      api.gsap,
      api.root.querySelector<HTMLElement>("[data-countup]"),
      correctCount
    )
  }, [finished])

  function focusHueco(idx: number) {
    rowRef.current
      ?.querySelector<HTMLInputElement>(`input[data-hueco="${idx}"]`)
      ?.focus({ preventScroll: true })
  }

  function handleInputChange(huecoIdx: number, value: string) {
    if (status !== "playing") return
    // Solo permitir 1 carácter
    const char = value.slice(-1).toLowerCase()
    if (char && !/[a-záéíóúñü']/i.test(char)) return
    const current = questions?.[questionIndex]
    const next = { ...inputs, [huecoIdx]: char }
    setInputs(next)
    // Mover el foco al siguiente hueco vacío (progreso sin fricción)
    const order = current?.hiddenIndices ?? []
    const after = order
      .slice(order.indexOf(huecoIdx) + 1)
      .find((i) => !next[i])
    if (char && after !== undefined) {
      window.setTimeout(() => focusHueco(after), 0)
    }
  }

  function handleCheck() {
    const current = questions?.[questionIndex]
    if (!current) return
    const text = current.word.spanish.toLowerCase()
    let allCorrect = true
    for (const idx of current.hiddenIndices) {
      if ((inputs[idx] || "").toLowerCase() !== text[idx]) {
        allCorrect = false
        break
      }
    }

    if (allCorrect) {
      playCorrect()
      setStatus("correct")
      setCorrectCount((c) => c + 1)
    } else {
      playWrong()
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
    if (!questions || questionIndex + 1 >= questions.length) {
      setFinished(true)
    } else {
      setQuestionIndex((i) => i + 1)
      setInputs({})
      setAttempts(0)
      setStatus("playing")
    }
  }

  function handleRestart() {
    setQuestionIndex(0)
    setInputs({})
    setAttempts(0)
    setStatus("playing")
    setCorrectCount(0)
    setFinished(false)
    setReported(false)
    setRoundKey((k) => k + 1)
  }

  function handleRetry() {
    setPool(null)
    setRetryKey((k) => k + 1)
  }

  // Avance automático tras el acierto (el botón Siguiente queda como fallback manual)
  useEffect(() => {
    if (status !== "correct") return
    const t = window.setTimeout(() => {
      handleNext()
    }, 1200)
    return () => window.clearTimeout(t)
  }, [status, questionIndex])

  // Foco en el primer hueco de cada palabra nueva
  useEffect(() => {
    if (status !== "playing" || finished) return
    const first = questions?.[questionIndex]?.hiddenIndices[0]
    if (first === undefined) return
    const t = window.setTimeout(() => focusHueco(first), 0)
    return () => window.clearTimeout(t)
  }, [questionIndex, finished, questions])

  // Persiste el resultado al terminar
  useEffect(() => {
    if (!finished || reported || !questions || questions.length === 0) return
    setReported(true)
    onFinish?.({ correct: correctCount, total: questions.length })
    if (correctCount >= questions.length * 0.5) playWin()
    void reportGameResult({
      game: "complete",
      won: correctCount >= questions.length * 0.5,
      score: correctCount * 10,
      streak: 0,
    })
  }, [finished, reported, questions, correctCount, onFinish, playWin])

  if (pool && pool.length === 0) {
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

  if (!questions) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" aria-busy="true" aria-label="Cargando juego">
        <Skeleton className="h-32 rounded-xl" />
        <p className="text-center text-sm text-muted-foreground">Cargando palabras...</p>
      </div>
    )
  }

  if (finished) {
    const won = correctCount >= questions.length * 0.5
    return (
      <div ref={resultRoot} className="relative max-w-2xl mx-auto">
        {won && <Confetti />}
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-secondary" />
            <h3 className="text-2xl font-serif text-foreground">¡Completado!</h3>
            <p className="text-muted-foreground">
              Completaste{" "}
              <strong data-countup className="text-tertiary">{correctCount}</strong> de{" "}
              <strong>{questions.length}</strong> palabras
            </p>
            <Button onClick={handleRestart} variant="outline" className="game-press gap-2 mt-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
              <RefreshCw className="h-4 w-4" />
              Jugar de nuevo
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const current = questions[questionIndex]
  const maxAttempts = 3

  return (
    <div ref={wordRoot} className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-montana">
            Palabra {questionIndex + 1} de {questions.length}
          </span>
          <div className="flex gap-3" role="group" aria-label="Dificultad">
            {(
              [
                { value: "facil", label: "Fácil" },
                { value: "medio", label: "Medio" },
                { value: "dificil", label: "Difícil" },
              ] as Array<{ value: Nivel; label: string }>
            ).map((n) => (
              <Button
                key={n.value}
                variant={nivelState === n.value ? "default" : "outline"}
                size="sm"
                aria-pressed={nivelState === n.value}
                className="min-h-11 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                onClick={() => {
                  if (n.value === nivelState) return
                  setNivelState(n.value)
                  setQuestionIndex(0)
                  setInputs({})
                  setAttempts(0)
                  setStatus("playing")
                  setCorrectCount(0)
                  setFinished(false)
                  setReported(false)
                }}
              >
                {n.label}
              </Button>
            ))}
          </div>
        </div>
        <Progress
          value={((questionIndex + 1) / questions.length) * 100}
          className="h-2 game-progress bg-surface-container-high [&_[data-slot=progress-indicator]]:bg-secondary"
        />
      </div>

      <Card
        className={`border-2 transition-colors ${
          status === "correct"
            ? "border-secondary bg-secondary-container"
            : status === "wrong"
              ? "border-destructive bg-destructive/10 anim-complete-wrong"
              : status === "failed"
                ? "border-muted-foreground bg-muted/20"
                : "border-primary/20"
        }`}
      >
        <CardContent data-word-q className="pt-8 pb-6 flex flex-col items-center gap-6">
          <p className="text-sm text-muted-foreground">
            Escribe las letras que faltan:
          </p>
          <div
            ref={rowRef}
            className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
            data-testid="letter-row"
          >
            {current.display.map((char, idx) => {
              if (char === null) {
                const isCorrect =
                  status === "correct" ||
                  (status === "failed" &&
                    (inputs[idx] || "").toLowerCase() ===
                      current.word.spanish.toLowerCase()[idx])
                const isWrong = status === "wrong" || (status === "failed" && !isCorrect)
                return (
                  <Input
                    key={idx}
                    data-hueco={idx}
                    value={inputs[idx] || ""}
                    onChange={(e) => handleInputChange(idx, e.target.value)}
                    disabled={status === "correct" || status === "failed"}
                    maxLength={1}
                    aria-label={`Letra ${idx + 1} de ${current.word.spanish.length}`}
                    aria-invalid={isWrong}
                    className={`w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold uppercase p-0 focus-visible:border-secondary focus-visible:ring-secondary/40 ${
                      status === "correct"
                        ? "border-secondary text-montana"
                        : status === "wrong"
                          ? "border-destructive text-destructive"
                          : status === "failed"
                            ? isCorrect
                              ? "border-secondary text-montana"
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

      {/* Fila de acción con altura reservada (min-h del botón): los
          cuatro estados (verificar/sello/error/fallo) comparten el mismo
          alto y nunca desmontan la fila, solo su contenido visible
          (regla reserve-then-fill). Los intentos (pills) siempre montados. */}
      <div ref={stampRoot} data-testid="complete-action" className="flex min-h-10 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="sr-only">Intentos fallidos: {attempts} de {maxAttempts}</span>
          <span role="img" aria-label={`${maxAttempts - attempts} intentos restantes de ${maxAttempts}`} className="flex items-center gap-2">
          {Array.from({ length: maxAttempts }).map((_, i) => (
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
            Intentos: {attempts}/{maxAttempts}
          </span>
        </div>

        {status === "playing" && (
          <Button onClick={handleCheck} className="game-press gap-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
            Verificar
          </Button>
        )}
        {status === "correct" && (
          <div data-stamp className="flex items-center gap-2 text-montana" role="status">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">¡Correcto!</span>
            <Button onClick={handleNext} variant="outline" className="game-press gap-2 ml-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
              Siguiente
            </Button>
          </div>
        )}
        {status === "wrong" && (
          <div className="flex items-center gap-2 text-destructive" role="alert">
            <XCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">Incorrecto, inténtalo de nuevo</span>
          </div>
        )}
        {status === "failed" && (
          <div className="flex items-center gap-3" role="status">
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5" />
              <span>
                La respuesta era{" "}
                <strong className="text-foreground">
                  {current.word.spanish}
                </strong>
              </span>
            </div>
            <Button onClick={handleNext} variant="outline" className="game-press gap-2">
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}