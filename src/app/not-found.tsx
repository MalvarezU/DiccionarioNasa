import Link from "next/link"
import { Compass, BookOpen, Gamepad2, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"

/**
 * 404 — recurso no encontrado (App Router).
 * Tono del proyecto, serif en título, CTAs a las secciones reales.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main id="contenido" className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/60">
          <Compass className="h-8 w-8 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="text-2xl font-serif font-bold">Recurso no encontrado</h1>
        <p className="text-muted-foreground max-w-md">
          El enlace pudo vencer o la página se movió. Prueba con las secciones
          de la plataforma.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          <Button asChild className="gap-2">
            <Link href="/diccionario">
              <BookOpen className="h-4 w-4" />
              Volver al diccionario
            </Link>
          </Button>
          <Link
            href="/juegos"
            className="link-underline-terracota inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-1 py-2 text-sm font-medium text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <Gamepad2 className="h-4 w-4" aria-hidden="true" />
            Juegos
          </Link>
          <Link
            href="/cursos"
            className="link-underline-terracota inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-1 py-2 text-sm font-medium text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            Cursos
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
