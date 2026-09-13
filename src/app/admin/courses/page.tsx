"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { NavBar } from "@/components/navbar"
import { CourseManager } from "@/components/admin/course-manager"

export default function AdminCoursesPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Volver al panel
              </Button>
            </Link>
            <h1 className="text-2xl font-serif font-bold text-primary">
              Gestión de cursos
            </h1>
          </div>

          <CourseManager canDelete={userRole === "admin"} />

          <Separator className="my-8" />

          <p className="text-xs text-muted-foreground">
            Los cursos publicados aparecen en /cursos. Las lecciones referencian
            palabras del diccionario por su nombre en español (sin duplicar).
          </p>

          <footer className="mt-6 border-t bg-muted/20">
            <div className="py-4">
              <p className="text-xs text-muted-foreground">
                Panel de administración — Piiyaak
              </p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
