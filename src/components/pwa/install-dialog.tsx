"use client"

import { Check, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type InstallVariant = "android" | "desktop" | "ios"

export const MANUAL_CONTENT: Record<
  InstallVariant,
  { title: string; description: string; steps: string[] }
> = {
  android: {
    title: "Instalar en Android",
    description: "Sigue estos pasos en Chrome de Android.",
    steps: [
      "Abre esta página en Chrome de Android.",
      "Toca ⋮ → “Instalar aplicación”.",
    ],
  },
  desktop: {
    title: "Instalar en tu equipo",
    description: "Chrome o Edge en Windows, Mac o Linux.",
    steps: [
      "Busca el icono de instalación en la barra de direcciones (monitor con flecha).",
      "Confirma la instalación.",
    ],
  },
  ios: {
    title: "Instalar en iPhone / iPad",
    description: "Safari no ofrece botón directo; son 2 toques.",
    steps: [
      "Toca Compartir (el cuadrado con flecha).",
      "Elige “Añadir a pantalla de inicio”.",
    ],
  },
}

interface InstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: InstallVariant
  instalPromptDisponible: boolean
  instalada: boolean
  onInstalar: () => void | Promise<unknown>
}

/**
 * Shared install modal. Every "Instalar" trigger opens this dialog first;
 * the real install action lives on its primary button, so the browser
 * prompt (when available) is always fired from an in-dialog user gesture
 * instead of a bare button.
 */
export function InstallDialog({
  open,
  onOpenChange,
  variant,
  instalPromptDisponible,
  instalada,
  onInstalar,
}: InstallDialogProps) {
  const contenido = MANUAL_CONTENT[variant]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contenido.title}</DialogTitle>
          <DialogDescription>{contenido.description}</DialogDescription>
        </DialogHeader>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          {contenido.steps.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
        <DialogFooter className="sm:justify-stretch">
          {instalada ? (
            <Button disabled className="gap-2 w-full">
              <Check className="h-4 w-4" />
              Ya instalada
            </Button>
          ) : instalPromptDisponible ? (
            <Button className="gap-2 w-full" onClick={() => void onInstalar()}>
              <Download className="h-4 w-4" />
              Instalar ahora
            </Button>
          ) : (
            <Button
              className="gap-2 w-full"
              onClick={() => onOpenChange(false)}
            >
              Entendido
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
