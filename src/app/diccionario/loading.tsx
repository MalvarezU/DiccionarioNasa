import { ExploreListSkeleton, SearchResultsSkeleton, WordDetailSkeleton } from "@/components/skeletons"

/**
 * El buscador tiene dos estados distintos mientras carga y no conviene
 * mostrar lo mismo en los dos: con una palabra escrita se espera el detalle,
 * sin ella se espera el listado.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <div className="mx-auto h-11 w-full max-w-xl rounded-md border border-outline-variant/20" />
        <SearchResultsSkeleton count={4} />
      </div>
      <WordDetailSkeleton />
      <ExploreListSkeleton />
    </main>
  )
}