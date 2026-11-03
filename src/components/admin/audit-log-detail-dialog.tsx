"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  User,
  Clock,
  FileText,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "./confirm-dialog"
import { toast } from "@/hooks/use-toast"
import {
  type AuditLogEntry,
  formatDate,
  getActionLabel,
  getActionColor,
  getEntityLabel,
  getResponsible,
} from "@/lib/admin-utils"
import {
  isRevertible,
  parseAuditChanges,
  revertedOriginalId,
} from "@/lib/audit-revert"

interface AuditLogDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: AuditLogEntry | null
  isAdmin: boolean
  /** IDs de logs originales ya revertidos (calculados por el padre). */
  revertedIds: Set<string>
  onReverted: () => void
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export function AuditLogDetailDialog({
  open,
  onOpenChange,
  log,
  isAdmin,
  revertedIds,
  onReverted,
}: AuditLogDetailDialogProps) {
  const [reverting, setReverting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!log) return null

  const parsed = parseAuditChanges(log.changes)
  const alreadyReverted = revertedIds.has(log.id)
  const revertible = isRevertible(log) && !alreadyReverted
  const reverted = alreadyReverted

  async function handleRevert() {
    if (!log) return
    setReverting(true)
    try {
      const res = await fetch(`/api/admin/audit-logs/${log.id}/revert`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "No se pudo revertir",
          description: data.message || "Error desconocido",
          variant: "destructive",
        })
        // Si ya estaba revertido, marcarlo localmente
        if (res.status === 409 && /ya.*revert/i.test(data.message || "")) {
          onReverted()
        }
        return
      }
      toast({ title: "Cambio revertido", description: data.message })
      onReverted()
      onOpenChange(false)
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setReverting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalle de la acción
            </DialogTitle>
            <DialogDescription>
              {getEntityLabel(log.entity)}
              {log.entityId ? ` · #${log.entityId.slice(0, 8)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Acción</p>
                <Badge variant="outline" className={`text-xs mt-1 ${getActionColor(log.action)}`}>
                  {getActionLabel(log.action)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="mt-1 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(log.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Responsable</p>
                <p className="mt-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {getResponsible(log.userId)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="mt-1">
                  {reverted ? (
                    <Badge variant="outline" className="text-xs border-secondary/30 text-secondary">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ya revertido
                    </Badge>
                  ) : log.action === "REVERT" ? (
                    <Badge variant="outline" className="text-xs">Reversión</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">Activo</span>
                  )}
                </p>
              </div>
            </div>

            {parsed.rows.length > 0 && (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-2 font-medium">Campo</th>
                      <th className="text-left p-2 font-medium">Antes</th>
                      <th className="text-left p-2 font-medium">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-medium text-foreground">{r.label}</td>
                        <td className="p-2 text-muted-foreground break-all">{fmt(r.before)}</td>
                        <td className="p-2 text-muted-foreground break-all">{fmt(r.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {parsed.summary && (
              <p className="text-sm text-muted-foreground">{parsed.summary}</p>
            )}

            {parsed.responsable && (
              <p className="text-xs text-muted-foreground">
                Registrado por: {parsed.responsable}
              </p>
            )}

            {isAdmin && revertible && (
              <div className="pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={reverting}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Revertir cambio
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Restaura el estado anterior del registro. Solo si no cambió desde entonces.
                </p>
              </div>
            )}

            {!isAdmin && isRevertible(log) && (
              <p className="text-xs text-muted-foreground italic">
                Solo los administradores pueden revertir cambios.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleRevert}
        titulo="¿Revertir este cambio?"
        descripcion="Se restaurará el estado anterior del registro. Esta acción queda registrada en la bitácora."
        accionLabel={reverting ? "Revirtiendo…" : "Revertir"}
        processing={reverting}
      />
    </>
  )
}

