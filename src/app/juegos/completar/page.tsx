import { Type } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { DemoBadge } from "@/components/demo-badge"
import { CompleteWordGame } from "@/components/juegos/complete-word-game"

export default function CompletarPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-2">
          <Type className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold text-primary">
            Completar la palabra
          </h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground mb-8">
          Escribe las letras que faltan. Tienes 3 intentos por palabra.
        </p>
        <CompleteWordGame nivel="medio" />
      </main>
    </div>
  )
}