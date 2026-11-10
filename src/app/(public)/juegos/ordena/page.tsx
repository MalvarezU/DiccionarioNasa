import { ArrowDownAZ } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { OrdenaGame } from "@/components/juegos/ordena-game"
import { SoundToggle } from "@/components/juegos/sound-toggle"

export default function OrdenaPage() {
  return (
      <main id="contenido" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Juegos", href: "/juegos" },
            { label: "Ordena la palabra" },
          ]}
        />
        <div className="flex items-center gap-2 mb-2">
          <ArrowDownAZ className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold text-primary">
            Ordena la palabra
          </h1>
          <div className="ml-auto">
            <SoundToggle />
          </div>
        </div>
        <p className="text-muted-foreground mb-8">
          Arma la palabra en Nasa Yuwe ficha por ficha. Tienes 3 intentos por
          palabra.
        </p>
        <OrdenaGame />
      </main>
  )
}
