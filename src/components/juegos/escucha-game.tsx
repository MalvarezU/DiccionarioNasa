"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Flame,
  Check,
  Volume2,
  SkipForward,
  ArrowLeftRight,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  gameWordsWithAudio,
  reportGameResult,
  type GameWord,
} from "@/lib/game-words"
import { shuffle, stringSimilarity } from "@/lib/game-utils"
import { useOfflineAudio } from "@/hooks/use-offline-audio"
import { useGameFeedback } from "./game-feedback"
import { Confetti } from "./confetti"
import {
  useGsapGame,
  slideReveal,
  streakTierPulse,
  countUp,
  streakTier,
} from "@/lib/game-motion"
import { playStreakTier } from "@/lib/game-sound"

const NUM_ROUNDS = 8
const MIN_ESCUCHA_WORDS = 4
const STORE_KEY_BASE = "piiyaak:escucha:v1"
const MODE_STORAGE_KEY = "piiyaak:escucha:mode:v1"

type EscuchaMode = "significado" | "escritura"

function storeKey(mode: EscuchaMode): string {
  return `${STORE_KEY_BASE}:${mode}`
}

interface EscuchaQuestion {
  word: GameWord
  options: string[]
  correctIndex: number
}

interface StoredEscucha {
  ids: string[]
  index: number
  correct: number
  streak: number
  best: number
}

function loadStored(key: string): StoredEscucha | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredEscucha>
    if (
      !Array.isArray(parsed.ids) ||
      parsed.ids.length < MIN_ESCUCHA_WORDS ||
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

/** Similaridad combinada por pronunciación + escritura (parentesco). */
function combinedSimilarity(a: GameWord, b: GameWord): number {
  const simWrite = stringSimilarity(a.nasaYuwe, b.nasaYuwe)
  if (a.pronunciation && b.pronunciation) {
    const simPron = stringSimilarity(a.pronunciation, b.pronunciation)
    return (simPron + simWrite) / 2
  }
  return simWrite
}

/** Opciones según el modo: español (significado) o Nasa Yuwe escrito (escritura). */
function toQuestions(ask: GameWord[], pool: GameWord[], mode: EscuchaMode): EscuchaQuestion[] {
  return ask.map((word) => {
    const answerOf = (w: GameWord) => (mode === "significado" ? w.spanish : w.nasaYuwe)
    const ranked = pool
      .filter((w) => w.id !== word.id)
      .map((w) => ({
        w,
        sim: combinedSimilarity(word, w),
      }))
      .sort((a, b) => b.sim - a.sim)
    // Distractores: los más parecidos, pero SIN repetir la respuesta
    // (una palabra no puede ser idéntica a otra en las opciones).
    const seen = new Set<string>([answerOf(word)])
    const distractorWords: GameWord[] = []
    for (const r of ranked) {
      const a = answerOf(r.w)
      if (seen.has(a)) continue
      seen.add(a)
      distractorWords.push(r.w)
      if (distractorWords.length >= 3) break
    }
    if (distractorWords.length < 3) {
      const rest = shuffle(
        pool.filter((w) => w.id !== word.id && !distractorWords.includes(w) && !seen.has(answerOf(w)))
      )
      for (const w of rest) {
        if (distractorWords.length >= 3) break
        const a = answerOf(w)
        if (seen.has(a)) continue
        seen.add(a)
        distractorWords.push(w)
      }
    }
    const correct = answerOf(word)
    const distractors = distractorWords.map(answerOf)
    const options = shuffle([correct, ...distractors])
    return {
      word,
      options,
      correctIndex: options.indexOf(correct),
    }
  })
}

function buildQuestions(pool: GameWord[], mode: EscuchaMode): EscuchaQuestion[] {
  return toQuestions(shuffle(pool).slice(0, NUM_ROUNDS), pool, mode)
}

export function EscuchaGame({
  words: providedWords,
  onFinish,
}: {
  words?: GameWord[]
  onFinish?: (result: { correct: number; total: number }) => void
} = {}) {
  const [mode, setMode] = useState<EscuchaMode>("significado")
  const [roundKey, setRoundKey] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [pool, setPool] = useState<GameWord[] | null>(
    providedWords && providedWords.length >= 1 ? providedWords : null
  )
  const { playCorrect, playWrong, playWin, streakClass } = useGameFeedback()
  const audioRef = useRef<HTMLAudioElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)

  // Palabras con audio real (sin fallback a demo: la pronunciación
  // nativa no se sintetiza; con <4 el juego cae al error real).
  useEffect(() => {
    if (providedWords && providedWords.length >= 1) return
    let alive = true
    gameWordsWithAudio(12).then((words) => {
      if (alive) setPool(words)
    })
    return () => {
      alive = false
    }
  }, [providedWords, retryKey])

  const eligible = useMemo(
    () => (pool ? pool.filter((w) => w.audioUrl) : null),
    [pool]
  )
  const tooFew = eligible !== null && eligible.length < MIN_ESCUCHA_WORDS

  // Carga el modo guardado en localStorage al montar (sin SSR mismatch).
  const isInitialLoad = useRef(true)
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      try {
        const saved = localStorage.getItem(MODE_STORAGE_KEY)
        if (saved === "escritura" || saved === "significado") {
          if (saved !== mode) setMode(saved)
        }
      } catch {}
    }
  }, [])

  // Cuando el modo cambia: guardar en localStorage y resetear la partida.
  const prevModeRef = useRef(mode)
  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode)
    } catch {}
    if (prevModeRef.current !== mode) {
      const oldKey = storeKey(prevModeRef.current)
      clearStored(oldKey)
      prevModeRef.current = mode
      setQuestions(null)
      setRoundIndex(0)
      setSelected(null)
      setSkipped(false)
      setAudioFailed(false)
      setCorrectCount(0)
      setStreak(0)
      setBestStreak(0)
      setFinished(false)
      setReported(false)
      setResults([])
      setRoundKey((k) => k + 1)
    }
  }, [mode])

  // Ronda inicial: restaurada de sesión o nueva (patrón ordena-game)
  const initial = useMemo(() => {
    if (!eligible || eligible.length < MIN_ESCUCHA_WORDS) return null
    const stored = loadStored(storeKey(mode))
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
            questions: toQuestions(words, eligible, mode),
            index: stored.index,
            correct: Math.min(stored.correct, words.length),
            streak: stored.streak,
            best: stored.best,
          }
        }
      }
    }
    return {
      questions: buildQuestions(eligible, mode),
      index: 0,
      correct: 0,
      streak: 0,
      best: 0,
    }
  }, [eligible, roundKey, mode])

  const [questions, setQuestions] = useState<EscuchaQuestion[] | null>(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [skipped, setSkipped] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [audioFailed, setAudioFailed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [reported, setReported] = useState(false)
  // Acierto por ronda, paralelo a `questions` (para el vocabulario final).
  // La restauración de sesión lo ignora: arranca vacío.
  const [results, setResults] = useState<boolean[]>([])

  const total = questions?.length ?? 0
  const current = questions?.[roundIndex] ?? null
  const answered = selected !== null || skipped

  // Audio de la ronda (caché offline + blob URL vía hook compartido).
  const { audioSrc } = useOfflineAudio(current?.word.audioUrl ?? null)

  // Sincronizar ronda inicial (evita redeclarar `questions`)
  useEffect(() => {
    if (!initial || questions) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: aplica la ronda inicial o restaurada (patrón memory-game)
    setQuestions(initial.questions)
    setRoundIndex(initial.index)
    setCorrectCount(initial.correct)
    setStreak(initial.streak)
    setBestStreak(initial.best)
    setSelected(null)
    setSkipped(false)
    setAudioFailed(false)
    setFinished(false)
    setReported(false)
  }, [initial])

  // Persistir progreso (recargar no pierde la partida)
  useEffect(() => {
    if (!questions || finished) return
    try {
      sessionStorage.setItem(
        storeKey(mode),
        JSON.stringify({
          ids: questions.map((q) => q.word.id),
          index: roundIndex,
          correct: correctCount,
          streak,
          best: bestStreak,
        } satisfies StoredEscucha)
      )
    } catch {
      // almacenamiento bloqueado: el juego sigue
    }
  }, [questions, roundIndex, correctCount, streak, bestStreak, finished, mode])

  // Fase motion: un solo momento hero (entrada de ronda con slide) +
  // pulso del badge al subir de tier + countUp del resultado final.
  const prevTierRef = useRef(0)

  const motionRoot = useGsapGame((api) => {
    slideReveal(api.gsap, api.root.querySelector("[data-question]"))
  }, [roundIndex])

  const streakRoot = useGsapGame((api) => {
    const tier = streakTier(streak)
    if (tier > prevTierRef.current) {
      streakTierPulse(api.gsap, api.root.querySelector("[data-streak-badge]"))
    }
    prevTierRef.current = tier
  }, [streak])

  const resultRoot = useGsapGame((api) => {
    if (!finished) return
    countUp(
      api.gsap,
      api.root.querySelector<HTMLElement>("[data-countup]"),
      correctCount
    )
  }, [finished])

  function focusFeedback() {
    window.setTimeout(
      () => feedbackRef.current?.focus({ preventScroll: true }),
      50
    )
  }

  function handlePlay() {
    const el = audioRef.current
    if (!el || !audioSrc) {
      setAudioFailed(true)
      return
    }
    try {
      const played = el.play() as unknown as Promise<void> | undefined
      if (played && typeof played.catch === "function") {
        played.catch(() => setAudioFailed(true))
      }
    } catch {
      setAudioFailed(true)
    }
  }

  function handleAnswer(optionIndex: number) {
    if (answered || !current) return
    setSelected(optionIndex)
    const hit = optionIndex === current.correctIndex
    setResults((prev) => [...prev, hit])
    if (hit) {
      const nextTier = streakTier(streak + 1)
      if (nextTier > streakTier(streak) && nextTier !== 0) {
        playStreakTier(nextTier)
      }
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
    focusFeedback()
  }

  /** Saltar cuenta como no acertada y avanza (para audios que no cargan). */
  function handleSkip() {
    if (answered || !current) return
    setSkipped(true)
    setResults((prev) => [...prev, false])
    setStreak(0)
    focusFeedback()
  }

  function handleNext() {
    if (!questions || roundIndex + 1 >= questions.length) {
      setFinished(true)
    } else {
      setRoundIndex((i) => i + 1)
      setSelected(null)
      setSkipped(false)
      setAudioFailed(false)
    }
  }

  // El avance es solo manual (Siguiente / Ver resultados):
  // al responder se revela la palabra en la tarjeta y el foco va a Siguiente.
  useEffect(() => {
    if (answered) {
      nextRef.current?.focus({ preventScroll: true })
    }
  }, [answered])

  function clearStored(key: string) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // ignorar
    }
  }

  function handleModeChange(newMode: EscuchaMode) {
    if (newMode === mode) return
    setMode(newMode)
  }

  function handleRestart() {
    clearStored(storeKey(mode))
    setQuestions(null)
    setRoundIndex(0)
    setSelected(null)
    setSkipped(false)
    setAudioFailed(false)
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setFinished(false)
    setReported(false)
    setResults([])
    setRoundKey((k) => k + 1)
  }

  function handleRetry() {
    clearStored(storeKey(mode))
    setQuestions(null)
    setResults([])
    setPool(providedWords && providedWords.length >= 1 ? providedWords : null)
    setRetryKey((k) => k + 1)
  }

  // Persiste el resultado al terminar (backend si hay sesión, local siempre)
  useEffect(() => {
    if (!finished || reported || total === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: reporta una sola vez al terminar (patrón flashcard-game)
    setReported(true)
    clearStored(storeKey(mode))
    onFinish?.({ correct: correctCount, total })
    const won = correctCount >= total * 0.5
    if (won) playWin()
    void reportGameResult({
      game: "escucha",
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
            No hay suficientes audios o falló la conexión. Reinténtalo.
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
          <CardContent className="pt-5 pb-4 flex flex-col items-center gap-3">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-20 w-44 rounded-full" />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Cargando audios...
        </p>
      </div>
    )
  }

  if (finished) {
    const won = correctCount >= total * 0.5
    const ratio = total > 0 ? correctCount / total : 0
    return (
      <div ref={resultRoot} className="relative max-w-2xl mx-auto">
        {won && <Confetti pieces={ratio >= 0.8 ? 60 : 40} />}
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-secondary" />
            <h3 className="text-2xl font-serif text-foreground">¡Completado!</h3>
            <p className="text-muted-foreground">
              Acertaste{" "}
              <strong data-countup className="text-tertiary">{correctCount}</strong>{" "}
              de <strong>{total}</strong> audios
            </p>
            <Badge
              variant="secondary"
              className="gap-1.5 text-sm bg-secondary-container text-montana border border-secondary/30"
            >
              {correctCount >= total * 0.8
                ? "¡Excelente oído!"
                : correctCount >= total * 0.5
                  ? "Buen trabajo"
                  : "Sigue practicando"}
            </Badge>
            {questions && (
              <div className="w-full mt-2">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  Así se escriben las palabras que escuchaste:
                </p>
                <ul className="anim-stagger-children flex flex-col gap-2">
                  {questions.map((q, i) => {
                    const hit = results[i]
                    return (
                      <li
                        key={q.word.id}
                        data-testid="escucha-recap-item"
                        className="flex items-center justify-between gap-3 rounded-lg border border-primary/15 bg-primary/[0.02] px-4 py-2"
                      >
                        <span className="text-sm text-muted-foreground">
                          {q.word.spanish}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-serif font-bold text-foreground">
                            {q.word.nasaYuwe}
                          </span>
                          {q.word.pronunciation && (
                            <span className="text-xs text-muted-foreground">
                              [{q.word.pronunciation}]
                            </span>
                          )}
                          {hit === true && (
                            <CheckCircle2
                              className="h-4 w-4 text-montana"
                              aria-hidden="true"
                            />
                          )}
                          {hit === false && (
                            <XCircle
                              className="h-4 w-4 text-destructive"
                              aria-hidden="true"
                            />
                          )}
                          <span className="sr-only">
                            {hit === true
                              ? "acertada"
                              : hit === false
                                ? "fallada"
                                : "sin jugar"}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
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

  const correctSpanish = current.options[current.correctIndex]!

  return (
    <div ref={motionRoot} className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-center gap-2" role="group" aria-label="Modo de juego">
        <Button
          variant={mode === "significado" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("significado")}
          className="gap-1.5 min-h-11 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          Significado
        </Button>
        <Button
          variant={mode === "escritura" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("escritura")}
          className="gap-1.5 min-h-11 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          Escritura
        </Button>
      </div>
      <div ref={streakRoot} className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-montana">
            Ronda {roundIndex + 1} de {total}
          </span>
          <div className="flex items-center gap-3">
            {/* Columna reservada: el badge alterna visible/invisible sin
                colapsar el layout (regla reserve-then-fill). */}
            <span
              data-testid="escucha-streak-slot"
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
          value={((roundIndex + 1) / total) * 100}
          className="h-2 game-progress bg-surface-container-high [&_[data-slot=progress-indicator]]:bg-secondary"
          aria-label={`Progreso: ronda ${roundIndex + 1} de ${total}`}
        />
      </div>

      <Card key={roundIndex} className="border-primary/20 bg-primary/[0.02]">
        <CardContent data-question className="pt-5 pb-4 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {mode === "significado"
              ? "Escucha el audio en Nasa Yuwe y elige su significado en español."
              : "Escucha el audio en Nasa Yuwe y elige la palabra escrita."}
            {" "}Las opciones suenan parecido: escucha con atención.
          </p>
          {/* Zona de reveal con altura reservada: siempre montada con
              min-h de 3 líneas (palabra text-4xl + pronunciación + español).
              Antes de responder muestra un placeholder callado con la misma
              estructura de 3 filas; al responder se intercambia el contenido
              sin que la tarjeta cambie de altura. */}
          <div
            data-testid="escucha-answer"
            aria-hidden={!answered}
            className="flex min-h-28 w-full flex-col items-center justify-center gap-1 text-center"
          >
            {answered ? (
              <div className="flex flex-col items-center gap-1">
                <p className="font-serif text-4xl font-bold text-foreground">
                  {mode === "significado" ? current.word.nasaYuwe : current.word.spanish}
                </p>
                {current.word.pronunciation ? (
                  <p className="text-sm text-muted-foreground">
                    [{current.word.pronunciation}]
                  </p>
                ) : (
                  <p aria-hidden="true" className="invisible text-sm select-none">
                    ·
                  </p>
                )}
                <p className="text-base text-muted-foreground">
                  {mode === "significado" ? correctSpanish : current.word.nasaYuwe}
                </p>
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="flex flex-col items-center gap-1 select-none"
              >
                <p className="font-serif text-4xl font-bold text-muted-foreground/25">
                  ···
                </p>
                <p className="invisible text-sm">·</p>
                <p className="invisible text-base">·</p>
              </div>
            )}
          </div>
          <audio
            ref={audioRef}
            src={audioSrc ?? undefined}
            preload="auto"
            onError={() => setAudioFailed(true)}
          />
          <Button
            type="button"
            size="lg"
            onClick={handlePlay}
            disabled={!audioSrc}
            aria-label="Reproducir audio en Nasa Yuwe"
            className="game-press h-20 min-w-44 gap-2 rounded-full text-lg focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <Volume2 className="h-6 w-6" aria-hidden="true" />
            Escuchar
          </Button>
          {/* Slot reservado: el aviso de audio vive montado y alterna
              visible/invisible sin colapsar el layout (regla reserve-then-fill). */}
          <div
            data-testid="escucha-audio-slot"
            className="flex min-h-6 items-center justify-center"
          >
            <p
              role="alert"
              aria-hidden={!(audioFailed && !answered)}
              className={`text-sm text-destructive ${
                audioFailed && !answered ? "visible" : "invisible"
              }`}
            >
              El audio no se pudo reproducir. Puedes saltar la palabra.
            </p>
          </div>
        </CardContent>
      </Card>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        role="group"
        aria-label="Opciones en español"
      >
        {current.options.map((option, idx) => {
          const isSelected = selected === idx
          const isCorrect = idx === current.correctIndex
          const showResult = answered

          return (
            <Button
              key={idx}
              variant="outline"
              size="lg"
              disabled={showResult}
              onClick={() => handleAnswer(idx)}
              data-testid="escucha-option"
              className={`h-auto min-h-11 py-3 text-lg font-medium transition-all game-press focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
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

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSkip}
          disabled={answered}
          className="game-press gap-2 text-muted-foreground focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <SkipForward className="h-4 w-4" aria-hidden="true" />
          Saltar palabra
        </Button>

        {/* Slot reservado: Siguiente vive montado (invisible + deshabilitado)
            y se revela al responder (regla reserve-then-fill). */}
        <div
          data-testid="escucha-next"
          aria-hidden={!answered}
          className="flex min-h-10 justify-end"
        >
          <Button
            ref={nextRef}
            onClick={handleNext}
            disabled={!answered}
            tabIndex={answered ? 0 : -1}
            inert={!answered}
            className={`game-press gap-2 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
              answered ? "visible" : "invisible"
            }`}
          >
            {roundIndex + 1 >= total ? "Ver resultados" : "Siguiente"}
          </Button>
        </div>
      </div>

      {/* Revelado de la palabra escrita (acceso para sordos) con altura
          reservada: siempre montado, visible/invisible según estado. */}
      <div
        data-testid="escucha-feedback"
        className="flex min-h-8 items-center justify-center"
      >
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role={answered ? "status" : undefined}
          aria-live={answered ? "polite" : undefined}
          aria-hidden={!answered}
          className={`rounded-lg focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
            answered ? "visible" : "invisible"
          }`}
        >
          {answered && (
            /* Juicio solo: la palabra ya se revela en grande en la tarjeta
               (y el vocabulario completo vuelve en el recap final), así no se
               muestra 3 veces por ronda. */
            <p className={`flex items-center gap-2 font-medium ${selected !== null && selected === current.correctIndex ? "text-montana" : "text-muted-foreground"}`}>
              {selected !== null && selected === current.correctIndex ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <XCircle className="h-5 w-5" aria-hidden="true" />
              )}
              <span>
                {skipped
                  ? "Palabra saltada."
                  : selected === current.correctIndex
                    ? "¡Correcto!"
                    : "Casi: esa no era la opción correcta."}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
