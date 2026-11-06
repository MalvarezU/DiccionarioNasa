"use client"

import { useCallback, useMemo, useRef, useState, useEffect } from "react"
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
  /** Reemplaza todos los bloques (plantillas). */
  setBlocks: (blocks: LessonBlock[]) => void

  /** Deshace el último cambio de documento (título o bloques). */
  undo: () => void
  /** Rehace un cambio deshecho. */
  redo: () => void
  puedeDeshacer: boolean
  puedeRehacer: boolean
  addBlock: (type: BlockType) => void
  removeBlock: (id: string) => void
  /** -1 = arriba, 1 = abajo; en los extremos es un no-op. */
  moveBlock: (id: string, dir: -1 | 1) => void
  /** Reordena por drag & drop: mueve activeId a la posición de overId. */
  reorder: (activeId: string, overId: string) => void

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
  const [puedeDeshacer, setPuedeDeshacer] = useState(false)
  const [puedeRehacer, setPuedeRehacer] = useState(false)

  const historialRef = useRef<Array<{ title: string; blocks: LessonBlock[] }>>([])
  const punteroRef = useRef(-1)
  const ultimoRef = useRef<string | null>(null)

  // Snapshot del documento en cada cambio (máx. 50 estados).
  // Se descarta la rama "redo" cuando se edita después de deshacer.
  useEffect(() => {
    const snap = JSON.stringify({ title, blocks })
    if (snap === ultimoRef.current) return
    const pila = historialRef.current.slice(0, punteroRef.current + 1)
    pila.push({ title, blocks })
    if (pila.length > 50) pila.shift()
    historialRef.current = pila
    punteroRef.current = pila.length - 1
    ultimoRef.current = snap
    setPuedeDeshacer(punteroRef.current > 0)
    setPuedeRehacer(false)
  }, [title, blocks])

  const marcarCambio = useCallback(() => setDirty(true), [])

  const setBlock = useCallback(
    (id: string, block: LessonBlock) => {
      let cambio = false
      setBlocks((prev) => {
        if (!prev.some((b) => b.id === id)) return prev
        cambio = true
        return prev.map((b) => (b.id === id ? block : b))
      })
      if (cambio) marcarCambio()
    },
    [marcarCambio]
  )

  const setBlocksAll = useCallback(
    (newBlocks: LessonBlock[]) => {
      setBlocks(newBlocks)
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
      let cambio = false
      setBlocks((prev) => {
        const i = prev.findIndex((b) => b.id === id)
        const destino = i + dir
        if (i === -1 || destino < 0 || destino >= prev.length) return prev
        const next = [...prev]
        const [bloque] = next.splice(i, 1)
        next.splice(destino, 0, bloque!)
        cambio = true
        return next
      })
      if (cambio) marcarCambio()
    },
    [marcarCambio]
  )

  const reorder = useCallback(
    (activeId: string, overId: string) => {
      if (activeId === overId) return
      let cambio = false
      setBlocks((prev) => {
        const from = prev.findIndex((b) => b.id === activeId)
        const to = prev.findIndex((b) => b.id === overId)
        if (from === -1 || to === -1) return prev
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved!)
        cambio = true
        return next
      })
      if (cambio) marcarCambio()
    },
    [marcarCambio]
  )

  const markSaved = useCallback(() => {
    setDirty(false)
    setSaveToken((t) => t + 1)
  }, [])

  const undo = useCallback(() => {
    if (punteroRef.current <= 0) return
    punteroRef.current -= 1
    const snap = historialRef.current[punteroRef.current]
    if (!snap) return
    ultimoRef.current = JSON.stringify(snap)
    setTitle(snap.title)
    setBlocks(snap.blocks)
    setDirty(true)
    setPuedeDeshacer(punteroRef.current > 0)
    setPuedeRehacer(punteroRef.current < historialRef.current.length - 1)
  }, [])

  const redo = useCallback(() => {
    if (punteroRef.current >= historialRef.current.length - 1) return
    punteroRef.current += 1
    const snap = historialRef.current[punteroRef.current]
    if (!snap) return
    ultimoRef.current = JSON.stringify(snap)
    setTitle(snap.title)
    setBlocks(snap.blocks)
    setDirty(true)
    setPuedeDeshacer(punteroRef.current > 0)
    setPuedeRehacer(punteroRef.current < historialRef.current.length - 1)
  }, [])

  const parseado = useMemo(
    () => parseLessonContent({ version: 2, blocks }),
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
      const solo = parseLessonContent({ version: 2, blocks: [bloque] })
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
    setBlocks: setBlocksAll,
    addBlock,
    removeBlock,
    moveBlock,
    reorder,
    documento: parseado.ok ? parseado.content : null,
    errores: parseado.ok ? [] : parseado.errors,
    erroresPorBloque,
    valido: parseado.ok,
    dirty,
    markSaved,
    undo,
    redo,
    puedeDeshacer,
    puedeRehacer,
  }
}

/** Re-exportado para los tests del hook. */
export { newBlockId }
