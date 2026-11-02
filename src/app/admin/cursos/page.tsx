"use client"

import { useSession } from "next-auth/react"
import { CourseManager } from "@/components/admin/course-manager"

export default function AdminCoursesPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-primary">Gestión de cursos</h1>
      </div>
      <CourseManager canDelete={userRole === "admin"} />
      <p className="mt-6 text-xs text-muted-foreground">
        Los cursos publicados aparecen en /cursos. Las lecciones referencian
        palabras del diccionario por su nombre en español (sin duplicar).
      </p>
    </>
  )
}
