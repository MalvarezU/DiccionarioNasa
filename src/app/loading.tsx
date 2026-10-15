import { HomeSkeleton } from "@/components/skeletons"

/**
 * Red de seguridad para toda navegación de servidor. App Router lo muestra
 * mientras resuelve la ruta, en lugar de dejar la pantalla vacía.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <HomeSkeleton />
    </main>
  )
}