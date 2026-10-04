"use client"

import { useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { BlockType, LessonBlock } from "@/lib/courses/blocks"
import { useLessonEditor } from "./use-lesson-editor"
import {
  FormText,
  FormImage,
  FormAudio,
  FormVideo,
  FormWord,
  FormVocabulary,
  ErroresBloque,
} from "./block-forms"
import { FormQuiz, FormListening, FormGame } from "./block-forms-interactive"
import { LessonPreview } from "./lesson-preview"

/**
 * Editor de contenido de una lección: título + secuencia de bloques +
 * vista previa que ES el render del estudiante.
 *
 * Compuesto a propósito (venimos de desarmar 8 componentes dioses): la lógica
 * de estado vive en useLessonEditor, cada tipo de bloque tiene su formulario
 * en block-forms*, la red vive en los pickers y acá queda solo el ensamblado.
 */

const TIPOS_NUEVOS: Array<{ type: BlockType; label: string }> = [
  { type: "text", label: "Texto" },
  { type: "image", label: "Imagen" },
  { type: "audio", label: "Audio" },
  { type: "video", label: "Video" },
  { type: "word", label: "Palabra" },
  { type: "vocabulary", label: "Vocabulario" },
  { type: "quiz", label: "Quiz" },
  { type: "listening", label: "Escucha" },
  { type: "game", label: "Juego" },
]

const ETIQUETA_TIPO: Record<string, string> = {
  text: "Texto",
  image: "Imagen",
  audio: "Audio",
  video: "Video",
  word: "Palabra",
  vocabulary: "Vocabulario",
  quiz: "Quiz",
  listening: "Escucha",
  game: "Juego",
  "legacy-quiz-words": "Quiz legacy (palabras)",
  "legacy-complete-word": "Ejercicio legacy",
}

export function LessonEditor({
  lessonId,
  initialTitle,
  initialBlocks,
  onGuardado,
}: {
  lessonId: string
  initialTitle: string
  initialBlocks?: LessonBlock[]
  onGuardado?: () => void
}) {
  const editor = useLessonEditor({ title: initialTitle, blocks: initialBlocks })
  const [guardando, setGuardando] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const { toast } = useToast()

  async function guardar() {
    if (!editor.valido || !editor.documento) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editor.title.trim() || undefined,
          content: editor.documento,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        message?: string
        errors?: string[]
      }
      if (!res.ok) {
        toast({
          title: "No se pudo guardar",
          description: body.message ?? "Revisá los errores en los bloques",
          variant: "destructive",
        })
        return
      }
      editor.markSaved()
      toast({ title: "Lección guardada" })
      onGuardado?.()
    } catch {
      toast({
        title: "No se pudo guardar",
        description: "Error de red. Intentá de nuevo.",
        variant: "destructive",
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Título */}
      <div>
        <Label htmlFor="lesson-title">Título de la lección</Label>
        <Input
          id="lesson-title"
          value={editor.title}
          onChange={(e) => editor.setTitle(e.target.value)}
          placeholder="Lección 1.1: Casa y Agua"
        />
      </div>

      {/* Bloques */}
      <div className="space-y-3">
        {editor.blocks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-outline-variant/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Agregá el primer bloque de la lección.
          </p>
        ) : (
          <ol className="space-y-3">
            {editor.blocks.map((block, i) => (
              <li
                key={block.id}
                data-testid={`block-card-${block.id}`}
                className={
                  editor.erroresPorBloque[block.id]
                    ? "rounded-lg border border-destructive/50 bg-background p-3"
                    : "rounded-lg border border-outline-variant/30 bg-background p-3"
                }
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{i + 1}.</span>
                  <Badge variant="secondary">{ETIQUETA_TIPO[block.type] ?? block.type}</Badge>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => editor.moveBlock(block.id, -1)}
                      disabled={i === 0}
                      aria-label={`Mover bloque ${i + 1} arriba`}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => editor.moveBlock(block.id, 1)}
                      disabled={i === editor.blocks.length - 1}
                      aria-label={`Mover bloque ${i + 1} abajo`}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => editor.removeBlock(block.id)}
                      aria-label={`Quitar bloque ${i + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <FormDeBloque
                  block={block}
                  onChange={(next) => editor.setBlock(block.id, next)}
                  errores={editor.erroresPorBloque[block.id] ?? []}
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Agregar bloque */}
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low p-2">
        <span className="w-full text-xs font-semibold text-muted-foreground">
          Agregar bloque
        </span>
        {TIPOS_NUEVOS.map((t) => (
          <Button
            key={t.type}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editor.addBlock(t.type)}
            disabled={editor.blocks.length >= 100}
          >
            <Plus className="size-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      {/* Errores globales */}
      {editor.errores.length > 0 ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3" role="alert">
          <p className="text-sm font-semibold text-destructive">
            Hay bloques con errores — no se puede guardar todavía:
          </p>
          <ErroresBloque errores={editor.errores} />
        </div>
      ) : null}

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={guardar} disabled={!editor.valido || guardando}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar lección
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewVisible((v) => !v)}
          aria-pressed={previewVisible}
        >
          {previewVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {previewVisible ? "Ocultar vista previa" : "Vista previa"}
        </Button>

        {editor.dirty ? (
          <span className="text-xs text-muted-foreground">Cambios sin guardar</span>
        ) : null}
      </div>

      {/* Vista previa: el MISMO render del estudiante */}
      {previewVisible ? (
        <section aria-label="Vista previa de la lección" className="rounded-lg border border-outline-variant/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Así la ve el estudiante
          </p>
          <LessonPreview blocks={editor.blocks} interactive={false} />
        </section>
      ) : null}
    </div>
  )
}

function FormDeBloque({
  block,
  onChange,
  errores,
}: {
  block: LessonBlock
  onChange: (next: LessonBlock) => void
  errores: string[]
}) {
  switch (block.type) {
    case "text":
      return <FormText block={block} onChange={onChange} errores={errores} />
    case "image":
      return <FormImage block={block} onChange={onChange} errores={errores} />
    case "audio":
      return <FormAudio block={block} onChange={onChange} errores={errores} />
    case "video":
      return <FormVideo block={block} onChange={onChange} errores={errores} />
    case "word":
      return <FormWord block={block} onChange={onChange} errores={errores} />
    case "vocabulary":
      return <FormVocabulary block={block} onChange={onChange} errores={errores} />
    case "quiz":
      return <FormQuiz block={block} onChange={onChange} errores={errores} />
    case "listening":
      return <FormListening block={block} onChange={onChange} errores={errores} />
    case "game":
      return <FormGame block={block} onChange={onChange} errores={errores} />
    // Legacy: solo lectura. El backfill los crea; la limpieza posterior los migra.
    case "legacy-quiz-words":
      return (
        <p className="text-sm text-muted-foreground">
          Quiz de la versión anterior con {block.words.length} palabra(s). No es editable;
          convertilo agregando un quiz nuevo y quitando este bloque.
        </p>
      )
    case "legacy-complete-word":
      return (
        <p className="text-sm text-muted-foreground">
          Ejercicio de la versión anterior. No es editable; convertilo agregando
          una actividad nueva y quitando este bloque.
        </p>
      )
  }
}
