import { CoursePlayerSkeleton } from "@/components/skeletons"

export default function Loading() {
  // El skeleton ya trae su propio container master-detail (max-w-[1400px]):
  // el route loading solo aporta el landmark.
  return (
    <main className="flex-1" aria-busy="true" aria-label="Cargando curso">
      <CoursePlayerSkeleton />
    </main>
  )
}
