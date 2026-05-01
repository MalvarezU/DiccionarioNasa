"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Download, CheckCircle2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useLocalDB } from "@/hooks/use-local-db"
import { useOnlineStatus } from "@/hooks/use-online-status"

const BANNER_DISMISSED_KEY = "nasa-yuwe-banner-dismissed"

type BannerState = "idle" | "downloading" | "complete" | "error"

/**
 * Read dismissed flag from localStorage (safe for SSR).
 */
function getInitialDismissed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === "true"
  } catch {
    return false
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

  const [dismissed, setDismissed] = useState(getInitialDismissed)

  // Derive banner state from hook values (no useEffect + setState needed)
  const bannerState: BannerState = useMemo(() => {
    if (isReady) return "complete"
    if (isDownloading) return "downloading"
    if (error) return "error"
    return "idle"
  }, [isReady, isDownloading, error])

  // Derive visibility from state (no useEffect + setState needed)
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
    setDismissed(true)
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, "true")
    } catch {
      // localStorage not available
    }
  }, [])

  const handleDownload = useCallback(() => {
    startDownload()
  }, [startDownload])

  const handleRetry = useCallback(() => {
    startDownload()
  }, [startDownload])

  // Auto-dismiss after completion
  useEffect(() => {
    if (bannerState === "complete" && isVisible) {
      const timer = setTimeout(() => {
        handleDismiss()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [bannerState, isVisible, handleDismiss])

  // Don't render anything if not visible
  if (!isVisible) return null

  return (
    <div className="w-full transition-all duration-300 ease-in-out animate-in slide-in-from-top-2">
      <div
        className={`
          mx-auto px-4 py-3
          sm:mx-4 sm:rounded-lg sm:mt-2
          flex items-center gap-3
          ${
            bannerState === "complete"
              ? "bg-primary/10 border border-primary/20"
              : bannerState === "error"
                ? "bg-destructive/10 border border-destructive/20"
                : "bg-secondary/60 border border-border"
          }
        `}
      >
        {/* Icon */}
        <div className="shrink-0">
          {bannerState === "idle" && (
            <Download className="size-5 text-primary" />
          )}
          {bannerState === "downloading" && (
            <Download className="size-5 text-primary animate-pulse" />
          )}
          {bannerState === "complete" && (
            <CheckCircle2 className="size-5 text-primary" />
          )}
          {bannerState === "error" && (
            <AlertCircle className="size-5 text-destructive" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {bannerState === "idle" && (
            <p className="text-sm font-medium text-foreground">
              Descargar diccionario para uso sin conexión
            </p>
          )}

          {bannerState === "downloading" && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                Descargando diccionario... {downloadProgress}%
              </p>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}

          {bannerState === "complete" && (
            <p className="text-sm font-medium text-primary">
              Diccionario listo para usar sin conexión
            </p>
          )}

          {bannerState === "error" && (
            <p className="text-sm font-medium text-destructive">
              Error al descargar. Se reanudará cuando haya conexión.
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-2">
          {bannerState === "idle" && (
            <Button
              size="sm"
              onClick={handleDownload}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Descargar</span>
            </Button>
          )}

          {bannerState === "error" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Reintentar
            </Button>
          )}

          {/* Dismiss button — not shown during active download */}
          {bannerState !== "downloading" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDismiss}
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
