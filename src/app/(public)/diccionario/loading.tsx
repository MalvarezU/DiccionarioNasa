import { ExploreListSkeleton, SearchResultsSkeleton, WordDetailSkeleton } from "@/components/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * El buscador tiene dos estados distintos mientras carga y no conviene
 * mostrar lo mismo en los dos: con una palabra escrita se espera el detalle,
 * sin ella se espera el listado.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <Skeleton className="mx-auto h-11 w-full max-w-xl" />
        <SearchResultsSkeleton count={4} />
      </div>
      <WordDetailSkeleton />
      <ExploreListSkeleton />
    </main>
  )
}