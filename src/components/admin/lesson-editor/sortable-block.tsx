"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { LessonBlock } from "@/lib/courses/blocks"

/**
 * Wrapper sortable para cada bloque del editor. Expone `attributes`,
 * `listeners` y `setNodeRef` para el contenedor; el handle de drag va
 * aparte (icono GripVertical) para no bloquear los inputs.
 */
export function SortableBlock({
  id,
  children,
}: {
  id: string
  children: (props: {
    setNodeRef: (node: HTMLElement | null) => void
    style: React.CSSProperties
    attributes: React.HTMLAttributes<HTMLElement>
    listeners: Record<string, unknown> | undefined
    isDragging: boolean
  }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return <>{children({ setNodeRef, style, attributes, listeners, isDragging })}</>
}

