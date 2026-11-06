"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { LessonNeighbor, PlayerCourse } from "./types"

function toSet(completedIds: Set<string> | readonly string[]): Set<string> {
  return completedIds instanceof Set ? completedIds : new Set(completedIds)
}

/** Orden lineal de lecciones con su módulo (la navegación cruza módulos). */
export function flattenLessons(course: PlayerCourse): {
  moduleIndex: number
  lesson: PlayerCourse["modules"][number]["lessons"][number]
}[] {
  const flat: ReturnType<typeof flattenLessons> = []
  course.modules.forEach((mod, moduleIndex) => {
    for (const lesson of mod.lessons) flat.push({ moduleIndex, lesson })
  })
  return flat
}

/**
 * Desbloqueo secuencial: el módulo 0 siempre abre; los demás exigen el
 * anterior completo. Sin `sequential`, todo está abierto.
 */
export function isModuleUnlocked(
  course: PlayerCourse,
  moduleIndex: number,
  completed: Set<string> | readonly string[]
): boolean {
  if (!course.sequential || moduleIndex === 0) return true
  const prev = course.modules[moduleIndex - 1]
  if (!prev || prev.lessons.length === 0) return false
  const done = toSet(completed)
  return prev.lessons.every((l) => done.has(l.id))
}

export function canAccessLesson(
  course: PlayerCourse,
  moduleIndex: number,
  completed: Set<string> | readonly string[]
): boolean {
  return isModuleUnlocked(course, moduleIndex, completed)
}

/**
 * Primera incompleta del módulo N-1: destino del CTA "Ir a la lección
 * requerida" cuando se abre una lección bloqueada. null si no hay a dónde ir.
 */
export function requiredLessonFor(
  course: PlayerCourse,
  moduleIndex: number,
  completed: Set<string> | readonly string[]
): { id: string; title: string; number: number | null } | null {
  if (moduleIndex <= 0) return null
  const prev = course.modules[moduleIndex - 1]
  if (!prev) return null
  const done = toSet(completed)
  const target =
    prev.lessons.find((l) => !done.has(l.id)) ?? prev.lessons[prev.lessons.length - 1]
  if (!target) return null
  return { id: target.id, title: target.title, number: target.lessonNumber }
}

/** Lee `?leccion=` sin useSearchParams (evita el boundary de Suspense). */
export function readLessonParam(): string | null {
  if (typeof window === "undefined") return null
  const id = new URLSearchParams(window.location.search).get("leccion")
  return id && id.trim() ? id : null
}

function writeLessonParam(id: string | null, mode: "replace" | "push"): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (id) url.searchParams.set("leccion", id)
  else url.searchParams.delete("leccion")
  if (mode === "replace") window.history.replaceState(null, "", url)
  else window.history.pushState(null, "", url)
}

export interface LessonNavigation {
  course: PlayerCourse
  completedIds: Set<string> | readonly string[]
  /** Última visita del GET progress (o localStorage anónimo). */
  lastVisited: string | null
}

export interface LessonNavigationResult {
  activeLessonId: string | null
  selectLesson: (lessonId: string) => void
  prev: LessonNeighbor | null
  next: LessonNeighbor | null
  canAccess: (lessonId: string) => boolean
  requiredLessonFor: (lessonId: string) => {
    id: string
    title: string
    number: number | null
  } | null
}

/**
 * Estado de navegación del player. Resolución inicial:
 * `?leccion=` explícito (aunque esté bloqueada: el canvas la muestra con
 * banner) ‖ lastVisited ‖ primera desbloqueada. Un id inválido/borrado cae
 * en silencio a lastVisited ‖ primera (sin error visible).
 */
export function useLessonNavigation({
  course,
  completedIds,
  lastVisited,
}: LessonNavigation): LessonNavigationResult {
  const done = useMemo(() => toSet(completedIds), [completedIds])
  const flat = useMemo(() => flattenLessons(course), [course])
  const byId = useMemo(() => {
    const map = new Map<string, { moduleIndex: number; index: number }>()
    flat.forEach(({ moduleIndex, lesson }, index) => {
      map.set(lesson.id, { moduleIndex, index })
    })
    return map
  }, [flat])

  const firstUnlockedId = useMemo(() => {
    for (const { moduleIndex, lesson } of flat) {
      if (isModuleUnlocked(course, moduleIndex, done)) return lesson.id
    }
    return flat[0]?.lesson.id ?? null
  }, [course, flat, done])

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [initForCourseId, setInitForCourseId] = useState<string | null>(null)

  // Init una vez por curso: lee la URL en efecto (sin window en render,
  // sin mismatch de hidratación) y normaliza con replaceState (no ensucia
  // el historial). Re-corre si cambia el curso: la página monta el hook con
  // un curso vacío y el dato real llega después del fetch. El setState
  // sincrónico es inicialización diferida, no sincronización derivable.
  useEffect(() => {
    if (initForCourseId === course.id) return
    // Curso aún sin lecciones (fetch en vuelo): no inicializar ni tocar la
    // URL — un replace prematuro borraría un ?leccion= deep-link válido.
    if (flat.length === 0) return
    const param = readLessonParam()
    const next =
      param && byId.has(param)
        ? param
        : lastVisited && byId.has(lastVisited)
          ? lastVisited
          : firstUnlockedId
    // Init diferido: la URL manda una sola vez por curso (guard de arriba).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveLessonId(next)
    setInitForCourseId(course.id)
    writeLessonParam(next, "replace")
  }, [initForCourseId, course, byId, lastVisited, firstUnlockedId])

  // Back/forward del navegador: la URL manda.
  useEffect(() => {
    const onPopState = () => {
      const param = readLessonParam()
      if (param && byId.has(param)) setActiveLessonId(param)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [byId])

  const selectLesson = useCallback((lessonId: string) => {
    setActiveLessonId(lessonId)
    writeLessonParam(lessonId, "push")
  }, [])

  const canAccess = useCallback(
    (lessonId: string): boolean => {
      const found = byId.get(lessonId)
      if (!found) return false
      return isModuleUnlocked(course, found.moduleIndex, done)
    },
    [byId, course, done]
  )

  const requiredFor = useCallback(
    (lessonId: string) => {
      const found = byId.get(lessonId)
      if (!found) return null
      return requiredLessonFor(course, found.moduleIndex, done)
    },
    [byId, course, done]
  )

  const neighbor = useCallback(
    (offset: -1 | 1): LessonNeighbor | null => {
      if (!activeLessonId) return null
      const found = byId.get(activeLessonId)
      if (!found) return null
      const target = flat[found.index + offset]
      if (!target) return null
      return {
        id: target.lesson.id,
        title: target.lesson.title,
        number: target.lesson.lessonNumber,
        moduleIndex: target.moduleIndex + 1,
        locked: !isModuleUnlocked(course, target.moduleIndex, done),
      }
    },
    [activeLessonId, byId, flat, course, done]
  )

  const prev = useMemo(() => neighbor(-1), [neighbor])
  const next = useMemo(() => neighbor(1), [neighbor])

  return { activeLessonId, selectLesson, prev, next, canAccess, requiredLessonFor: requiredFor }
}
