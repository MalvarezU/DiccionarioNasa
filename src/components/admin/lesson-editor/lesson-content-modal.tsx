"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { LessonContent } from "@/lib/courses/blocks"
import { LessonEditor } from "./lesson-editor"

/**
 * Modal del editor de contenido (fase 3). Separado a propósito del
 * EditLessonModal (título/palabra/reordenar): son dos trabajos distintos y
 * no se estorban. El guardado dispara onSaved para refrescar el detalle.
 */
export function LessonContentModal({
  lesson,
  open,
  onOpenChange,
  onSaved,
}: {
  lesson: {
    id: string
    title: string
    moduleTitle: string
    lessonNumber: number | null
    content?: LessonContent | null
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  if (!lesson) return null

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Contenido · {lesson.lessonNumber ? `${lesson.lessonNumber}. ` : ""}
            {lesson.title}
          </DialogTitle>
          <DialogDescription>
            {lesson.moduleTitle} · armá la lección bloque por bloque. La vista
            previa es exactamente lo que verá el estudiante.
          </DialogDescription>
        </DialogHeader>

        <LessonEditor
          lessonId={lesson.id}
          initialTitle={lesson.title}
          initialBlocks={lesson.content?.blocks ?? []}
          onGuardado={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}
