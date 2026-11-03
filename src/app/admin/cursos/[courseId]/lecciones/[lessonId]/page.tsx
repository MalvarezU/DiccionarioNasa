"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Pencil, Redo2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LessonEditor } from "@/components/admin/lesson-editor/lesson-editor"
import { LessonPreview } from "@/components/admin/lesson-editor/lesson-preview"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import type { LessonBlock } from "@/lib/courses/blocks"

type Modo = "edicion" | "vista"

interface LeccionDetalle {
  id: string
  title: string
  lessonNumber: number | null
  content: { version: number; blocks: LessonBlock[] } | null
  moduleId: string
  moduleTitle: string
  courseId: string
  courseTitle: string
  courseStatus: string
  prev: { id: string; title: string } | null
  next: { id: string; title: string } | null
}

/**
 * Editor de lecciones en página propia (ancho de lectura, sin dialogs
 * apilados). La vista previa es un modo in-page que conserva el estado
 * no guardado: el editor nunca se desmonta, solo se oculta.
 */
export default function LessonEditorPage() {
  const params = useParams<{ courseId: string; lessonId: string }>()
  const router = useRouter()
  const lessonId = params.lessonId

  const [leccion, setLeccion] = useState<LeccionDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>("edicion")
  const [blocks, setBlocks] = useState<LessonBlock[]>([])
  const [dirty, setDirty] = useState(false)
  const [pendiente, setPendiente] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const guardarRef = useRef<(() => Promise<void>) | null>(null)
  const dirtyRef = useRef(dirty)
  const editorUndoRef = useRef<(() => void) | null>(null)
  const editorRedoRef = useRef<(() => void) | null>(null)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  useEffect(() => {
    let cancelado = false
    setLeccion(null)
    setError(null)
    setModo("edicion")
    setDirty(false)
    setPendiente(null)
    void (async () => {
      try {
        const res = await fetch(`/api/lessons/${lessonId}`)
        if (!res.ok) {
          if (!cancelado) {
            setError(res.status === 404 ? "Lección no encontrada" : "No se pudo cargar la lección")
          }
          return
        }
        const data = await res.json()
        if (!cancelado) {
          setLeccion(data.lesson)
          setBlocks(data.lesson.content?.blocks ?? [])
        }
      } catch {
        if (!cancelado) setError("Error de red. Intentá de nuevo.")
      }
    })()
    return () => {
      cancelado = true
    }
  }, [lessonId])

  const irA = useCallback(
    (destino: string) => {
      if (dirty) {
        setPendiente(destino)
      } else {
        router.push(destino)
      }
    },
    [dirty, router]
  )

  // Salida por pestaña/cierre/recarga con cambios sin guardar
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  // Esc en modo vista vuelve a edición con foco en el título
  useEffect(() => {
    if (modo !== "vista") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setModo("edicion")
        requestAnimationFrame(() => document.getElementById("lesson-title")?.focus())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [modo])

  // Auto-guardado tras 2s de inactividad (solo si válido y con título).
  useEffect(() => {
    if (!dirty || !blocks.length) return
    const t = setTimeout(async () => {
      if (!dirtyRef.current) return
      const fn = guardarRef.current
      if (!fn) return
      setAutosaveState("saving")
      try {
        await fn()
        setAutosaveState("saved")
        setTimeout(() => setAutosaveState((s) => (s === "saved" ? "idle" : s)), 2000)
      } catch {
        setAutosaveState("error")
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [dirty, blocks, leccion?.title])

  // Undo/Redo global con teclado (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z o Y)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const target = e.target as HTMLElement | null
      // No interferir con inputs de texto nativos del navegador (Tiptap maneja el suyo)
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        editorUndoRef.current?.()
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault()
        editorRedoRef.current?.()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold">{error}</p>
        <Button type="button" variant="outline" onClick={() => irA("/admin/cursos")}>
          <ArrowLeft className="h-4 w-4" />
          Volver a Gestión de cursos
        </Button>
      </div>
    )
  }

  if (!leccion) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true" aria-label="Cargando lección">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
    )
  }

  const numero = leccion.lessonNumber ?? "?"
  const edicion = modo === "edicion"

  return (
    <>
      {/* Header sticky: navegación + modo */}
      <header className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            aria-label="Volver a Gestión de cursos"
            onClick={() => irA("/admin/cursos")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden md:inline">Gestión de cursos</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">
              {numero}. {leccion.title}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {leccion.courseTitle} · {leccion.moduleTitle}
              {autosaveState === "saving" && <span className="ml-2 text-primary">· Guardando…</span>}
              {autosaveState === "saved" && <span className="ml-2 text-secondary">· Guardado ✓</span>}
              {autosaveState === "error" && <span className="ml-2 text-destructive">· Error al guardar</span>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!leccion.prev}
              aria-label={leccion.prev ? `Lección anterior: ${leccion.prev.title}` : "Sin lección anterior"}
              title={leccion.prev ? `Anterior: ${leccion.prev.title}` : "Sin lección anterior"}
              onClick={() => leccion.prev && irA(`/admin/cursos/${leccion.courseId}/lecciones/${leccion.prev.id}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!leccion.next}
              aria-label={leccion.next ? `Lección siguiente: ${leccion.next.title}` : "Sin lección siguiente"}
              title={leccion.next ? `Siguiente: ${leccion.next.title}` : "Sin lección siguiente"}
              onClick={() => leccion.next && irA(`/admin/cursos/${leccion.courseId}/lecciones/${leccion.next.id}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!dirty}
              aria-label="Deshacer último cambio"
              title="Deshacer (Ctrl+Z)"
              onClick={() => editorUndoRef.current?.()}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!dirty}
              aria-label="Rehacer cambio"
              title="Rehacer (Ctrl+Shift+Z)"
              onClick={() => editorRedoRef.current?.()}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={edicion ? "outline" : "secondary"}
              size="sm"
              className="ml-1 gap-1.5"
              onClick={() => {
                setModo(edicion ? "vista" : "edicion")
                if (edicion) return
                requestAnimationFrame(() => document.getElementById("lesson-title")?.focus())
              }}
              aria-pressed={!edicion}
            >
              {edicion ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {edicion ? "Vista previa" : "Volver a edición"}
            </Button>
          </div>
        </div>
      </header>

      {/* Ambas vistas montadas: la inactiva se oculta para no perder el
          estado no guardado del editor al alternar. */}
      <div className="mx-auto max-w-3xl py-6">
        <div hidden={!edicion}>
          <LessonEditor
            key={leccion.id}
            lessonId={leccion.id}
            initialTitle={leccion.title}
            initialBlocks={leccion.content?.blocks ?? []}
            onGuardado={() => {
              setDirty(false)
              setAutosaveState("idle")
            }}
            onBloquesChange={setBlocks}
            onDirtyChange={setDirty}
            ocultarVistaPrevia
            onGuardarRef={(fn) => { guardarRef.current = fn }}
            onUndoRedoRef={(u, r) => { editorUndoRef.current = u; editorRedoRef.current = r }}
          />
        </div>
        <div hidden={edicion}>
          <p className="mb-4 text-xs text-muted-foreground">
            Exactamente lo que verá el estudiante. Los quiz y la escucha son
            jugables; completarlos no guarda progreso (es solo vista previa).
          </p>
          <LessonPreview blocks={blocks} interactive />
        </div>
      </div>

      {/* Guard de navegación con cambios sin guardar */}
      <ConfirmDialog
        open={pendiente !== null}
        onOpenChange={(v) => {
          if (!v) setPendiente(null)
        }}
        onConfirm={() => {
          if (pendiente) router.push(pendiente)
          setPendiente(null)
        }}
        titulo="¿Salir sin guardar?"
        descripcion="Tenés cambios sin guardar en esta lección. Se perderán."
        accionLabel="Descartar"
        cancelarLabel="Seguir editando"
      />
    </>
  )
}
