"use client"

import { useRef, useState } from "react"
import { Check, Lock, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlayerCourse } from "./types"
import { isModuleUnlocked } from "./use-lesson-navigation"
import { lessonNumberLabel, moduleLabel } from "./labels"

export interface CourseOutlineProps {
  course: PlayerCourse
  activeLessonId: string | null
  completedIds: Set<string>
  lastVisitedLessonId: string | null
  onSelect: (lessonId: string) => void
  /**
   * El player lo usa para prefetch on-demand (hover/focus calienta la
   * cache de la lección). Opcional: el outline funciona igual sin él.
   */
  onHoverLesson?: (lessonId: string) => void
  /**
   * Sesión activa. false = gate de sesión (H2): para anónimos toda lección
   * del módulo 2+ queda bloqueada además del unlock secuencial (unión).
   * Default true: el modo seguro (sin gate) es lo correcto para previews
   * y reutilizaciones fuera del player.
   */
  isAuthed?: boolean
  /** Abre el AuthModal (vive en page.tsx). Necesario para el gate anónimo. */
  onRequireAuth?: () => void
}

type LessonState = "done" | "current" | "locked" | "todo"

/**
 * Índice del curso: dark anchor slate, siempre expandido, con scroll propio.
 * Un solo tab stop (roving tabindex sobre los botones de lección); los
 * encabezados de módulo son labels estáticos, no focusables.
 */
export function CourseOutline({
  course,
  activeLessonId,
  completedIds,
  lastVisitedLessonId,
  onSelect,
  onHoverLesson,
  isAuthed = true,
  onRequireAuth,
}: CourseOutlineProps) {
  const totalLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0)
  const doneTotal = course.modules.reduce(
    (n, m) => n + m.lessons.filter((l) => completedIds.has(l.id)).length,
    0
  )
  const pct = totalLessons > 0 ? Math.round((doneTotal / totalLessons) * 100) : 0

  // Orden lineal de botones para el roving tabindex.
  const flatIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id))
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>())
  const [focusId, setFocusId] = useState<string | null>(null)
  const roveId = focusId ?? activeLessonId ?? flatIds[0] ?? null

  function focusLesson(id: string): void {
    setFocusId(id)
    buttonRefs.current.get(id)?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    const current = roveId ?? flatIds[0]
    const idx = flatIds.indexOf(current ?? "")
    let target: string | null = null
    if (e.key === "ArrowDown") target = flatIds[Math.min(idx + 1, flatIds.length - 1)] ?? null
    else if (e.key === "ArrowUp") target = flatIds[Math.max(idx - 1, 0)] ?? null
    else if (e.key === "Home") target = flatIds[0] ?? null
    else if (e.key === "End") target = flatIds[flatIds.length - 1] ?? null
    if (target && target !== current) {
      e.preventDefault()
      focusLesson(target)
    }
  }

  // "Continuar donde quedé": solo si hay última visitada, no es la activa
  // y aún no está completada. Derivación barata durante el render, sin memo.
  const showContinue =
    lastVisitedLessonId !== null &&
    lastVisitedLessonId !== activeLessonId &&
    !completedIds.has(lastVisitedLessonId)

  return (
    <nav
      aria-label={`Contenido de ${course.title}`}
      onKeyDown={onKeyDown}
      className="flex max-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden rounded-xl bg-primary text-primary-foreground"
    >
      <div className="shrink-0 border-b border-white/10 px-5 pb-4 pt-5">
        <p className="text-xs uppercase tracking-wide text-primary-foreground/70">
          Índice del curso
        </p>
        <p className="mt-1 font-serif text-lg font-bold leading-tight">{course.title}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="tabular-nums text-primary-foreground/80">
            {doneTotal}/{totalLessons} lecciones
          </span>
          <span className="tabular-nums font-semibold">{pct}%</span>
        </div>
        <div
          aria-hidden="true"
          className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/15"
        >
          <div
            className="h-full rounded-full bg-secondary transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        {showContinue && (
          <button
            type="button"
            onClick={() => onSelect(lastVisitedLessonId)}
            className="mt-3 min-h-[44px] w-full shrink-0 rounded-lg bg-primary-foreground px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-white"
          >
            Continuar donde quedé
          </button>
        )}
      </div>

      <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
        {course.modules.map((module, moduleIdx) => {
          const moduleIndex = moduleIdx + 1
          const seqUnlocked = isModuleUnlocked(course, moduleIdx, completedIds)
          // Cerrojo de sesión (H2): anónimo no accede al módulo 2+, aunque el
          // secuencial lo tenga abierto. Unión: unlocked = secuencial && sesión.
          const sessionLocked = !isAuthed && moduleIndex >= 2
          const unlocked = seqUnlocked && !sessionLocked
          const done = module.lessons.filter((l) => completedIds.has(l.id)).length
          const total = module.lessons.length
          return (
            <li key={module.id}>
              <h3 className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold" title={module.title}>
                  {moduleLabel(moduleIndex, module.title)}
                </span>
                <span className="shrink-0 rounded-full border border-white/20 px-2 py-0.5 text-2xs tabular-nums text-primary-foreground/80">
                  {done}/{total}
                </span>
              </h3>
              {/* Barra fina oliva del módulo (decorativa: el pill lleva el dato). */}
              <div
                aria-hidden="true"
                className="mb-2 mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/15"
              >
                <div
                  className="h-full rounded-full bg-secondary transition-[width]"
                  style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : "0%" }}
                />
              </div>
              {sessionLocked ? (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-primary-foreground/70">
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Iniciá sesión para acceder a partir del módulo 2
                </p>
              ) : !seqUnlocked ? (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-primary-foreground/70">
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Completá el Módulo {moduleIndex - 1} para desbloquear este módulo
                </p>
              ) : null}
              <ol className="space-y-1">
                {module.lessons.map((lesson) => {
                  const isDone = completedIds.has(lesson.id)
                  const isCurrent = lesson.id === activeLessonId
                  const locked = !unlocked
                  const state: LessonState = isDone
                    ? "done"
                    : isCurrent
                      ? "current"
                      : locked
                        ? "locked"
                        : "todo"
                  const number = lessonNumberLabel(moduleIndex, lesson.lessonNumber, lesson.title)
                  const lockHintId = `lock-hint-${lesson.id}`
                  return (
                    <li key={lesson.id}>
                      <button
                        ref={(el) => {
                          if (el) buttonRefs.current.set(lesson.id, el)
                          else buttonRefs.current.delete(lesson.id)
                        }}
                        type="button"
                        tabIndex={roveId === lesson.id ? 0 : -1}
                        onFocus={() => {
                          setFocusId(lesson.id)
                          onHoverLesson?.(lesson.id)
                        }}
                        onMouseEnter={() => onHoverLesson?.(lesson.id)}
                        onClick={() => {
                          // Bloqueada-anónima (módulo 2+): pedir sesión aquí
                          // mismo sin navegar; el deep-link cae en el mismo
                          // estado del canvas. Secuencial (usuario con
                          // sesión): navegación actual con banner de requerida.
                          if (locked && !isAuthed) {
                            onRequireAuth?.()
                            return
                          }
                          onSelect(lesson.id)
                        }}
                        aria-current={isCurrent ? "true" : undefined}
                        aria-disabled={locked ? "true" : undefined}
                        aria-describedby={locked ? lockHintId : undefined}
                        data-lesson-state={state}
                        data-lesson-button=""
                        title={lesson.title}
                        className={cn(
                          "flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                          "focus-oliva",
                          isCurrent
                            ? "bg-primary-foreground font-semibold text-primary"
                            : "text-primary-foreground hover:bg-white/10",
                          locked && !isCurrent && "opacity-70"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "border border-white/25",
                            isDone && !isCurrent && "border-secondary bg-secondary text-white"
                          )}
                        >
                          {isDone ? (
                            <Check
                              key="done"
                              className="h-3.5 w-3.5 anim-check-pop"
                            />
                          ) : locked ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : isCurrent ? (
                            <Play className="h-3.5 w-3.5" />
                          ) : (
                            <span className="font-serif tabular-nums">
                              {lesson.lessonNumber ?? "·"}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {number && (
                            <span className="tabular-nums opacity-70">{number} · </span>
                          )}
                          {lesson.title}
                        </span>
                        {lesson.id === lastVisitedLessonId && !isCurrent && (
                          <span
                            title="Última lección visitada"
                            aria-label="Última lección visitada"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary"
                          />
                        )}
                      </button>
                      {locked && (
                        <span id={lockHintId} className="sr-only">
                          {sessionLocked
                            ? "Sin acceso — iniciá sesión para acceder a partir del módulo 2"
                            : `Sin acceso — completá el Módulo ${moduleIndex - 1} para desbloquear esta lección`}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
