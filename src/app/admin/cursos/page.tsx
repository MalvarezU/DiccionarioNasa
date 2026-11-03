"use client"

import { useSession } from "next-auth/react"
import { CourseManager } from "@/components/admin/course-manager"
import { AdminPageHeader } from "@/components/admin/admin-page-header"

export default function AdminCoursesPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role

  return (
    <>
      <AdminPageHeader title="Gestión de cursos" />
      <CourseManager canDelete={userRole === "admin"} />
      <p className="mt-6 text-xs text-muted-foreground">
        Los cursos publicados aparecen en /cursos. Las lecciones referencian
        palabras del diccionario por su nombre en español (sin duplicar).
      </p>
    </>
  )
}
