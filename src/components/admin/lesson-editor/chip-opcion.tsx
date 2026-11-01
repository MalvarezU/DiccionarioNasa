"use client"

import { GripVertical, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Una opción de quiz/escucha, presentada como chip editable.
 *
 * El docente escribe el texto, marca la correcta con un click (se pone verde)
 * y la quita con la X. El drag handle permite reordenar (implementación de
 * drag queda en el padre; acá solo se muestra el affordance).
 */
export function ChipOpcion({
  texto,
  correcta,
  onChange,
  onMarcarCorrecta,
  onQuitar,
  onMoverArriba,
  onMoverAbajo,
  puedeSubir,
  puedeBajar,
  disabled,
}: {
  texto: string
  correcta: boolean
  onChange: (texto: string) => void
  onMarcarCorrecta: () => void
  onQuitar: () => void
  onMoverArriba?: () => void
  onMoverAbajo?: () => void
  puedeSubir?: boolean
  puedeBajar?: boolean
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5",
        correcta
          ? "border-secondary bg-secondary/10"
          : "border-outline-variant/30 bg-background"
      )}
    >
      <span
        className="cursor-grab text-muted-foreground"
        aria-hidden="true"
        title="Arrastrá para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <Input
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Opción…"
        className="h-8 flex-1 text-sm"
        disabled={disabled}
        aria-label="Texto de la opción"
      />
      <Button
        type="button"
        size="sm"
        variant={correcta ? "secondary" : "outline"}
        className={cn("h-8 text-xs", correcta && "border-secondary")}
        onClick={onMarcarCorrecta}
        disabled={disabled}
        aria-pressed={correcta}
        title={correcta ? "Opción correcta" : "Marcar como correcta"}
      >
        {correcta ? "Correcta" : "Marcar"}
      </Button>
      {onMoverArriba ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onMoverArriba}
          disabled={disabled || !puedeSubir}
          aria-label="Subir opción"
        >
          ↑
        </Button>
      ) : null}
      {onMoverAbajo ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onMoverAbajo}
          disabled={disabled || !puedeBajar}
          aria-label="Bajar opción"
        >
          ↓
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive"
        onClick={onQuitar}
        disabled={disabled}
        aria-label="Quitar opción"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
