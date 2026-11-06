"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { Download, CheckCircle2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useLocalDB } from "@/hooks/use-local-db"
import { useOnlineStatus } from "@/hooks/use-online-status"

const BANNER_DISMISSED_KEY = "nasa-yuwe-banner-dismissed"

type BannerState = "idle" | "downloading" | "complete" | "error"

/**
 * Hydration-safe "mounted" flag using useSyncExternalStore.
 * Returns false during SSR, true on client after hydration.
 */
const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

/**
 * Read a boolean flag from localStorage, hydration-safe.
 * Uses useSyncExternalStore with custom events for same-tab updates.
 */
function useLocalStorageFlag(key: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      // Cross-tab storage events
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) callback()
      }
      window.addEventListener("storage", onStorage)
      // Same-tab custom event (storage event doesn't fire for same-tab writes)
      window.addEventListener(`ls:${key}`, callback)
      return () => {
        window.removeEventListener("storage", onStorage)
        window.removeEventListener(`ls:${key}`, callback)
      }
    },
    [key]
  )

  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key) === "true"
    } catch {
      return false
    }
  }, [key])

  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Write a boolean flag to localStorage and notify same-tab subscribers.
 */
function setLocalStorageFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
    window.dispatchEvent(new CustomEvent(`ls:${key}`))
  } catch {
    // localStorage not available
  }
}

export function DownloadBanner() {
  const {
    isReady,
    isDownloading,
    downloadProgress,
    error,
    startDownload,
  } = useLocalDB()
  const isOnline = useOnlineStatus()
  const mounted = useMounted()
  const dismissed = useLocalStorageFlag(BANNER_DISMISSED_KEY)

  // Derive banner state from hook values
  const bannerState: BannerState = useMemo(() => {
    if (isReady) return "complete"
    if (isDownloading) return "downloading"
    if (error) return "error"
    return "idle"
  }, [isReady, isDownloading, error])

  // Derive visibility from state
  const isVisible = useMemo(() => {
    // Dismissed and not actively downloading → hidden
    if (dismissed && bannerState !== "downloading") return false

    // Offline and not ready → can't download, hide
    if (!isOnline && !isReady) return false

    // Already ready and dismissed → don't show again
    if (isReady && dismissed) return false

    // Idle state: only show if online (can't download offline)
    if (bannerState === "idle" && !isOnline) return false

    // Show for: idle+online, downloading, complete (not dismissed), error
    if (bannerState === "idle" && isOnline) return true
    if (bannerState === "downloading") return true
    if (bannerState === "complete" && !dismissed) return true
    if (bannerState === "error") return true

    return false
  }, [dismissed, bannerState, isOnline, isReady])

  const handleDismiss = useCallback(() => {
    setLocalStorageFlag(BANNER_DISMISSED_KEY, true)
  }, [])

  const handleDownload = useCallback(() => {
    startDownload()
  }, [startDownload])

  const handleRetry = useCallback(() => {
    startDownload()
  }, [startDownload])

  // Sin auto-dismiss por temporizador: el banner compacto es secundario y
  // persistente hasta que el usuario lo cierra. La jerarquía de instalación
  // la lleva el InstallBanner superior.

  // Wait for client mount before rendering to avoid hydration mismatch
  // (localStorage, navigator.onLine, IndexedDB state differ between server and client)
  if (!mounted) return null

  // Don't render anything if not visible
  if (!isVisible) return null

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <div
        role={bannerState === "error" ? "alert" : "status"}
        className={`
          mt-2 flex items-center gap-2 rounded-lg border px-3 py-1.5
          ${
            bannerState === "error"
              ? "border-destructive/25 bg-destructive/10"
              : "border-outline-variant/30 bg-surface-container-high"
          }
        `}
      >
        {/* Icon */}
        <div className="shrink-0">
          {bannerState === "idle" && (
            <Download className="size-4 text-primary" />
          )}
          {bannerState === "downloading" && (
            <Download className="size-4 text-primary animate-pulse" />
          )}
          {bannerState === "complete" && (
            <CheckCircle2 className="size-4 text-secondary" />
          )}
          {bannerState === "error" && (
            <AlertCircle className="size-4 text-destructive" />
          )}
        </div>

        {/* Content — single compact line */}
        <div className="flex-1 min-w-0">
          {bannerState === "idle" && (
            <p className="truncate text-xs font-medium text-foreground">
              Descargar diccionario para uso sin conexión
            </p>
          )}

          {bannerState === "downloading" && (
            <div className="flex items-center gap-2">
              <p className="shrink-0 text-xs font-medium text-foreground">
                Descargando diccionario... {downloadProgress}%
              </p>
              <Progress value={downloadProgress} className="h-1 min-w-0 flex-1" />
            </div>
          )}

          {bannerState === "complete" && (
            <p className="truncate text-xs font-medium text-secondary">
              Diccionario listo para usar sin conexión
            </p>
          )}

          {bannerState === "error" && (
            <p className="text-xs font-medium text-destructive">
              Error al descargar. Se reanudará cuando haya conexión.{" "}
              <Button
                variant="link"
                onClick={handleRetry}
                className="h-auto p-0 text-xs font-semibold text-destructive underline underline-offset-2"
              >
                Reintentar
              </Button>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-1">
          {bannerState === "idle" && (
            <Button
              size="sm"
              variant="cta"
              onClick={handleDownload}
              className="h-7 px-2.5 text-xs"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Descargar</span>
            </Button>
          )}

          {/* Dismiss button — not shown during active download */}
          {bannerState !== "downloading" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDismiss}
              className="size-6 text-muted-foreground hover:text-foreground"
              aria-label="Cerrar aviso"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
