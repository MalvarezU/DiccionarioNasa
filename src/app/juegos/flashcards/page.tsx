import { Brain } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { DemoBadge } from "@/components/demo-badge"
import { FlashcardGame } from "@/components/juegos/flashcard-game"

export default function FlashcardsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold text-primary">
            Flashcards
          </h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground mb-8">
          Elige la traducción correcta. ¡Acumula tu racha de aciertos!
        </p>
        <FlashcardGame />
      </main>
    </div>
  )
}