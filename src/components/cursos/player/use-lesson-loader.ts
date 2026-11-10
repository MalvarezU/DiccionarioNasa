"use client"

import { useCallback, useEffect, useRef } from "react"
import type { CourseWordData } from "@/lib/courses/word-data"

export interface LessonNav {
  prevId: string | null
  prevTitle: string | null
  prevNumber: number | null
  nextId: string | null
  nextTitle: string | null
  nextNumber: number | null
  moduleTitle: string
  moduleIndex: number
}

export interface LoadedLesson {
  lesson: {
    id: string
    title: string
    lessonNumber: number | null
    content: unknown
    moduleId: string
  }
  words: CourseWordData[]
  nav: LessonNav
}

export interface LessonLoader {
  /** Lección desde cache o red. Deduplica fetches concurrentes del mismo id. */
  load: (lessonId: string) => Promise<LoadedLesson>
  /** Calienta la cache; no-op si ya está o va en vuelo; nunca rechaza. */
  prefetch: (lessonId: string | null | undefined) => void
  /** Lectura sincrónica (para pintar sin flash cuando ya está en cache). */
  getCached: (lessonId: string) => LoadedLesson | undefined
}

async function fetchLesson(courseId: string, lessonId: string): Promise<LoadedLesson> {
  const res = await fetch(
    `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`
  )
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Lección no encontrada" : "No se pudo cargar la lección")
  }
  const body = (await res.json()) as {
    lesson: LoadedLesson["lesson"]
    words?: CourseWordData[]
    nav: LessonNav
  }
  return { lesson: body.lesson, words: body.words ?? [], nav: body.nav }
}

/**
 * Cache de lecciones on-demand del player.
 *
 * Una sola promesa en vuelo por lessonId: `load()` concurrente reuse la
 * misma (dedupe) y `prefetch()` comparte el vuelo sin exponer el error —
 * la promesa guardada rechaza igual para `load()`, pero el prefetch ya le
 * colgó su propio handler, así que el fallo se traga en silencio y el
 * `load()` posterior reintenta (el vuelo fallido se limpia del mapa).
 */
export function useLessonLoader(courseId: string): LessonLoader {
  const cacheRef = useRef(new Map<string, LoadedLesson>())
  const inflightRef = useRef(new Map<string, Promise<LoadedLesson>>())
  const courseRef = useRef(courseId)

  // Cambio de curso: la cache vieja no sirve; los vuelos viejos terminan
  // pero no se guardan (el guard de courseId los descarta).
  useEffect(() => {
    if (courseRef.current !== courseId) {
      courseRef.current = courseId
      cacheRef.current.clear()
      inflightRef.current.clear()
    }
  }, [courseId])

  const startFetch = useCallback(
    (lessonId: string): Promise<LoadedLesson> => {
      const startedFor = courseRef.current
      const p = fetchLesson(startedFor, lessonId)
      inflightRef.current.set(lessonId, p)
      p.then(
        (loaded) => {
          inflightRef.current.delete(lessonId)
          if (courseRef.current === startedFor) cacheRef.current.set(lessonId, loaded)
        },
        () => {
          inflightRef.current.delete(lessonId)
        }
      )
      return p
    },
    []
  )

  const load = useCallback(
    (lessonId: string): Promise<LoadedLesson> => {
      const cached = cacheRef.current.get(lessonId)
      if (cached) return Promise.resolve(cached)
      return inflightRef.current.get(lessonId) ?? startFetch(lessonId)
    },
    [startFetch]
  )

  const prefetch = useCallback(
    (lessonId: string | null | undefined): void => {
      if (!lessonId) return
      if (cacheRef.current.has(lessonId) || inflightRef.current.has(lessonId)) return
      // El error lo observa el handler interno de startFetch (limpieza);
      // acá se traga a propósito: prefetch nunca rechaza.
      startFetch(lessonId).catch(() => {})
    },
    [startFetch]
  )

  const getCached = useCallback((lessonId: string): LoadedLesson | undefined => {
    return cacheRef.current.get(lessonId)
  }, [])

  return { load, prefetch, getCached }
}
