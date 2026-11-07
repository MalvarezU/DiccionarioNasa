"use client"

import { useState, useEffect, useRef } from "react"
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  GripVertical,
  Headphones,
  Image as IconoImagen,
  Layers,
  ListChecks,
  Loader2,
  Music,
  Save,
  Trash2,
  Type as IconoTexto,
  Youtube,
  type LucideIcon,
} from "lucide-react"
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { BlockType, LessonBlock } from "@/lib/courses/blocks"
import { PLANTILLAS_LECCION } from "@/lib/courses/templates"
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
import { FormQuiz, FormListening } from "./block-forms-interactive"
import { LessonPreview } from "./lesson-preview"
import { SortableBlock } from "./sortable-block"

/**
 * Editor de contenido de una lección: título + secuencia de bloques +
 * vista previa que ES el render del estudiante.
 *
 * Compuesto a propósito (venimos de desarmar 8 componentes dioses): la lógica
 * de estado vive en useLessonEditor, cada tipo de bloque tiene su formulario
 * en block-forms*, la red vive en los pickers y acá queda solo el ensamblado.
 */

type GrupoBloque = "contenido" | "actividades"

const TIPOS_NUEVOS: Array<{ type: BlockType; label: string; icon: LucideIcon; grupo: GrupoBloque }> = [
  { type: "text", label: "Texto", icon: IconoTexto, grupo: "contenido" },
  { type: "image", label: "Imagen", icon: IconoImagen, grupo: "contenido" },
  { type: "audio", label: "Audio", icon: Music, grupo: "contenido" },
  { type: "video", label: "Video", icon: Youtube, grupo: "contenido" },
  { type: "word", label: "Palabra", icon: BookOpen, grupo: "contenido" },
  { type: "vocabulary", label: "Vocabulario", icon: Layers, grupo: "contenido" },
  { type: "quiz", label: "Quiz", icon: ListChecks, grupo: "actividades" },
  { type: "listening", label: "Escucha", icon: Headphones, grupo: "actividades" },
]

// Mismo mapa para la paleta y las filas: el icono de cada tipo sale de acá.
const META_TIPO_BLOQUE: Record<BlockType, { label: string; icon: LucideIcon }> = Object.fromEntries(
  TIPOS_NUEVOS.map((t) => [t.type, { label: t.label, icon: t.icon }]),
) as Record<BlockType, { label: string; icon: LucideIcon }>

const GRUPOS_PALETA: Array<{ id: string; titulo: string; grupo: GrupoBloque }> = [
  { id: "paleta-grupo-contenido", titulo: "Contenido", grupo: "contenido" },
  { id: "paleta-grupo-actividades", titulo: "Actividades", grupo: "actividades" },
]

// Icono de cada plantilla del estado vacío, coherente con el tipo que crea.
const ICONO_PLANTILLA: Record<string, LucideIcon> = {
  texto: FileText,
  quiz: ListChecks,
}

const ETIQUETA_TIPO: Record<string, string> = {
  text: "Texto",
  image: "Imagen",
  audio: "Audio",
  video: "Video",
  word: "Palabra",
  vocabulary: "Vocabulario",
  quiz: "Quiz",
  listening: "Escucha",
}

export function LessonEditor({
  lessonId,
  initialTitle,
  initialBlocks,
  onGuardado,
  onBloquesChange,
  onDirtyChange,
  ocultarVistaPrevia = false,
  onGuardarRef,
  onUndoRedoRef,
}: {
  lessonId: string
  initialTitle: string
  initialBlocks?: LessonBlock[]
  onGuardado?: () => void
  onBloquesChange?: (blocks: LessonBlock[]) => void
  /** Notifica cambios de `dirty` (para el guard de navegación de la página). */
  onDirtyChange?: (dirty: boolean) => void
  /** En la página del editor la vista previa es un modo in-page, no un dialog. */
  ocultarVistaPrevia?: boolean
  onGuardarRef?: (fn: (motivo?: "manual" | "auto") => Promise<void>) => void
  onUndoRedoRef?: (undo: () => void, redo: () => void, puedeDeshacer: boolean, puedeRehacer: boolean) => void
}) {
  const editor = useLessonEditor({ title: initialTitle, blocks: initialBlocks })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Ref estable: el padre puede pasar un callback inline sin disparar el
  // efecto en cada render (el loop "Maximum update depth" ya ocurrió una vez).
  const onBloquesRef = useRef(onBloquesChange)
  useEffect(() => {
    onBloquesRef.current = onBloquesChange
  })
  useEffect(() => {
    onBloquesRef.current?.(editor.blocks)
  }, [editor.blocks])
  const onDirtyRef = useRef(onDirtyChange)
  useEffect(() => {
    onDirtyRef.current = onDirtyChange
  })
  useEffect(() => {
    onDirtyRef.current?.(editor.dirty)
  }, [editor.dirty])

  // Exponer guardar y undo/redo al padre (auto-save + teclado global)
  useEffect(() => {
    onGuardarRef?.(guardar)
  }, [guardar, onGuardarRef])
  useEffect(() => {
    onUndoRedoRef?.(editor.undo, editor.redo, editor.puedeDeshacer, editor.puedeRehacer)
  }, [editor.undo, editor.redo, editor.puedeDeshacer, editor.puedeRehacer, onUndoRedoRef])
  const [guardando, setGuardando] = useState(false)
  const [previewAbierta, setPreviewAbierta] = useState(false)
  const { toast } = useToast()

  async function guardar(motivo: "manual" | "auto" = "manual") {
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
          description: body.message ?? "Revisa los errores en los bloques",
          variant: "destructive",
        })
        return
      }
      editor.markSaved()
      // El auto-guardado ya se confirma con el badge del header;
      // solo el guardado manual (o un error) merece un toast.
      if (motivo === "manual") toast({ title: "Lección guardada" })
      onGuardado?.()
    } catch {
      toast({
        title: "No se pudo guardar",
        description: "Error de red. Intenta de nuevo.",
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
          <div className="space-y-3 rounded-lg border border-dashed border-outline-variant/40 px-4 py-6">
            <p className="text-center text-sm text-muted-foreground">
              Empezá desde una plantilla o agregá un bloque.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PLANTILLAS_LECCION.filter((p) => p.id !== "vacia").map((p) => {
                const IconoPlantilla = ICONO_PLANTILLA[p.id] ?? FileText
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => editor.setBlocks(p.bloques)}
                    className="flex items-start gap-2.5 rounded-md border border-outline-variant/30 bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    data-testid={`plantilla-${p.id}`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <IconoPlantilla className="size-4" aria-hidden="true" />
                    </span>
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium">{p.nombre}</span>
                      <span className="text-xs text-muted-foreground">{p.descripcion}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e: DragEndEvent) => {
              const { active, over } = e
              if (over && active.id !== over.id) {
                editor.reorder(String(active.id), String(over.id))
              }
            }}
          >
            <SortableContext items={editor.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-3">
                {editor.blocks.map((block, i) => (
                  <SortableBlock key={block.id} id={block.id}>
                    {({ setNodeRef, style, attributes, listeners }) => (
                      <li
                        ref={setNodeRef}
                        style={style}
                        data-testid={`block-card-${block.id}`}
                        className={
                          editor.erroresPorBloque[block.id]
                            ? "rounded-lg border border-destructive/50 bg-background p-3"
                            : "rounded-lg border border-outline-variant/30 bg-background p-3"
                        }
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <button
                            type="button"
                            {...attributes}
                            {...listeners}
                            className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
                            aria-label={`Arrastrar bloque ${i + 1}`}
                          >
                            <GripVertical className="size-4" />
                          </button>
                          <span className="text-xs text-muted-foreground">{i + 1}.</span>
                          {(() => {
                            const meta = META_TIPO_BLOQUE[block.type as BlockType]
                            const IconoTipo = meta?.icon
                            return (
                              <Badge variant="secondary" className="gap-1">
                                {IconoTipo ? <IconoTipo className="size-3" aria-hidden="true" /> : null}
                                {ETIQUETA_TIPO[block.type] ?? block.type}
                              </Badge>
                            )
                          })()}
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
                    )}
                  </SortableBlock>
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Agregar bloque */}
      {editor.blocks.length >= 100 ? (
        <p className="mb-2 text-xs text-destructive" role="status">
          Alcanzaste el máximo de 100 bloques por lección.
        </p>
      ) : null}
      <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-2">
        <span className="mb-2 block text-xs font-semibold text-muted-foreground">
          Agregar bloque
        </span>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          {GRUPOS_PALETA.map((g) => (
            <div key={g.grupo} role="group" aria-labelledby={g.id} className="min-w-0 flex-1">
              <p id={g.id} className="mb-1.5 text-xs font-semibold text-muted-foreground">
                {g.titulo}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS_NUEVOS.filter((t) => t.grupo === g.grupo).map((t) => {
                  const IconoTipo = t.icon
                  return (
                    <Button
                      key={t.type}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editor.addBlock(t.type)}
                      disabled={editor.blocks.length >= 100}
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <IconoTipo className="size-4" aria-hidden="true" />
                      </span>
                      {t.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
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

      {/* Acciones: sticky-bottom para que Guardar esté siempre a mano */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-outline-variant/30 bg-background/95 py-3 backdrop-blur">
        <Button type="button" onClick={() => void guardar("manual")} disabled={!editor.valido || guardando}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar lección
        </Button>

        {!ocultarVistaPrevia && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewAbierta(true)}
            aria-label="Vista previa: exactamente lo que verá el estudiante"
            title="Vista previa: exactamente lo que verá el estudiante"
          >
            <Eye className="size-4" />
            Vista previa
          </Button>
        )}

        {editor.dirty ? (
          <span className="text-xs text-muted-foreground" aria-live="polite">Cambios sin guardar</span>
        ) : null}
      </div>

      {/* Vista previa real: Dialog a pantalla amplia con el mismo render del estudiante.
          En la página del editor no se usa (la vista previa es un modo in-page). */}
      {!ocultarVistaPrevia && (
        <Dialog open={previewAbierta} onOpenChange={setPreviewAbierta}>
          <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vista previa — {editor.title || "Lección"}</DialogTitle>
              <DialogDescription>
                Exactamente lo que verá el estudiante. Los quiz y la escucha son
                jugables; completarlos no guarda progreso (es solo vista previa).
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-outline-variant/20 bg-background p-4">
              <LessonPreview blocks={editor.blocks} interactive />
            </div>
          </DialogContent>
        </Dialog>
      )}
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
  }
}
