"use client"

import { useRef, useState } from "react"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { compressToOpus } from "@/lib/audio/compress-audio"

/**
 * Subida de audio con compresión client-side a Ogg Opus 24kbps mono.
 *
 * Espejo de MediaPicker: el input va oculto (lo abre el botón "Elegir"),
 * comprime ANTES de mandar y muestra el ahorro (original → comprimido).
 * Sube a `/api/admin/upload-audio` y devuelve la URL pública + metadatos.
 */

export type AudioUploadMeta = { objectKey?: string; size?: number }

const ACCEPT = "audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/vorbis,.mp3,.wav,.ogg"

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function AudioPicker({
  onSubida,
  onCancelar,
  etiqueta,
}: {
  onSubida: (url: string, meta?: AudioUploadMeta) => void
  onCancelar?: () => void
  etiqueta?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [detalle, setDetalle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function alElegir(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setError(null)
    setDetalle(null)
    setSubiendo(true)
    try {
      const res = await compressToOpus(file)
      if (res.ok) {
        setDetalle(`${fmtBytes(res.originalBytes)} → ${fmtBytes(res.opusBytes)} Opus`)
      }
      const fd = new FormData()
      fd.append("file", res.file)
      const up = await fetch("/api/admin/upload-audio", { method: "POST", body: fd })
      const body = (await up.json().catch(() => ({}))) as {
        audioUrl?: string
        objectKey?: string
        message?: string
      }
      if (!up.ok || !body.audioUrl) {
        throw new Error(body.message ?? "No se pudo subir el audio")
      }
      onSubida(body.audioUrl, { objectKey: body.objectKey, size: res.file.size })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el audio")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="rounded-lg border border-outline-variant/30 bg-background p-3">
      <p className="mb-2 text-sm font-semibold">{etiqueta ?? "Subir audio"}</p>
      <p className="mb-2 text-xs text-muted-foreground">
        MP3, WAV u OGG (máx. 10 MB). Se comprime a Ogg Opus 24kbps mono antes de subir.
      </p>

      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={alElegir}
          className="hidden"
          aria-label="Elegir archivo de audio"
          disabled={subiendo}
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
        >
          {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          <span className="hidden sm:inline">Elegir</span>
        </Button>
        {onCancelar ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancelar} disabled={subiendo}>
            Cancelar
          </Button>
        ) : null}
      </div>

      {detalle ? (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          Comprimido: {detalle}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
