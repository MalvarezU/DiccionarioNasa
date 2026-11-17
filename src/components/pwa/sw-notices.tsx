"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, HardDrive, X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Avisos del service worker (Fase 2 PWA):
 * - "Nueva versión disponible": el SW nuevo queda en `waiting` (ya no hace
 *   skipWaiting solo); se activa solo cuando el usuario acepta.
 * - "Almacenamiento lleno": el SW avisa (PIIYAAK_SW_QUOTA) tras recortar y
 *   reintentar una vez, en vez de tragar el QuotaExceededError.
 *
 * Renderiza null hasta que haya algo que mostrar (y hasta el mount, para no
 * descuadrar la hidratación: navigator.serviceWorker no existe en el server).
 */
export function SWNotices() {
  const [mounted, setMounted] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [quotaCache, setQuotaCache] = useState<string | null>(null)
  // Solo recargar ante un UPDATE (waiting aplicado por el usuario). El primer
  // claim (pagina sin controlador que pasa a controlada) no debe recargar:
  // perderia estado y rompe navegaciones en curso.
  const hadController = useRef(false)
  const updateApplied = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    hadController.current = !!navigator.serviceWorker.controller

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PIIYAAK_SW_QUOTA") {
        setQuotaCache(String(event.data.cache ?? "caché"))
      }
    }
    const onControllerChange = () => {
      if (hadController.current || updateApplied.current) window.location.reload()
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      if (reg.waiting) {
        setWaitingWorker(reg.waiting)
        setUpdateReady(true)
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(installing)
            setUpdateReady(true)
          }
        })
      })
    })

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage)
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    updateApplied.current = true
    waitingWorker?.postMessage({ type: "SKIP_WAITING" })
    // Respaldo: si el controllerchange no llega, recargar igual.
    window.setTimeout(() => window.location.reload(), 3000)
  }, [waitingWorker])

  if (!mounted || (!updateReady && !quotaCache)) return null

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 mx-auto flex max-w-md flex-col gap-2">
      {updateReady && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-secondary/30 bg-secondary-container px-4 py-3 shadow-lg"
        >
          <RefreshCw className="h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-medium text-montana">
            Nueva versión disponible
          </p>
          <Button size="sm" onClick={applyUpdate} className="shrink-0">
            Actualizar
          </Button>
        </div>
      )}
      {quotaCache && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-tertiary/30 bg-tertiary-container px-4 py-3 shadow-lg"
        >
          <HardDrive className="h-5 w-5 shrink-0 text-tertiary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-medium text-tertiary">
            Almacenamiento lleno: se liberó espacio en {quotaCache}.
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setQuotaCache(null)}
            aria-label="Descartar aviso"
            className="shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
