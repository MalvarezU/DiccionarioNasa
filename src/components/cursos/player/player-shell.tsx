"use client"

import { useState, type ReactNode } from "react"
import { ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export interface PlayerShellProps {
  /** Solo uno presente por vez: loading ‖ error ‖ empty ‖ canvas listo. */
  loading?: ReactNode
  error?: ReactNode
  empty?: ReactNode
  /** Encabezado del curso (título serif, meta, descripción). El % y el
   *  CTA "Continuar donde quedé" viven en el outline, no acá. */
  header?: ReactNode
  outline: ReactNode
  canvas: ReactNode
}

/**
 * Estructura master-detail del player. ≥1280: sidebar 320px sticky +
 * canvas; 1024–1279: sidebar 288px; <1024: el outline vive en un Sheet
 * (side left, 320px) y el canvas lleva botón "Índice del curso" + barra
 * Prev/Next fija (la fija el propio LessonCanvas en su footer).
 */
export function PlayerShell({ loading, error, empty, header, outline, canvas }: PlayerShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  // Cerrar el Sheet al activar una lección dentro de él (los botones del
  // outline llevan data-lesson-button; el canvas ya navega por onSelect).
  function closeOnLessonSelect(e: React.MouseEvent): void {
    if ((e.target as HTMLElement).closest("[data-lesson-button]")) {
      setSheetOpen(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-10">
      {header}

      {loading ? (
        <div aria-busy="true" aria-label="Cargando curso">
          {loading}
        </div>
      ) : error ? (
        <div role="alert">{error}</div>
      ) : empty ? (
        <div>{empty}</div>
      ) : (
        <div className="anim-player-reveal">
          <div className="mb-4 lg:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(true)}
              className="min-h-[44px] gap-2"
            >
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
              Índice del curso
            </Button>
          </div>
          <div className="grid gap-10 lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="hidden lg:block">
              <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)]">
                {outline}
              </div>
            </div>
            <div className="min-h-[max(420px,60dvh)] min-w-0">{canvas}</div>
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent
              side="left"
              className="w-[320px] overflow-y-auto p-0 sm:max-w-[320px]"
              onClickCapture={closeOnLessonSelect}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Índice del curso</SheetTitle>
              </SheetHeader>
              <div className="p-4">{outline}</div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  )
}
