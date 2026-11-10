"use client"

import { useState, useCallback, useSyncExternalStore } from "react"
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CloudOff,
  Database,
  Clock,
  HardDrive,
  Wifi,
  WifiOff,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useLocalDB } from "@/hooks/use-local-db"
import { useOnlineStatus } from "@/hooks/use-online-status"

// ─── Hydration-safe mount guard ─────────────────────────────────────────────

const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

// ─── Date formatting ────────────────────────────────────────────────────────

function formatSyncDate(isoString: string | null): string | null {
  if (!isoString) return null
  try {
    const date = new Date(isoString)
    return date.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return null
  }
}

// ─── Feedback type for sync result ──────────────────────────────────────────

type SyncFeedback = "none" | "success" | "error" | "offline"

// ─── Component ──────────────────────────────────────────────────────────────

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const mounted = useMounted()
  const isOnline = useOnlineStatus()
  const {
    isReady,
    isDownloading,
    downloadProgress,
    localWordCount,
    error,
    lastSync,
    forceResync,
    refreshStats,
  } = useLocalDB()

  // UI feedback state — only set from event handlers, never from effects
  const [syncFeedback, setSyncFeedback] = useState<SyncFeedback>("none")

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Dialog is opening — refresh stats and reset feedback
        refreshStats()
        setSyncFeedback("none")
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, refreshStats]
  )

  const handleSync = useCallback(async () => {
    if (!isOnline) {
      setSyncFeedback("offline")
      return
    }

    setSyncFeedback("none")

    try {
      const ok = await forceResync()
      if (ok) {
        setSyncFeedback("success")
      } else {
        setSyncFeedback("error")
      }
    } catch {
      setSyncFeedback("error")
    }
  }, [isOnline, forceResync])

  // Derive final feedback: if there's an error from the hook and we just synced, show error
  const effectiveFeedback: SyncFeedback = error && syncFeedback === "success"
    ? "error"
    : syncFeedback

  const formattedLastSync = formatSyncDate(lastSync)

  // Don't render during SSR
  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Configuración
          </DialogTitle>
          <DialogDescription>
            Gestiona el diccionario local y la sincronización de datos.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-4">
          {/* ─── Connection Status ──────────────────────────────── */}
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              isOnline
                ? "bg-secondary-container border-secondary/30"
                : "bg-tertiary-container border-tertiary/30"
            }`}
          >
            {isOnline ? (
              <Wifi className="h-5 w-5 text-secondary shrink-0" />
            ) : (
              <WifiOff className="h-5 w-5 text-tertiary shrink-0" />
            )}
            <div className="min-w-0">
              <p
                className={`text-sm font-medium ${
                  isOnline
                    ? "text-montana"
                    : "text-tertiary"
                }`}
              >
                {isOnline ? "Conectado a internet" : "Sin conexión a internet"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isOnline
                  ? "La sincronización está disponible"
                  : "Conéctate para sincronizar"}
              </p>
            </div>
          </div>

          {/* ─── Local Database Status ──────────────────────────── */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Base de datos local
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Estado</span>
                <p className="font-medium text-foreground">
                  {isReady ? (
                    <span className="flex items-center gap-1 text-montana">
                      <CheckCircle2 className="h-3 w-3" />
                      Descargada
                    </span>
                  ) : isDownloading ? (
                    <span className="flex items-center gap-1 text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Descargando...
                    </span>
                  ) : (
                    <span className="text-tertiary">
                      No descargada
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Palabras</span>
                <p className="font-medium text-foreground">
                  {localWordCount > 0 ? localWordCount.toLocaleString("es-CO") : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Last Sync ──────────────────────────────────────── */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Última sincronización</p>
              <p className="text-sm font-medium text-foreground">
                {formattedLastSync ?? "Nunca sincronizado"}
              </p>
            </div>
          </div>

          {/* ─── Sync Progress (shown during download) ──────────── */}
          {isDownloading && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="text-sm font-medium text-foreground">
                  Sincronizando... {downloadProgress}%
                </span>
              </div>
              <Progress value={downloadProgress} className="h-2 bg-surface-container-high [&_[data-slot=progress-indicator]]:bg-secondary" />
            </div>
          )}

          {/* ─── Success message after sync completes ───────────── */}
          {effectiveFeedback === "success" && !isDownloading && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary-container border border-secondary/30">
              <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-montana">
                  Sincronización completada
                </p>
                <p className="text-xs text-muted-foreground">
                  Última actualización: {formattedLastSync ?? "ahora"}
                </p>
              </div>
            </div>
          )}

          {/* ─── Offline message when user tries to sync ────────── */}
          {effectiveFeedback === "offline" && !isDownloading && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-tertiary-container border border-tertiary/30">
              <CloudOff className="h-5 w-5 text-tertiary shrink-0" />
              <p className="text-sm font-medium text-tertiary">
                Sin conexión a internet. Conéctate para sincronizar.
              </p>
            </div>
          )}

          {/* ─── Error message after failed sync ────────────────── */}
          {effectiveFeedback === "error" && !isDownloading && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {error ?? "Error al sincronizar. Intenta de nuevo."}
              </p>
            </div>
          )}

          <Separator />

          {/* ─── Sync Button ────────────────────────────────────── */}
          <Button
            onClick={handleSync}
            disabled={isDownloading}
            className="w-full gap-2"
            variant={isReady ? "outline" : "default"}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando... {downloadProgress}%
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {isReady ? "Buscar actualizaciones" : "Sincronizar ahora"}
              </>
            )}
          </Button>

          {/* Hint text below button */}
          {isReady && !isDownloading && (
            <p className="text-xs text-center text-muted-foreground">
              Descarga la última versión del diccionario desde el servidor.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
