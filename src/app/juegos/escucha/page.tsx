import { Headphones } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { EscuchaGame } from "@/components/juegos/escucha-game"
import { SoundToggle } from "@/components/juegos/sound-toggle"

export default function EscuchaPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main id="contenido" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Juegos", href: "/juegos" },
            { label: "Escucha" },
          ]}
        />
        <div className="flex items-center gap-2 mb-2">
          <Headphones className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold text-primary">
            Escucha
          </h1>
          <div className="ml-auto">
            <SoundToggle />
          </div>
        </div>
        <p className="text-muted-foreground mb-8">
          Escucha el audio en Nasa Yuwe y elige su significado en español.
          Tienes 8 rondas.
        </p>
        <EscuchaGame />
      </main>
      <SiteFooter />
    </div>
  )
}
