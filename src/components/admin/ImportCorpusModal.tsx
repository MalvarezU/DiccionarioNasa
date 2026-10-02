"use client"

import { useState, useCallback } from "react"
import {
  Upload,
  Download,
  FileUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface PreviewColumn {
  header: string
  mapped: string | null
}

interface PreviewData {
  fileName: string
  columns: PreviewColumn[]
  total: number
  valid: number
  invalid: number
  duplicates: number
  errors: Array<{ row: number; reason: string }>
  previewToken: string
}

interface ReportRow {
  spanish: string
  nasaYuwe: string
  resultado: string
}

interface ConfirmResult {
  created: number
  skipped: number
  total: number
  report: ReportRow[]
}

interface ImportCorpusModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function ImportCorpusModal({
  open,
  onOpenChange,
  onImported,
}: ImportCorpusModalProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [importResult, setImportResult] = useState<ConfirmResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setFileName(null)
    setPreview(null)
    setImportResult(null)
    setImportError(null)
  }, [])

  // Paso 1: subir y previsualizar (valida sin escribir)
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setFileName(file.name)
      setPreview(null)
      setImportResult(null)
      setImportError(null)
      setIsPreviewing(true)

      try {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/admin/import/preview", {
          method: "POST",
          body: formData,
        })
        const data = await res.json()
        if (res.ok) {
          setPreview(data)
        } else {
          setImportError(data.message || "No se pudo previsualizar el archivo")
        }
      } catch {
        setImportError("Error de conexión con el servidor")
      } finally {
        setIsPreviewing(false)
      }
    },
    []
  )

  // Paso 2: confirmar (todo entra en BORRADOR salvo columna explícita)
  const handleConfirm = useCallback(async () => {
    if (!preview) return

    setIsConfirming(true)
    setImportError(null)

    try {
      const res = await fetch("/api/admin/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewToken: preview.previewToken }),
      })
      const data = await res.json()
      if (res.ok) {
        setImportResult(data)
        setPreview(null)
        onImported()
      } else {
        setImportError(data.message || "Error al importar")
      }
    } catch {
      setImportError("Error de conexión al servidor")
    } finally {
      setIsConfirming(false)
    }
  }, [preview, onImported])

  const handleDownloadReport = useCallback(() => {
    if (!importResult) return
    const header = "espanol,nasa_yuwe,resultado"
    const rows = importResult.report.map((r) =>
      [r.spanish, r.nasaYuwe, r.resultado]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv = "\uFEFF" + [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reporte-importacion-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [importResult])

  const handleClose = useCallback(() => {
    if (!isPreviewing && !isConfirming) {
      reset()
      onOpenChange(false)
    }
  }, [isPreviewing, isConfirming, reset, onOpenChange])

  const busy = isPreviewing || isConfirming

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar corpus
          </DialogTitle>
          <DialogDescription>
            Sube un Excel o CSV, revisa la vista previa y confirma. Todo entra en borrador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Card className="bg-muted/40">
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Paso 1:</strong> sube <code className="bg-muted px-1 rounded">.xlsx</code> o{" "}
                <code className="bg-muted px-1 rounded">.csv</code> con encabezados
                (<code className="bg-muted px-1 rounded">Palabra_esp</code>,{" "}
                <code className="bg-muted px-1 rounded">Palabra_nyW</code>, categoría, ejemplos, estado).
                <strong>Paso 2:</strong> revisa N listas + M errores y confirma.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Duplicados por «español» se omiten sin sobrescribir. Sin columna de estado, todo queda en{" "}
                <strong>Borrador</strong> para revisión.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>Subir archivo Excel o CSV</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={busy}
                className="max-w-xs"
              />
              {fileName && (
                <Badge variant="secondary" className="gap-1">
                  <FileUp className="h-3 w-3" />
                  {fileName}
                </Badge>
              )}
            </div>
          </div>

          {isPreviewing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando archivo...
            </div>
          )}

          {preview && (
            <Card className="border-primary/30">
              <CardContent className="pt-4 pb-4 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Vista previa: {preview.valid} listas de {preview.total} filas
                  {preview.duplicates > 0 && (
                    <span className="text-tertiary"> · {preview.duplicates} duplicadas</span>
                  )}
                  {preview.invalid > 0 && (
                    <span className="text-destructive"> · {preview.invalid} con errores</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.columns.map((c) => (
                    <Badge
                      key={c.header}
                      variant={c.mapped ? "secondary" : "outline"}
                      className="text-2xs"
                    >
                      {c.header} → {c.mapped ?? "ignorada"}
                    </Badge>
                  ))}
                </div>
                {preview.errors.length > 0 && (
                  <div className="space-y-1">
                    {preview.errors.map((err, i) => (
                      <p key={i} className="text-2xs text-destructive">
                        Fila {err.row}: {err.reason}
                      </p>
                    ))}
                  </div>
                )}
                <Button
                  onClick={handleConfirm}
                  disabled={isConfirming || preview.valid === 0}
                  className="gap-2 mt-1"
                >
                  {isConfirming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isConfirming ? "Importando..." : `Confirmar (${preview.valid} en borrador)`}
                </Button>
              </CardContent>
            </Card>
          )}

          {importResult && (
            <Card className="border-secondary/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Importación completada
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Total: <strong className="text-foreground">{importResult.total}</strong></span>
                      <span className="text-secondary">Creadas: <strong>{importResult.created}</strong></span>
                      {importResult.skipped > 0 && (
                        <span className="text-tertiary">Omitidas: <strong>{importResult.skipped}</strong></span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadReport}
                      className="gap-1.5 mt-2 text-xs h-8"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar reporte CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {importError && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{importError}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            {importResult ? "Cerrar" : "Cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
