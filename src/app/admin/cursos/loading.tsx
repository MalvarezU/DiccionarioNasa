import { CourseManagerSkeleton } from "@/components/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-8 w-28 rounded-md border-transparent" />
        <Skeleton className="h-7 w-48 border-transparent" />
      </div>
      <div aria-busy="true" aria-label="Cargando gestión de cursos">
        <CourseManagerSkeleton />
      </div>
      <div className="bg-border my-8 h-px w-full" />
      <Skeleton className="h-3 w-96 max-w-full border-transparent" />
    </>
  )
}
