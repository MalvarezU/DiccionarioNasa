"use client"

import { useState } from "react"
import { Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { LessonBlock, MediaRef } from "@/lib/courses/blocks"
import { WordPicker, type PalabraEncontrada } from "./word-picker"
import { MediaPicker } from "./media-picker"

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
      <Label htmlFor={`texto-${block.id}`}>Texto de la lección (markdown: # título, - lista, **negrita**, *cursiva*)</Label>
      <Textarea
        id={`texto-${block.id}`}
        value={block.markdown}
        onChange={(e) => onChange({ ...block, markdown: e.target.value })}
        rows={6}
        placeholder={"# El saludo\n\nEn Nasa Yuwe el saludo cambia según la hora…\n\n- *wii* — mañana\n- *yuwe* — tarde"}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
  const esYoutube = block.media.source === "youtube"

  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-lg border border-outline-variant/40 p-1 w-fit">
        <Button
          type="button"
          size="sm"
          variant={!esYoutube ? "secondary" : "ghost"}
          onClick={() => onChange({ ...block, media: { source: "upload" } })}
        >
          Subir archivo
        </Button>
        <Button
          type="button"
          size="sm"
          variant={esYoutube ? "secondary" : "ghost"}
          onClick={() => onChange({ ...block, media: { source: "youtube" } })}
        >
          YouTube
        </Button>
      </div>

      {!esYoutube ? (
        <div>
          <Input
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg"
            className="h-9 w-auto max-w-[16rem] text-xs"
            aria-label="Elegir audio del dispositivo"
            disabled
          />
          <p className="mt-1 text-xs text-muted-foreground">
            El audio subido se conecta con el flujo de audio existente (por ahora elegí YouTube).
          </p>
        </div>
      ) : (
        <div>
          <Label htmlFor={`audio-yt-${block.id}`}>ID de YouTube</Label>
          <Input
            id={`audio-yt-${block.id}`}
            value={block.media.youtubeId ?? ""}
            onChange={(e) => onChange({ ...block, media: { source: "youtube", youtubeId: e.target.value } })}
            placeholder="dQw4w9WgXcQ"
          />
        </div>
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
        El video es por YouTube, como elegiste. Pegá el ID de la URL (los 11 caracteres).
      </p>
      <div className="grid gap-2">
        <div>
          <Label htmlFor={`video-yt-${block.id}`}>ID de YouTube</Label>
          <Input
            id={`video-yt-${block.id}`}
            value={block.youtubeId}
            onChange={(e) => onChange({ ...block, youtubeId: e.target.value })}
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
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Lista de vocabulario: cada palabra aparece como ficha con audio.
      </p>

      {block.wordIds.length > 0 ? (
        <ul className="space-y-1">
          {block.wordIds.map((id, i) => (
            <li key={`${block.id}-${id}`} className="flex items-center gap-2 rounded-md bg-surface-container-low px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className="font-mono text-xs">{id}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive"
                onClick={() => onChange({ ...block, wordIds: block.wordIds.filter((w) => w !== id) })}
                aria-label={`Quitar palabra ${id}`}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

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

/** Errores de validación de ESTE bloque, con las rutas del contrato. */
export function ErroresBloque({ errores }: { errores: string[] }) {
  if (errores.length === 0) return null
  return (
    <ul className="space-y-1 text-xs text-destructive" role="alert">
      {errores.map((e, i) => (
        <li key={i}>• {e}</li>
      ))}
    </ul>
  )
}
