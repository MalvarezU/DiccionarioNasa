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

    // Reset feedback before starting
    setSyncFeedback("none")

    try {
      await forceResync()
      // forceResync resolves only after completion (success or error is in useLocalDB.error)
      // We check the error state after the promise resolves
      // But since forceResync catches internally and sets error in the hook,
      // we need a small delay for the state to update.
      // Instead, let's check for errors directly:
      // Actually, forceResync sets error in useLocalDB. After it resolves,
      // React will re-render with the new error state. But we're still in the
      // event handler callback, so state updates are batched.
      // We'll use a microtask to check the result after React processes:
      setTimeout(() => {
        // The error and lastSync will have been updated by now
        // We'll derive feedback from the current hook state
        // Since we can't read future state here, we set "success"
        // and rely on the error check below
        setSyncFeedback("success")
      }, 100)
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
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
                : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
            }`}
          >
            {isOnline ? (
              <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p
                className={`text-sm font-medium ${
                  isOnline
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
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
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Descargada
                    </span>
                  ) : isDownloading ? (
                    <span className="flex items-center gap-1 text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Descargando...
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
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
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}

          {/* ─── Success message after sync completes ───────────── */}
          {effectiveFeedback === "success" && !isDownloading && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Sincronización completada
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">
                  Última actualización: {formattedLastSync ?? "ahora"}
                </p>
              </div>
            </div>
          )}

          {/* ─── Offline message when user tries to sync ────────── */}
          {effectiveFeedback === "offline" && !isDownloading && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
              <CloudOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
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
