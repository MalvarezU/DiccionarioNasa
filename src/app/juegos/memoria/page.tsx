import Link from "next/link"
import { ArrowLeft, Gamepad2, Lock } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { DemoBadge } from "@/components/demo-badge"
import { Button } from "@/components/ui/button"

export default function MemoriaPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-2">
          <Gamepad2 className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold text-primary">
            Memoria
          </h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground mb-8">
          Voltea las cartas y encuentra las parejas entre español y Nasa Yuwe.
        </p>
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted/60">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-serif text-muted-foreground">
            Próximamente
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            El juego de memoria estará disponible pronto. Mientras tanto, prueba
            los otros juegos didácticos.
          </p>
          <Link href="/juegos">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a juegos
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}