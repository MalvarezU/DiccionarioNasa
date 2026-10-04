"use client"

import { useEffect, useMemo, useState } from "react"
import { LessonContentView } from "@/components/cursos/blocks/lesson-content-view"
import {
  fetchWordsByIds,
  wordIdsUsedByContent,
  type CourseWordData,
} from "@/lib/courses/word-data"
import type { LessonBlock } from "@/lib/courses/blocks"

/**
 * Vista previa del editor: es el MISMO render que el estudiante.
 * Aquí en modo `interactive={false}` (resumen estático de los interactivos).
 *
 * Resuelve las palabras de los bloques (vocabulary/game) contra el lote del
 * diccionario; si el documento no trae palabras, los bloques muestran su
 * estado vacío sin romper.
 */
export function LessonPreview({
  blocks,
  interactive = false,
}: {
  blocks: readonly LessonBlock[]
  interactive?: boolean
}) {
  const ids = useMemo(() => wordIdsUsedByContent(blocks).join(","), [blocks])
  const [words, setWords] = useState<Map<string, CourseWordData>>(() => new Map())

  useEffect(() => {
    let vivo = true
    const lista = ids ? ids.split(",") : []
    if (lista.length === 0) {
      setWords(new Map())
      return
    }
    fetchWordsByIds(lista).then((m) => {
      if (vivo) setWords(m)
    })
    return () => {
      vivo = false
    }
  }, [ids])

  return (
    <LessonContentView
      content={{ version: 1, blocks: [...blocks] }}
      words={words}
      interactive={interactive}
    />
  )
}
