import { CourseCard, type CourseSummary } from "./course-card"

/**
 * Etiqueta de estado del catálogo — misma decisión del índice anterior,
 * pero como texto puro: el chip visual (vidrio sobre la portada) lo pinta
 * CourseCard desde el F-E1. Null = curso fresco, sin marca.
 */
function catalogStatusLabel(course: CourseSummary): string | null {
  if (course.status === "DRAFT") return "Borrador"
  if (course.status === "ARCHIVED") return "Archivado"
  if (course.lessons === 0) return "Sin contenido"
  if (course.progressPct === 100) return "Completado"
  if (course.progressPct !== null && course.progressPct > 0) return "En curso"
  return null
}

/**
 * Tarjeta del catálogo: delega en CourseCard (cover duotone + chip de
 * estado + descripción + progreso) sin prop `index` — el listado ya no
 * numera. La variante bloqueada (borrador/archivado/sin lecciones) sale
 * del mismo cálculo de acceso que usaba el índice.
 */
export function CourseCatalogCard({ course }: { course: CourseSummary }) {
  const navEnabled =
    course.lessons > 0 && course.status !== "DRAFT" && course.status !== "ARCHIVED"
  return (
    <CourseCard
      course={course}
      navEnabled={navEnabled}
      statusBadge={catalogStatusLabel(course)}
    />
  )
}
