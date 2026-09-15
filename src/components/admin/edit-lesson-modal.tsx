"use client"

import { useEffect, useRef, useState } from "react"
import { Pencil, ArrowUp, ArrowDown, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface LessonForEdit {
  id: string
  moduleId: string
  moduleTitle: string
  moduleIndex: number
  title: string
  type: "READ" | "QUIZ" | "COMPLETE"
  lessonNumber: number | null
  wordSpanish: string
}

interface EditLessonModalProps {
  lesson: LessonForEdit | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onMove: (lessonId: string, moduleId: string, dir: -1 | 1) => Promise<void>
}

const TYPE_LABEL: Record<LessonForEdit["type"], string> = {
  READ: "Lectura",
  QUIZ: "Quiz",
  COMPLETE: "Ejercicio",
}

export function EditLessonModal({
  lesson,
  open,
  onOpenChange,
  onSaved,
  onMove,
}: EditLessonModalProps) {
  const [title, setTitle] = useState("")
  const [wordSpanish, setWordSpanish] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [movingDir, setMovingDir] = useState<-1 | 1 | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Ref sincrónica: el estado tarda un render en actualizarse y el doble
  // click llega antes (ambos verían isSaving === false).
  const busyRef = useRef(false)

  // Pre-rellenar al abrir/cambiar de lección
  useEffect(() => {
    if (open && lesson) {
      setTitle(lesson.title)
      setWordSpanish(lesson.wordSpanish)
      setSubmitError(null)
    }
  }, [open, lesson])

  if (!lesson) return null

  const displayNumber =
    lesson.lessonNumber !== null ? `${lesson.moduleIndex}.${lesson.lessonNumber}` : "s/n"

  async function handleSave() {
    if (busyRef.current) return
    if (!title.trim()) {
      setSubmitError("El título es obligatorio")
      return
    }
    busyRef.current = true
    setIsSaving(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/lessons/${lesson!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          wordSpanish: wordSpanish.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSubmitError(data?.message || "Error al guardar")
        return
      }
      onSaved()
      onOpenChange(false)
    } catch {
      setSubmitError("Error de conexión al servidor")
    } finally {
      busyRef.current = false
      setIsSaving(false)
    }
  }

  async function handleMove(dir: -1 | 1) {
    if (busyRef.current) return
    busyRef.current = true
    setMovingDir(dir)
    setSubmitError(null)
    try {
      await onMove(lesson!.id, lesson!.moduleId, dir)
    } catch {
      setSubmitError("Error al mover")
    } finally {
      busyRef.current = false
      setMovingDir(null)
    }
  }

  const busy = isSaving || movingDir !== null

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Editar lección
            <Badge variant="outline" className="text-[10px]">
              {displayNumber}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {lesson.moduleTitle} · Tipo {TYPE_LABEL[lesson.type]} (no editable)
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-lesson-title">Título</Label>
            <Input
              id="edit-lesson-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-lesson-word">Palabra asociada (español)</Label>
            <Input
              id="edit-lesson-word"
              value={wordSpanish}
              onChange={(e) => setWordSpanish(e.target.value)}
              placeholder="Vacío para desasociar"
              disabled={busy}
            />
          </div>
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-1.5"
              disabled={busy}
              onClick={() => void handleMove(-1)}
              aria-label="Subir lección"
            >
              {movingDir === -1 ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
              Subir
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-1.5"
              disabled={busy}
              onClick={() => void handleMove(1)}
              aria-label="Bajar lección"
            >
              {movingDir === 1 ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              Bajar
            </Button>
          </div>
          <Button
            type="button"
            className="w-full gap-2"
            disabled={busy || !title.trim()}
            onClick={() => void handleSave()}
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
