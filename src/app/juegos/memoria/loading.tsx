import { GameBoardSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <GameBoardSkeleton />
    </main>
  )
}