"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOnlineStatus } from "@/hooks/use-online-status"

/**
 * Hidratación segura: falso en SSR, verdadero en cliente tras el mount
 * (mismo patrón que DownloadBanner).
 */
const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

/**
 * Banda persistente "Sin conexión" (Fase 4): en vez de estados vacíos
 * silenciosos, la app dice que está offline y ofrece qué sí funciona.
 * Hidratación segura: no se renderiza hasta el mount (navigator no existe
 * en el server y el snapshot inicial asume online).
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const mounted = useMounted()

  if (!mounted || isOnline) return null

  return (
    <div
      role="status"
      // mt-14: el NavBar es fixed h-14; sin esto la banda queda tapada por él.
      className="mt-14 border-b border-tertiary/25 bg-tertiary-container"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <WifiOff className="h-4 w-4 shrink-0 text-tertiary" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-tertiary">
          Sin conexión — mostrando contenido guardado en este dispositivo.
        </p>
        <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs">
          <Link href="/offline">Ver lo disponible</Link>
        </Button>
      </div>
    </div>
  )
}
