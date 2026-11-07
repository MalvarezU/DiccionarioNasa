import { Brain } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { FlashcardGame } from "@/components/juegos/flashcard-game"
import { SoundToggle } from "@/components/juegos/sound-toggle"

export default function FlashcardsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main id="contenido" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Juegos", href: "/juegos" },
            { label: "Flashcards" },
          ]}
        />
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold text-primary">
            Flashcards
          </h1>
          <div className="ml-auto">
            <SoundToggle />
          </div>
        </div>
        <p className="text-muted-foreground mb-8">
          Elige la traducción correcta. ¡Acumula tu racha de aciertos!
        </p>
        <FlashcardGame />
      </main>
      <SiteFooter />
    </div>
  )
}
