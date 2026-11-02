"use client"

import { BookOpen } from "lucide-react"

/**
 * F1: cáscara de la sección Palabras. El contenido inline
 * (acciones + lista + empty state) llega en F2.
 */
export default function AdminPalabrasPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-serif font-bold text-primary">
        Gestión de palabras
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Fichas del diccionario: crear, gestionar e importar.
      </p>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          La gestión inline de fichas llega en la siguiente fase.
        </p>
      </div>
    </>
  )
}
