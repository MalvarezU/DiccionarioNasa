"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PackagePlus,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "./confirm-dialog"

type UiState =
  | "idle"
  | "confirmando"
  | "despachando"
  | "observando"
  | "exito"
  | "fallo"

interface SeedRunView {
  id: number
  status: string
  conclusion: string | null
  createdAt: string
  updatedAt: string
  inputs: Record<string, unknown>
  htmlUrl: string
}

interface SeedDispatchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const POLL_INTERVALS = [15000, 30000, 60000]
const MAX_POLL_FAILURES = 3
const DISPATCH_FAILED =
  "No se pudo iniciar la generación. Es posible reintentar o continuar con el flujo manual en GitHub."
const POLL_EXHAUSTED =
  "No se pudo obtener el estado. Revisar manualmente en GitHub Actions."

function actionsUrlFrom(htmlUrl: string | undefined): string | null {
  if (!htmlUrl) return null
  const base = htmlUrl.split("/actions/runs/")[0]
  return base ? base : null
}

/**
 * Botón admin "Generar contenido offline" (Fase D W1).
 *
 * Dos pasos reutilizados de `ImportCorpusModal` (configurar → confirmar con
 * `ConfirmDialog`): despacha `seed-content.yml` y sigue el run por polling
 * cada 15 s con backoff 15/30/60 s ante 502/429 (parada tras 3 fallos).
 */
export function SeedDispatchModal({ open, onOpenChange }: SeedDispatchModalProps) {
  const [contentVersion, setContentVersion] = useState("")
  const [dryRun, setDryRun] = useState(true)
  const [uiState, setUiState] = useState<UiState>("idle")
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<SeedRunView | null>(null)
  const [history, setHistory] = useState<SeedRunView[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dispatchingRef = useRef(false)
  const dispatchedAtRef = useRef<string | null>(null)

  const stopPolling = () => {
    if (pollTimer.current !== null) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }

  const resetFlow = () => {
    stopPolling()
    dispatchingRef.current = false
    dispatchedAtRef.current = null
    setUiState("idle")
    setDispatchError(null)
    setFailureMessage(null)
    setLastRun(null)
    setConfirmOpen(false)
  }

  // Historial al abrir; el polling vive solo con el modal abierto.
  useEffect(() => {
    if (!open) return
    resetFlow()
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/seed/runs?per_page=10")
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.runs)) setHistory(data.runs)
      } catch {
        if (!cancelled) setHistory([])
      }
    })()
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [open])

  const retryOrGiveUp = (failures: number) => {
    const next = failures + 1
    if (next >= MAX_POLL_FAILURES) {
      setFailureMessage(POLL_EXHAUSTED)
      setUiState("fallo")
      return
    }
    const at = dispatchedAtRef.current
    if (!at) return
    stopPolling()
    pollTimer.current = setTimeout(() => {
      void pollOnce(at, next)
    }, POLL_INTERVALS[failures] ?? 60000)
  }

  const pollOnce = async (at: string, failures: number) => {
    let data: { runs?: SeedRunView[] }
    try {
      const res = await fetch("/api/admin/seed/runs?per_page=10")
      if (res.status === 502 || res.status === 429) {
        retryOrGiveUp(failures)
        return
      }
      if (!res.ok) {
        setFailureMessage(POLL_EXHAUSTED)
        setUiState("fallo")
        return
      }
      data = await res.json()
    } catch {
      retryOrGiveUp(failures)
      return
    }

    const runs = Array.isArray(data.runs) ? data.runs : []
    const mine = runs
      .filter((r) => r.createdAt > at)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] as
      | SeedRunView
      | undefined

    if (!mine) {
      stopPolling()
      pollTimer.current = setTimeout(() => {
        void pollOnce(at, 0)
      }, POLL_INTERVALS[0])
      return
    }

    setLastRun(mine)
    if (mine.status === "completed") {
      if (mine.conclusion === "success") {
        setUiState("exito")
      } else {
        setFailureMessage(
          `La ejecución terminó con estado: ${mine.conclusion ?? "desconocido"}. Es posible reintentar o continuar con el flujo manual en GitHub.`
        )
        setUiState("fallo")
      }
      return
    }

    stopPolling()
    pollTimer.current = setTimeout(() => {
      void pollOnce(at, 0)
    }, POLL_INTERVALS[0])
  }

  const dispatch = async () => {
    if (dispatchingRef.current) return
    dispatchingRef.current = true
    setUiState("despachando")
    setDispatchError(null)

    try {
      const trimmed = contentVersion.trim()
      const res = await fetch("/api/admin/seed/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry_run: dryRun,
          ...(trimmed ? { content_version: trimmed } : {}),
        }),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))

      if (res.status === 400) {
        setDispatchError(
          typeof data.message === "string" ? data.message : DISPATCH_FAILED
        )
        setUiState("fallo")
        setConfirmOpen(false)
        return
      }
      if (!res.ok) {
        setDispatchError(DISPATCH_FAILED)
        setUiState("fallo")
        setConfirmOpen(false)
        return
      }

      const at = new Date().toISOString()
      dispatchedAtRef.current = at
      setConfirmOpen(false)
      setUiState("observando")
      stopPolling()
      pollTimer.current = setTimeout(() => {
        void pollOnce(at, 0)
      }, POLL_INTERVALS[0])
    } catch {
      setDispatchError(DISPATCH_FAILED)
      setUiState("fallo")
      setConfirmOpen(false)
    } finally {
      dispatchingRef.current = false
    }
  }

  const handleClose = () => {
    if (uiState === "despachando") return
    resetFlow()
    onOpenChange(false)
  }

  const handleReview = () => {
    setUiState("confirmando")
    setConfirmOpen(true)
  }

  const versionLabel = contentVersion.trim() || "actual"
  const modeLabel = dryRun ? "verificación" : "publicación"
  const actionsUrl = actionsUrlFrom(lastRun?.htmlUrl ?? history[0]?.htmlUrl)
  const busy = uiState === "despachando"
  const errorMessage = dispatchError ?? failureMessage

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-2xl md:max-w-3xl">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 font-serif tracking-tight text-lg text-primary">
              <PackagePlus className="h-5 w-5 text-primary" />
              Generar contenido offline
            </DialogTitle>
            <DialogDescription>
              Crea el paquete de contenido para la aplicación móvil. Esta acción consume minutos de GitHub Actions.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              {uiState === "idle" || uiState === "confirmando" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="seed-content-version" className="text-xs">
                      Versión de contenido (opcional)
                    </Label>
                    <Input
                      id="seed-content-version"
                      value={contentVersion}
                      onChange={(e) => setContentVersion(e.target.value)}
                      placeholder="Vacío = versión actual"
                      inputMode="numeric"
                      className="w-full sm:max-w-md"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="seed-dry-run"
                      checked={dryRun}
                      onCheckedChange={(v) => setDryRun(v === true)}
                    />
                    <Label htmlFor="seed-dry-run" className="text-xs">
                      Solo verificar, sin publicar
                    </Label>
                  </div>
                </>
              ) : null}

              {uiState === "observando" ? (
                <Card className="border-primary/30">
                  <CardContent className="pt-4 pb-4 flex items-start gap-3">
                    <Loader2 className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Generación en curso. El estado se actualiza cada 15 segundos.
                      </p>
                      {lastRun ? (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Ejecución #{lastRun.id} · {lastRun.status}
                          {lastRun.conclusion ? ` · ${lastRun.conclusion}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {uiState === "exito" ? (
                <Card className="border-secondary/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-foreground">
                        Contenido generado correctamente.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {uiState === "fallo" && errorMessage ? (
                <Card className="border-destructive/30">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-destructive">{errorMessage}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {actionsUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={actionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Continuar con el flujo manual en GitHub
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDispatchError(null)
                          setFailureMessage(null)
                          setLastRun(null)
                          setUiState("idle")
                        }}
                      >
                        Reintentar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="rounded-2xl border border-outline-variant/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Historial
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {history.length > 0 ? (
                    <ul className="divide-y divide-outline-variant/20">
                      {history.slice(0, 10).map((run) => (
                        <li
                          key={run.id}
                          className="flex items-center justify-between gap-2 py-2 text-xs"
                        >
                          <span className="tabular-nums text-muted-foreground">
                            #{run.id} ·{" "}
                            {new Date(run.createdAt).toLocaleString("es-CO")}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-2xs">
                              {run.conclusion ?? run.status}
                            </Badge>
                            <span className="text-muted-foreground">
                              {run.inputs?.dry_run === true
                                ? "verificación"
                                : run.inputs?.dry_run === false
                                  ? "publicación"
                                  : "—"}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sin ejecuciones registradas.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-outline-variant/30 px-6 py-4">
            {uiState === "exito" || uiState === "observando" ? (
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
            ) : uiState === "fallo" ? (
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={busy}>
                  Cancelar
                </Button>
                <Button onClick={handleReview} disabled={busy}>
                  Revisar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          // El cierre que dispara AlertDialogAction tras "Generar" debe
          // ignorarse mientras el dispatch está en vuelo (anti-doble-clic);
          // el propio dispatch cierra al resolver.
          if (!v && !dispatchingRef.current) {
            setConfirmOpen(false)
            setUiState("idle")
          }
        }}
        onConfirm={() => void dispatch()}
        titulo="¿Generar el paquete de contenido?"
        descripcion={
          <>
            <span>
              Versión: {versionLabel} · Modo: {modeLabel}
            </span>
            {!dryRun ? (
              <span className="mt-1 block">
                Con modo publicación, el contenido nuevo quedará disponible para
                la aplicación.
              </span>
            ) : null}
          </>
        }
        accionLabel="Generar"
        processing={uiState === "despachando"}
      />
    </>
  )
}
