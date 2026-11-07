import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { GameTile, type GameMotif } from "@/components/juegos/game-tile"
import { Reveal } from "@/components/reveal"

const JUEGOS: Array<{
  href: string
  motivo: GameMotif
  title: string
  description: string
  locked: boolean
}> = [
  {
    href: "/juegos/flashcards",
    motivo: "flash",
    title: "Flashcards",
    description:
      "Se muestra una palabra y eliges la traducción correcta entre 4 opciones. ¡Racha de aciertos!",
    locked: false,
  },
  {
    href: "/juegos/memoria",
    motivo: "memory",
    title: "Memoria",
    description:
      "Voltea las cartas y encuentra las parejas entre palabras en español y Nasa Yuwe.",
    locked: false,
  },
  {
    href: "/juegos/completar",
    motivo: "gaps",
    title: "Completar palabra",
    description:
      "Escribe las letras que faltan para completar la palabra. ¡Tienes 3 intentos!",
    locked: false,
  },
]

export default function JuegosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main id="contenido" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Juegos" }]} />
        {/* Hero */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">
                Juegos Didácticos
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Aprende vocabulario Nasa Yuwe jugando. Elige un juego y empieza a practicar.
            </p>
          </div>
        </div>

        {/* Cards de juegos */}
        <Reveal>
          <div className="anim-stagger-children grid grid-cols-1 md:grid-cols-3 gap-6">
            {JUEGOS.map((juego) => (
              <GameTile
                key={juego.href}
                motivo={juego.motivo}
                href={juego.href}
                title={juego.title}
                description={juego.description}
                locked={juego.locked}
              />
            ))}
          </div>
        </Reveal>
      </main>
      <SiteFooter />
    </div>
  )
}
