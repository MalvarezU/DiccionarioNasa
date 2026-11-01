"use client"

/**
 * Editor de texto rico para el bloque `text` de una lección.
 *
 * El docente escribe como en Word (botones: título, negrita, cursiva, lista);
 * lo que se guarda en la BD sigue siendo el markdown de siempre, porque el
 * render del estudiante es el mismo `markdown-lite` de siempre. El editor es
 * la única superficie que cambia: la puerta de entrada.
 *
 * Tiptap v3 + `tiptap-markdown` (serializador round-trip). El editor es
 * client-only (Next SSR apagado con `immediatelyRender: false`).
 */

import { useEffect, useRef } from "react"
import { useEditor, useEditorState, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TEXT_BLOCK_PROSE } from "@/lib/courses/lesson-html"
import { Bold, Heading1, Heading2, Heading3, Italic, List, Redo2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface EditorTextoRicoProps {
  /** Markdown actual del bloque. */
  value: string
  /** Se llama con el markdown serializado tras cada cambio. */
  onChange: (markdown: string) => void
  /** Límite de caracteres (markdown). Por defecto 20.000. */
  maxChars?: number
  disabled?: boolean
  ariaLabel?: string
  ariaLabelledBy?: string
  /** Variante compacta: solo negrita/cursiva, altura reducida. */
  mini?: boolean
}

export function EditorTextoRico({
  value,
  onChange,
  maxChars = 20_000,
  disabled = false,
  ariaLabel = "Texto de la lección",
  ariaLabelledBy,
  mini = false,
}: EditorTextoRicoProps) {
  /** Último markdown que ESTE editor leyó o emitió. null al montar. */
  /** Último HTML que ESTE editor leyó o emitió. null al montar. */
  const ultimoHtml = useRef<string | null>(null)

  const editor = useEditor({
    // Solo lo que el lector ya sabe renderizar (markdown-lite). Lo que no
    // soporta se desactiva para que nada que el docente escriba desaparezca
    // con sorpresa al ver la lección publicada.
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        orderedList: false,
        strike: false,
        link: false,
        trailingNode: false,
        dropcursor: false,
        gapcursor: false,
        underline: false,
        heading: mini ? false : { levels: [1, 2, 3] },
        bulletList: mini ? false : undefined,
      }),

    ],
    content: "",
    immediatelyRender: false,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (html !== ultimoHtml.current) {
        ultimoHtml.current = html
        onChange(html)
      }
    },
  })

  // Sincronizar cambios externos (carga inicial, reset).
  //
  // El guard `value === ultimoMarkdown.current` es lo que frena el modo
  // "pegado": cada tipeo produce onUpdate → onChange → el padre devuelve el
  // value. Si el value llegó es el mismo que emitimos, NO re-seteamos el
  // contenido: setContent destruye la selección/cursor y los botones dejaban
  // de aplicarse al texto ya seleccionado (negrita+cursiva lo hacía notorio).
  useEffect(() => {
    if (!editor) return
    if (value === ultimoHtml.current) return
    editor.commands.setContent(value, { emitUpdate: false })
    ultimoHtml.current = value
  }, [editor, value])

  if (!editor) {
    return (
      <div
        className="h-40 rounded-md border border-outline-variant/40 bg-muted/30"
        aria-busy="true"
        aria-label={ariaLabel}
      />
    )
  }

  // El contador se basa en el markdown que el padre conoce (el mismo que se
  // guarda). Así no depende del round-trip interno del editor para mostrarse.
  const htmlActual = value
  const excede = htmlActual.length > maxChars

  return (
    <div className="rounded-md border border-outline-variant/40 bg-background">
      <EditorToolbar editor={editor} mini={mini} />

      <EditorContent
        editor={editor}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          mini ? "min-h-[4.5rem]" : "min-h-[12rem]",
          "px-3 py-2 focus:outline-none",
          "min-h-[12rem] px-3 py-2 focus:outline-none",
          "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1.5",
          "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1",
          "[&_p]:mb-2 [&_p]:leading-relaxed",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2",
          "[&_li]:mb-0.5",
          "[&_strong]:font-bold [&_em]:italic"
        )}
      />

      <div
        className={cn(
          "flex justify-end border-t border-outline-variant/40 px-2 py-1 text-xs",
          excede ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {htmlActual.length} / {maxChars}
      </div>
    </div>
  )
}

/**
 * Boton de la toolbar: icono con aria-label + tooltip. El icono comunica la
 * funcion de un vistazo (convencion Word/Docs); el title/aria-label la
 * nombra para lectores de pantalla y tests.
 */
/**
 * Toolbar del editor, suscrita al estado del editor con `useEditorState`
 * (patrón oficial de Tiptap v3). Sin esto, el componente no se re-renderiza
 * en transacciones sin cambio de documento (toggle de marca en cursor
 * colapsado, stored marks) y los botones quedaban "pegados" un keystroke
 * detrás — el bug reportado.
 */
export function EditorToolbar({ editor, mini = false }: { editor: any; mini?: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }: { editor: any }) => ({
      isBold: editor.isActive("bold"),
      isItalic: editor.isActive("italic"),
      isH1: editor.isActive("heading", { level: 1 }),
      isH2: editor.isActive("heading", { level: 2 }),
      isH3: editor.isActive("heading", { level: 3 }),
      isList: editor.isActive("bulletList"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  })

  if (!state) return null

  return (
    <div
      role="toolbar"
      aria-label="Formato de texto"
      className="flex flex-wrap items-center gap-1 border-b border-outline-variant/40 p-1"
    >
      {!mini ? (
        <>
          <ToolbarBoton
            label="Título 1"
            icon={<Heading1 className="h-4 w-4" />}
            activo={state.isH1}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarBoton
            label="Título 2"
            icon={<Heading2 className="h-4 w-4" />}
            activo={state.isH2}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarBoton
            label="Título 3"
            icon={<Heading3 className="h-4 w-4" />}
            activo={state.isH3}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarBoton
            label="Lista"
            icon={<List className="h-4 w-4" />}
            activo={state.isList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarSeparador />
        </>
      ) : null}
      <ToolbarBoton
        label="Negrita"
        icon={<Bold className="h-4 w-4" />}
        activo={state.isBold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarBoton
        label="Cursiva"
        icon={<Italic className="h-4 w-4" />}
        activo={state.isItalic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarSeparador />
      <ToolbarBoton
        label="Deshacer"
        icon={<Undo2 className="h-4 w-4" />}
        onClick={() => editor.chain().focus().undo().run()}
        deshabilitado={!state.canUndo}
      />
      <ToolbarBoton
        label="Rehacer"
        icon={<Redo2 className="h-4 w-4" />}
        onClick={() => editor.chain().focus().redo().run()}
        deshabilitado={!state.canRedo}
      />
    </div>
  )
}

function ToolbarBoton({
  label,
  icon,
  activo = false,
  onClick,
  deshabilitado = false,
}: {
  label: string
  icon: React.ReactNode
  activo?: boolean
  onClick: () => void
  deshabilitado?: boolean
}) {
  return (
    <Button
      type="button"
      variant={activo ? "secondary" : "ghost"}
      size="icon"
      className="h-8 w-8"
      // preventDefault en mousedown: el click NO roba el foco del editor.
      // Sin esto, cada click perdía la selección y los toggles se aplicaban a
      // un cursor colapsado (stored mark): el botón quedaba "pegado" activo.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={deshabilitado}
      aria-pressed={activo}
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  )
}

/** Separador visual entre grupos de la toolbar. */
function ToolbarSeparador() {
  return (
    <div
      aria-hidden="true"
      className="mx-1 h-6 w-px shrink-0 bg-outline-variant/40"
    />
  )
}
