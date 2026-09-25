"use client"

import { Volume2, Upload, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { type useWordAudio } from "./use-word-audio"

type Audio = ReturnType<typeof useWordAudio>

/** Sección de audio de la ficha (dropzone + estado + errores). */
export function EditWordAudio({ audio, variant = "edit" }: { audio: Audio; variant?: "edit" | "create" }) {
  const {
    audioUrl,
    audioFile,
    audioPreview,
    isUploadingAudio,
    audioError,
    isDragOver,
    audioChanged,
    originalAudioUrl,
    fileInputRef,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInputChange,
    removeAudio,
  } = audio

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-primary" />
        Audio
        {variant === "edit" && originalAudioUrl && !audioChanged && (
          <Badge variant="secondary" className="text-[10px] ml-1">Archivo actual</Badge>
        )}
        {variant === "edit" && audioChanged && (
          <Badge variant="outline" className="text-[10px] ml-1 text-tertiary bg-tertiary/10">Reemplazado</Badge>
        )}
      </Label>

      {(audioUrl || audioFile) && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                <Volume2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {audioFile ? audioFile.name : "Audio actual"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : audioUrl?.split("/").pop()}
                  {isUploadingAudio && " — Subiendo..."}
                  {audioUrl && !isUploadingAudio && (audioChanged ? " — Subido (guarda la ficha para conservarlo)" : " — Guardado")}
                </p>
              </div>
              {(variant === "create" ? !!audioFile : (audioChanged || !!originalAudioUrl)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeAudio}
                  disabled={isUploadingAudio}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  title={audioChanged ? "Restaurar audio original" : "Quitar audio"}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {((audioPreview && !isUploadingAudio) || (audioUrl && !audioFile)) && (
              <audio
                controls
                src={audioPreview || audioUrl || undefined}
                className="mt-3 w-full h-8"
                preload="metadata"
              />
            )}
            {isUploadingAudio && (
              <div className="mt-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Subiendo audio...</span>
              </div>
            )}
            {audioUrl && !isUploadingAudio && audioChanged && (
              <div className="mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                <span className="text-xs text-secondary">Audio subido correctamente</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(variant === "edit" || (!audioFile && !audioUrl)) && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-lg border-2 border-dashed text-center transition-colors
            ${variant === "create" ? "p-6" : "p-4"}
            ${isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg"
            onChange={handleFileInputChange}
            className="sr-only"
          />
          {variant === "create" ? (
            <>
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                Arrastra un archivo aquí o <span className="text-primary underline">selecciona</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                MP3, WAV u OGG — Máximo 10 MB
              </p>
            </>
          ) : (
            <>
              <Upload className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-1 text-xs text-muted-foreground">
                {audioUrl ? "Reemplazar audio" : "Subir audio"} — MP3, WAV, OGG (máx. 10 MB)
              </p>
            </>
          )}
        </div>
      )}

      {audioError && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{audioError}</p>
        </div>
      )}
    </div>
  )
}
