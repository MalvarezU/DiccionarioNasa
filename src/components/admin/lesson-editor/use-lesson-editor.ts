"use client"

import { useCallback, useMemo, useState } from "react"
import {
  createBlock,
  newBlockId,
  parseLessonContent,
  type BlockType,
  type LessonBlock,
} from "@/lib/courses/blocks"

/**
 * Estado del editor de contenido de una lección.
 *
 * Es deliberadamente tonto (sin efectos, sin fetch): forma y mutaciones de un
 * documento. Eso lo hace testable sin DOM pesado y deja la red en los
 * componentes que saben de red (pickers, guardado).
 *
 * La validación usa el MISMO parseLessonContent del servidor: si el editor
 * permite guardar algo, es porque la API lo va a aceptar. Un solo contrato.
 */

export type LessonEditorApi = {
  title: string
  setTitle: (t: string) => void
  blocks: LessonBlock[]

  /** Reemplaza un bloque entero (los formularios computan el nuevo). */
  setBlock: (id: string, block: LessonBlock) => void
  addBlock: (type: BlockType) => void
  removeBlock: (id: string) => void
  /** -1 = arriba, 1 = abajo; en los extremos es un no-op. */
  moveBlock: (id: string, dir: -1 | 1) => void

  /** Documento listo para guardar, o null si es inválido. */
  documento: { version: number; blocks: LessonBlock[] } | null
  /** Errores del documento completo. */
  errores: string[]
  /** Errores por id de bloque, para marcar cada tarjeta. */
  erroresPorBloque: Record<string, string[]>
  /** false si ningún bloque valida. */
  valido: boolean

  dirty: boolean
  markSaved: () => void
}

export function useLessonEditor(
  initial: { title?: string; blocks?: LessonBlock[] } = {}
): LessonEditorApi {
  const [title, setTitle] = useState(initial.title ?? "")
  const [blocks, setBlocks] = useState<LessonBlock[]>(initial.blocks ?? [])
  const [dirty, setDirty] = useState(false)
  const [saveToken, setSaveToken] = useState(0)

  const marcarCambio = useCallback(() => setDirty(true), [])

  const setBlock = useCallback(
    (id: string, block: LessonBlock) => {
      setBlocks((prev) => prev.map((b) => (b.id === id ? block : b)))
      marcarCambio()
    },
    [marcarCambio]
  )

  const addBlock = useCallback(
    (type: BlockType) => {
      setBlocks((prev) => [...prev, createBlock(type)])
      marcarCambio()
    },
    [marcarCambio]
  )

  const removeBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== id))
      marcarCambio()
    },
    [marcarCambio]
  )

  const moveBlock = useCallback(
    (id: string, dir: -1 | 1) => {
      setBlocks((prev) => {
        const i = prev.findIndex((b) => b.id === id)
        const destino = i + dir
        if (i === -1 || destino < 0 || destino >= prev.length) return prev
        const next = [...prev]
        const [bloque] = next.splice(i, 1)
        next.splice(destino, 0, bloque!)
        return next
      })
      marcarCambio()
    },
    [marcarCambio]
  )

  const markSaved = useCallback(() => {
    setDirty(false)
    setSaveToken((t) => t + 1)
  }, [])

  const parseado = useMemo(
    () => parseLessonContent({ version: 1, blocks }),
    // saveToken evita memoizar resultados viejos tras guardar
    [blocks, saveToken]
  )

  const erroresPorBloque = useMemo(() => {
    // Se calcula SIEMPRE, incluso con el documento inválido: es exactamente
    // cuando el editor más necesita marcar qué tarjeta está mal. Antes hacía
    // un return temprano si `parseado` fallaba y los errores por bloque
    // desaparecían justo cuando hacían falta.
    const out: Record<string, string[]> = {}
    for (const bloque of blocks) {
      const solo = parseLessonContent({ version: 1, blocks: [bloque] })
      if (!solo.ok) out[bloque.id] = solo.errors
    }
    return out
  }, [blocks])

  return {
    title,
    setTitle: (t: string) => {
      setTitle(t)
      marcarCambio()
    },
    blocks,
    setBlock,
    addBlock,
    removeBlock,
    moveBlock,
    documento: parseado.ok ? parseado.content : null,
    errores: parseado.ok ? [] : parseado.errors,
    erroresPorBloque,
    valido: parseado.ok,
    dirty,
    markSaved,
  }
}

/** Re-exportado para los tests del hook. */
export { newBlockId }
