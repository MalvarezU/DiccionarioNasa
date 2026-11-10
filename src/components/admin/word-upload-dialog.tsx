"use client"

import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface WordUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion?: string
  /** Mientras guarda, el modal no se puede cerrar (ni Esc ni click fuera). */
  saving?: boolean
  children: ReactNode
}

/**
 * Modal de subida individual (ilustración o audio de una ficha).
 * El picker correspondiente va en `children`; este wrapper aporta
 * título, guard contra cierre durante el guardado e indicador de progreso.
 */
export function WordUploadDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  saving = false,
  children,
}: WordUploadDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v)
      }}
    >
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        aria-busy={saving || undefined}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {saving ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Guardando en la ficha…
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
