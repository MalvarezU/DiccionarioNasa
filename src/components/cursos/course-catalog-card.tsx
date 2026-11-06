import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { CourseCard, type CourseSummary } from "./course-card"

/**
 * Badge de estado del catálogo — misma lógica del índice anterior, movida
 * acá sin reescribirla: DRAFT/ARCHIVED y sin-contenido en outline,
 * Completado/En curso en secondary. Null = curso fresco sin marca.
 */
function catalogStatusBadge(course: CourseSummary): ReactNode {
  if (course.status === "DRAFT")
    return <Badge variant="outline">Borrador</Badge>
  if (course.status === "ARCHIVED")
    return <Badge variant="outline">Archivado</Badge>
  if (course.lessons === 0) return <Badge variant="outline">Sin contenido</Badge>
  if (course.progressPct === 100)
    return <Badge variant="secondary">Completado</Badge>
  if (course.progressPct !== null && course.progressPct > 0)
    return <Badge variant="secondary">En curso</Badge>
  return null
}

/**
 * Tarjeta del catálogo: delega en CourseCard (cover + descripción +
 * progreso) sin prop `index` — el listado ya no numera. La variante
 * bloqueada (borrador/archivado/sin lecciones) sale del mismo cálculo de
 * acceso que usaba el índice.
 */
export function CourseCatalogCard({ course }: { course: CourseSummary }) {
  const navEnabled =
    course.lessons > 0 && course.status !== "DRAFT" && course.status !== "ARCHIVED"
  return (
    <CourseCard
      course={course}
      navEnabled={navEnabled}
      statusBadge={catalogStatusBadge(course)}
    />
  )
}
