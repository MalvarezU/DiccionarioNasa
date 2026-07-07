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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

const CSV_COLUMN_MAP: Record<string, string> = {
  "palabra_nyw": "nasaYuwe",
  "palabra_esp": "spanish",
  "tipo1": "category",
  "ejemplo_ny": "exampleNasaYuwe",
  "ejemplo_esp": "exampleSpanish",
  "estado": "status",
  "nasa_yuwe": "nasaYuwe",
  "nasayuwe": "nasaYuwe",
  "spanish": "spanish",
  "category": "category",
  "pronunciation": "pronunciation",
  "culturalcontext": "culturalContext",
  "cultural_context": "culturalContext",
  "audio_url": "audioUrl",
  "audiourl": "audioUrl",
  "status": "status",
  "examples": "examples",
}

const VALID_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED", "BORRADOR", "PUBLICADA", "ARCHIVADA"])

function normalizeStatus(raw: string): string {
  const upper = raw.trim().toUpperCase()
  if (upper === "BORRADOR") return "DRAFT"
  if (upper === "PUBLICADA") return "PUBLISHED"
  if (upper === "ARCHIVADA") return "ARCHIVED"
  if (VALID_STATUSES.has(upper)) return upper
  return "DRAFT"
}

function parseCSVRows(text: string): Array<Record<string, string>> {
  let raw = text.replace(/^\uFEFF/, "")
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  const lines: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
        current += ch
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)

  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
  const mappedHeaders = headers.map((h) => CSV_COLUMN_MAP[h] || h)

  const rows: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    mappedHeaders.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim()
    })
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
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
  const [csvText, setCsvText] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    total: number
    created: number
    skipped: number
    errors: number
    errorRows: Array<{ row: number; reason: string }>
  } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setCsvText(text)
        setImportResult(null)
        setImportError(null)
      }
      reader.readAsText(file, "utf-8")
    },
    []
  )

  const handleImport = useCallback(async () => {
    if (!csvText.trim()) {
      setImportError("Sube un archivo CSV o pega los datos")
      return
    }

    const rows = parseCSVRows(csvText)
    if (rows.length === 0) {
      setImportError("No se encontraron filas válidas. Verifica que la primera fila tenga los encabezados correctos.")
      return
    }

    const hasNasaYuwe = rows.some((r) => r.nasaYuwe)
    const hasSpanish = rows.some((r) => r.spanish)
    if (!hasNasaYuwe && !hasSpanish) {
      setImportError("No se encontró la columna «Palabra_nyW» ni «Palabra_esp». Verifica los encabezados del CSV.")
      return
    }

    setIsImporting(true)
    setImportError(null)
    setImportResult(null)

    const words = rows.map((row) => {
      const exampleNasa = row.exampleNasaYuwe?.trim()
      const exampleEsp = row.exampleSpanish?.trim()

      let examples: Array<{ spanish: string; nasaYuwe: string }> | null = null
      if (exampleEsp || exampleNasa) {
        examples = [{
          spanish: exampleEsp || "",
          nasaYuwe: exampleNasa || "",
        }]
      }

      return {
        nasaYuwe: row.nasaYuwe?.trim() || "",
        spanish: row.spanish?.trim() || "",
        category: row.category?.trim() || null,
        pronunciation: row.pronunciation?.trim() || null,
        culturalContext: row.culturalContext?.trim() || null,
        audioUrl: row.audioUrl?.trim() || null,
        status: row.status ? normalizeStatus(row.status) : "PUBLISHED",
        examples: examples,
      }
    })

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words }),
      })

      const data = await res.json()
      if (res.ok) {
        setImportResult(data)
        onImported()
      } else {
        setImportError(data.message || "Error al importar")
      }
    } catch {
      setImportError("Error de conexión al servidor")
    } finally {
      setIsImporting(false)
    }
  }, [csvText, onImported])

  const handleClose = useCallback(() => {
    if (!isImporting) {
      setCsvText("")
      setImportResult(null)
      setImportError(null)
      onOpenChange(false)
    }
  }, [isImporting, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar corpus
          </DialogTitle>
          <DialogDescription>
            Importa palabras al diccionario desde un archivo CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Card className="bg-muted/40">
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Formato CSV requerido:</strong> Primera fila con encabezados.
                Los campos deben estar separados por comas. Si un campo contiene comas, envuélvelo entre comillas dobles.
              </p>
              <div className="overflow-x-auto">
                <table className="text-[10px] font-mono text-muted-foreground w-full">
                  <thead>
                    <tr className="border-b border-muted-foreground/20">
                      <th className="text-left py-1 pr-3 font-semibold">Columna</th>
                      <th className="text-left py-1 pr-3 font-semibold">Obligatoria</th>
                      <th className="text-left py-1 font-semibold">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-muted-foreground/10">
                      <td className="py-1 pr-3"><code className="bg-muted px-1 rounded">Palabra_nyW</code></td>
                      <td className="py-1 pr-3 text-secondary">Sí</td>
                      <td className="py-1">Palabra en Nasa Yuwe</td>
                    </tr>
                    <tr className="border-b border-muted-foreground/10">
                      <td className="py-1 pr-3"><code className="bg-muted px-1 rounded">Palabra_esp</code></td>
                      <td className="py-1 pr-3 text-secondary">Sí</td>
                      <td className="py-1">Palabra en español</td>
                    </tr>
                    <tr className="border-b border-muted-foreground/10">
                      <td className="py-1 pr-3"><code className="bg-muted px-1 rounded">tipo1</code></td>
                      <td className="py-1 pr-3 text-muted-foreground">No</td>
                      <td className="py-1">Categoría gramatical (sustantivo, verbo…)</td>
                    </tr>
                    <tr className="border-b border-muted-foreground/10">
                      <td className="py-1 pr-3"><code className="bg-muted px-1 rounded">Ejemplo_ny</code></td>
                      <td className="py-1 pr-3 text-muted-foreground">No</td>
                      <td className="py-1">Ejemplo de uso en Nasa Yuwe</td>
                    </tr>
                    <tr className="border-b border-muted-foreground/10">
                      <td className="py-1 pr-3"><code className="bg-muted px-1 rounded">Ejemplo_esp</code></td>
                      <td className="py-1 pr-3 text-muted-foreground">No</td>
                      <td className="py-1">Ejemplo de uso en español</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3"><code className="bg-muted px-1 rounded">Estado</code></td>
                      <td className="py-1 pr-3 text-muted-foreground">No</td>
                      <td className="py-1">DRAFT / PUBLISHED / ARCHIVED (default: PUBLISHED)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono bg-muted/60 rounded p-2">
                Palabra_nyW,Palabra_esp,tipo1,Ejemplo_ny,Ejemplo_esp,Estado<br />
                kxãwã,casa,sustantivo,"Kxãwã peç weçx","La casa es grande",PUBLISHED
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>Subir archivo CSV</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="max-w-xs"
              />
              {csvText && (
                <Badge variant="secondary" className="gap-1">
                  <FileUp className="h-3 w-3" />
                  {parseCSVRows(csvText).length} filas
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>O pega el CSV aquí</Label>
            <Textarea
              placeholder="Palabra_nyW,Palabra_esp,tipo1,Ejemplo_ny,Ejemplo_esp,Estado"
              rows={6}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value)
                setImportResult(null)
                setImportError(null)
              }}
              className="font-mono text-xs"
            />
          </div>

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
                        <span className="text-tertiary">Duplicadas: <strong>{importResult.skipped}</strong></span>
                      )}
                      {importResult.errors > 0 && (
                        <span className="text-destructive">Errores: <strong>{importResult.errors}</strong></span>
                      )}
                    </div>
                    {importResult.errorRows && importResult.errorRows.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {importResult.errorRows.map((err, i) => (
                          <p key={i} className="text-[11px] text-destructive">
                            Fila {err.row}: {err.reason}
                          </p>
                        ))}
                      </div>
                    )}
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
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {importResult ? "Cerrar" : "Cancelar"}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={isImporting || !csvText.trim()}
              className="gap-2"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isImporting ? "Importando..." : "Importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}