import { SectionHeadingSkeleton, WordTableSkeleton } from "@/components/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <SectionHeadingSkeleton />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <WordTableSkeleton />
    </main>
  )
}