"use client"

import { useState, useEffect } from "react"
import { Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { GripVertical } from "lucide-react"
import { extraerYoutubeId, LIMITS, type LessonBlock } from "@/lib/courses/blocks"
import { WordPicker, type PalabraEncontrada } from "./word-picker"
import { MediaPicker } from "@/components/media/media-picker"
import { AudioPicker } from "@/components/media/audio-picker"
import { EditorTextoRico } from "./text-editor"
import { fetchWordsByIds, type CourseWordData } from "@/lib/courses/word-data"

/**
 * Formularios de los bloques PRESENTACIONALES del editor:
 * text, image, audio, video, word, vocabulary.
 *
 * Convención: cada formulario recibe el bloque y un `onChange` que reemplaza
 * el bloque entero. El hook del editor es tonto; los formularios saben
 * construir su bloque nuevo. Así no hay estado duplicado.
 */

export type BlockFormProps<B extends LessonBlock> = {
  block: B
  onChange: (next: LessonBlock) => void
  errores: string[]
}

export function FormText({ block, onChange, errores }: BlockFormProps<Extract<LessonBlock, { type: "text" }>>) {
  return (
    <div className="space-y-2">
      <Label id={`label-texto-${block.id}`}>Texto de la lección</Label>
      <p className="text-xs text-muted-foreground">
        Escribe como en Word: usa los botones para títulos, negrita, cursiva y listas. El texto se guarda con formato básico (títulos, negrita, listas) y el estudiante lo ve tal como lo escribís.
      </p>
      <EditorTextoRico
        value={block.html}
        onChange={(html) => onChange({ ...block, html })}
        maxChars={LIMITS.maxHtml}
        ariaLabel={`Texto del bloque ${block.id}`}
        ariaLabelledBy={`label-texto-${block.id}`}
      />
      <ErroresBloque errores={errores} />
    </div>
  )
}

export function FormImage({ block, onChange, errores }: BlockFormProps<Extract<LessonBlock, { type: "image" }>>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        {block.url ? (
          <Badge variant="secondary">Imagen lista</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Sin imagen aún</span>
        )}
      </div>

      {block.url ? (
        <div className="flex items-center gap-3">
          <img src={block.url} alt={block.alt || ""} className="h-16 w-24 rounded-md object-cover" />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...block, url: "", alt: "" })}>
            Quitar
          </Button>
        </div>
      ) : (
        <MediaPicker
          etiqueta="Subir imagen del bloque"
          onSubida={(url) => onChange({ ...block, url })}
          onCancelar={undefined}
        />
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`alt-${block.id}`}>Texto alternativo (obligatorio)</Label>
          <Input
            id={`alt-${block.id}`}
            value={block.alt}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            placeholder="Qué muestra la imagen"
          />
        </div>
        <div>
          <Label htmlFor={`cap-${block.id}`}>Leyenda (opcional)</Label>
          <Input
            id={`cap-${block.id}`}
            value={block.caption ?? ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
            placeholder="Texto debajo de la imagen"
          />
        </div>
      </div>
      <ErroresBloque errores={errores} />
    </div>
  )
}

export function FormAudio({ block, onChange, errores }: BlockFormProps<Extract<LessonBlock, { type: "audio" }>>) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        El audio se sube como archivo (se comprime a Opus antes de enviar). YouTube es solo para videos.
      </p>
      {block.media.url ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Audio listo</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...block, media: { source: "upload" } })}
            >
              Quitar
            </Button>
          </div>
          <audio
            controls
            src={block.media.url}
            className="w-full"
            aria-label={block.title || "Audio del bloque"}
          />
        </div>
      ) : (
        <AudioPicker
          etiqueta="Subir audio del bloque"
          onSubida={(url) => onChange({ ...block, media: { source: "upload", url } })}
        />
      )}

      <div>
        <Label htmlFor={`audio-tit-${block.id}`}>Título (obligatorio, accesible para lectores de pantalla)</Label>
        <Input
          id={`audio-tit-${block.id}`}
          value={block.title ?? ""}
          onChange={(e) => onChange({ ...block, title: e.target.value || undefined })}
          placeholder="Narración de la lección"
        />
      </div>
      <ErroresBloque errores={errores} />
    </div>
  )
}

export function FormVideo({ block, onChange, errores }: BlockFormProps<Extract<LessonBlock, { type: "video" }>>) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Los videos solo se añaden desde YouTube. Pegá el ID o la URL completa (se extraen los 11 caracteres).
      </p>
      <div className="grid gap-2">
        <div>
          <Label htmlFor={`video-yt-${block.id}`}>ID de YouTube</Label>
          <Input
            id={`video-yt-${block.id}`}
            value={block.youtubeId}
            onChange={(e) => onChange({ ...block, youtubeId: extraerYoutubeId(e.target.value) })}
            placeholder="dQw4w9WgXcQ"
          />
        </div>
        <div>
          <Label htmlFor={`video-tit-${block.id}`}>Título (obligatorio, accesible)</Label>
          <Input
            id={`video-tit-${block.id}`}
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Clase en video"
          />
        </div>
      </div>
      <ErroresBloque errores={errores} />
    </div>
  )
}

export function FormWord({ block, onChange, errores }: BlockFormProps<Extract<LessonBlock, { type: "word" }>>) {
  const [pickerAbierto, setPickerAbierto] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {block.wordId ? (
          <Badge variant="secondary">Palabra seleccionada: {block.wordId}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Sin palabra elegida</span>
        )}
        {block.wordId ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...block, wordId: "" })}>
            Cambiar
          </Button>
        ) : null}
      </div>

      {!block.wordId && !pickerAbierto ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerAbierto(true)}>
          Buscar palabra…
        </Button>
      ) : null}

      {pickerAbierto && !block.wordId ? (
        <WordPicker
          etiquetaTitulo="Elegir la palabra de la lección"
          onCerrar={() => setPickerAbierto(false)}
          onElegir={(p: PalabraEncontrada) => {
            onChange({ ...block, wordId: p.id })
            setPickerAbierto(false)
          }}
        />
      ) : null}

      <ErroresBloque errores={errores} />
    </div>
  )
}

export function FormVocabulary({
  block,
  onChange,
  errores,
}: BlockFormProps<Extract<LessonBlock, { type: "vocabulary" }>>) {
  const [palabras, setPalabras] = useState<Map<string, CourseWordData>>(new Map())

  useEffect(() => {
    let alive = true
    if (block.wordIds.length === 0) {
      void Promise.resolve().then(() => {
        if (alive) setPalabras(new Map())
      })
      return () => {
        alive = false
      }
    }
    fetchWordsByIds(block.wordIds).then((m) => {
      if (alive) setPalabras(m)
    })
    return () => {
      alive = false
    }
  }, [block.wordIds.join(",")])

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= block.wordIds.length) return
    const ids = [...block.wordIds]
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    onChange({ ...block, wordIds: ids })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Lista de vocabulario: cada palabra aparece como ficha con audio. {block.wordIds.length} palabra
        {block.wordIds.length === 1 ? "" : "s"}.
      </p>

      {block.wordIds.length > 0 ? (
        <ul className="space-y-2">
          {block.wordIds.map((id, i) => {
            const w = palabras.get(id)
            return (
              <li
                key={`${block.id}-${id}`}
                className="flex items-center gap-2 rounded-md border border-outline-variant/30 bg-surface-container-low px-3 py-2"
              >
                <span className="cursor-grab text-muted-foreground" aria-hidden="true">
                  <GripVertical className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  {w ? (
                    <>
                      <p className="text-sm font-medium">{w.spanish}</p>
                      <p className="text-xs text-muted-foreground">{w.nasaYuwe}</p>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">{id}</span>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label="Subir palabra"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => mover(i, 1)}
                  disabled={i === block.wordIds.length - 1}
                  aria-label="Bajar palabra"
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => onChange({ ...block, wordIds: block.wordIds.filter((w) => w !== id) })}
                  aria-label={`Quitar palabra ${w?.spanish ?? id}`}
                >
                  Quitar
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-outline-variant/40 px-4 py-3 text-center text-sm text-muted-foreground">
          Todavía no hay palabras. Buscá una abajo para agregarla.
        </p>
      )}

      <WordPicker
        etiquetaTitulo="Agregar palabra al vocabulario"
        onElegir={(p: PalabraEncontrada) => {
          if (!block.wordIds.includes(p.id)) {
            onChange({ ...block, wordIds: [...block.wordIds, p.id] })
          }
        }}
      />

      <ErroresBloque errores={errores} />
    </div>
  )
}

export function ErroresBloque({ errores }: { errores: string[] }) {
  if (errores.length === 0) return null
  return (
    <ul className="space-y-1 text-xs text-destructive">
      {errores.map((e, i) => (
        <li key={i}>• {e}</li>
      ))}
    </ul>
  )
}
