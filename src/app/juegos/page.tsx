import Link from "next/link"
import { Gamepad2, Brain, Type, ArrowRight } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { DemoBadge } from "@/components/demo-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const JUEGOS = [
  {
    href: "/juegos/flashcards",
    icon: Brain,
    title: "Flashcards",
    description:
      "Se muestra una palabra y eliges la traducción correcta entre 4 opciones. ¡Racha de aciertos!",
    color: "from-primary to-primary-container",
  },
  {
    href: "/juegos/memoria",
    icon: Gamepad2,
    title: "Memoria",
    description:
      "Voltea las cartas y encuentra las parejas entre palabras en español y Nasa Yuwe.",
    color: "from-secondary to-secondary-container",
  },
  {
    href: "/juegos/completar",
    icon: Type,
    title: "Completar palabra",
    description:
      "Escribe las letras que faltan para completar la palabra. ¡Tienes 3 intentos!",
    color: "from-tertiary to-tertiary-container",
  },
] as const

export default function JuegosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">
                Juegos Didácticos
              </h1>
              <DemoBadge />
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Aprende vocabulario Nasa Yuwe jugando. Elige un juego y empieza a practicar.
            </p>
          </div>
        </div>

        {/* Cards de juegos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {JUEGOS.map((juego) => {
            const Icon = juego.icon
            return (
              <Card
                key={juego.href}
                className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <Link href={juego.href}>
                  <CardHeader className="pb-3">
                    <div
                      className={`flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${juego.color} mb-3`}
                    >
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-xl font-serif">
                      {juego.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {juego.description}
                    </p>
                    <Button
                      variant="ghost"
                      className="mt-4 gap-1.5 px-0 text-primary hover:text-primary/80 hover:bg-transparent group-hover:gap-2.5 transition-all"
                    >
                      Jugar ahora
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Link>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}