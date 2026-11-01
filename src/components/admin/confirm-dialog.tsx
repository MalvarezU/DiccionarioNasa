"use client"

import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

/**
 * Modal de confirmación para acciones destructivas. Reemplaza los `window.confirm`
 * nativos para que el look & feel sea el del design system (focus trap, Esc,
 * botón rojo, spinner opcional).
 *
 * El `processing` deshabilita ambos botones mientras corre la acción, evitando
 * el doble click.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  titulo,
  descripcion,
  accionLabel = "Eliminar",
  cancelarLabel = "Cancelar",
  processing = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  titulo: string
  descripcion?: string
  accionLabel?: string
  cancelarLabel?: string
  processing?: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !processing && onOpenChange(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descripcion ? <AlertDialogDescription>{descripcion}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={processing}>{cancelarLabel}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={processing}
              onClick={() => void onConfirm()}
              className="gap-1.5"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {accionLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
