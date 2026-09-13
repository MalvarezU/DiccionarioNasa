import Link from "next/link"
import { WifiOff, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/60">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-serif font-bold">Sin conexión</h1>
      <p className="text-muted-foreground max-w-md">
        Piiyaak necesita internet para esta sección. Tus palabras favoritas
        descargadas siguen disponibles.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/">
          <Button className="gap-2">
            <BookOpen className="h-4 w-4" />
            Reintentar inicio
          </Button>
        </Link>
      </div>
    </div>
  )
}
