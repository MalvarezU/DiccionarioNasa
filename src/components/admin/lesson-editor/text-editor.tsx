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

import { useEffect, useId, useRef, useState } from "react"
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TEXT_BLOCK_PROSE, TEXT_COLOR_SWATCH, TEXT_COLOR_TOKENS, type TextColorToken } from "@/lib/courses/lesson-html"
import { htmlToPlainText } from "@/lib/html-to-text"
import { TextoColoreado } from "./texto-coloreado"
import { Bold, Heading1, Heading2, Heading3, Italic, List, Palette, Redo2, Undo2, X } from "lucide-react"
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
      // Color de fuente por TOKEN en data-color (nunca style inline).
      // Va en full y en mini: así el mini no destruye colores ya guardados
      // si alguna vez recibe HTML con marca. El selector solo sale en full.
      TextoColoreado,

    ],
    content: "",
    immediatelyRender: false,
    // CRÍTICO: sin esto, el componente no se re-renderiza en transacciones
    // sin cambio de documento (toggle de marca en cursor colapsado → stored
    // mark). El botón quedaba "pegado" un keystroke detrás.
    shouldRerenderOnTransaction: true,
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
    // Las instrucciones de quiz/escucha llegan en TEXTO PLANO (el form
    // normaliza el HTML del editor al guardar). Si el documento actual tiene
    // el mismo contenido sin tags, NO resincronizar: setContent recrea el doc
    // y destruye la selección (mismo motivo del guard string de arriba: cursor
    // roto y toggles que no aplican al texto ya seleccionado).
    if (htmlToPlainText(editor.getHTML()) === htmlToPlainText(value)) {
      ultimoHtml.current = value
      return
    }
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
          // Una sola fuente de estilo para los tres lados (editor, vista previa
          // y curso). Antes se duplicaban las clases aquí y en lesson-html.ts,
          // y el editor se quedaba sin font-serif en los h1/h2/h3.
          TEXT_BLOCK_PROSE,
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
export function EditorToolbar({ editor, mini = false }: { editor: Editor | null; mini?: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e?.isActive("bold") ?? false,
      isItalic: e?.isActive("italic") ?? false,
      isH1: e?.isActive("heading", { level: 1 }) ?? false,
      isH2: e?.isActive("heading", { level: 2 }) ?? false,
      isH3: e?.isActive("heading", { level: 3 }) ?? false,
      isList: e?.isActive("bulletList") ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
      // Token de color activo (null si el cursor/selección no tiene marca).
      colorActual:
        ((e?.getAttributes("textoColoreado")?.["data-color"] as TextColorToken | undefined) ??
          null) as TextColorToken | null,
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
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarBoton
            label="Título 2"
            icon={<Heading2 className="h-4 w-4" />}
            activo={state.isH2}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarBoton
            label="Título 3"
            icon={<Heading3 className="h-4 w-4" />}
            activo={state.isH3}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarBoton
            label="Lista"
            icon={<List className="h-4 w-4" />}
            activo={state.isList}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <SelectorColor editor={editor} colorActual={state.colorActual} />
          <ToolbarSeparador />
        </>
      ) : null}
      <ToolbarBoton
        label="Negrita"
        icon={<Bold className="h-4 w-4" />}
        activo={state.isBold}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarBoton
        label="Cursiva"
        icon={<Italic className="h-4 w-4" />}
        activo={state.isItalic}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <ToolbarSeparador />
      <ToolbarBoton
        label="Deshacer"
        icon={<Undo2 className="h-4 w-4" />}
        onClick={() => editor?.chain().focus().undo().run()}
        deshabilitado={!state.canUndo}
      />
      <ToolbarBoton
        label="Rehacer"
        icon={<Redo2 className="h-4 w-4" />}
        onClick={() => editor?.chain().focus().redo().run()}
        deshabilitado={!state.canRedo}
      />
    </div>
  )
}

/** Nombres en español neutro para el selector de color. */
const NOMBRES_COLOR: Record<TextColorToken, string> = {
  rojo: "Rojo",
  naranja: "Naranja",
  amarillo: "Amarillo",
  verde: "Verde",
  azul: "Azul",
  violeta: "Violeta",
  slate: "Slate",
  oliva: "Oliva",
  tierra: "Tierra",
  ladrillo: "Ladrillo",
}

const COLORES_ESTANDAR = TEXT_COLOR_TOKENS.slice(0, 6)
const COLORES_PALETA = TEXT_COLOR_TOKENS.slice(6)

/**
 * Selector de color de fuente inline (solo full: el mini es para prompts de
 * texto plano). Botón trigger con icono Palette + barra del color activo que
 * despliega la fila horizontal de swatches circulares: primero los 6
 * estándar, separador visual, después los 4 de paleta, y al final el botón
 * para quitar el color. El wrap lleva el exceso a dos líneas en móvil.
 *
 * Comportamiento tipo dropdown de Word/Docs: elegir un color (o quitarlo)
 * lo aplica Y cierra la paleta. También se cierra con segundo click en el
 * trigger, con Escape (devuelve el foco al trigger) y al perder el foco el
 * contenedor (click fuera que mueva el foco). El estado vive aquí, no se
 * eleva al editor.
 *
 * El trigger NO usa preventDefault en mousedown (a diferencia de los
 * swatches): así recibe el foco al hacer click y funcionan Escape + onBlur.
 * La selección del editor se conserva en el estado de Tiptap y los swatches
 * la restauran con `chain().focus()` al aplicar, igual que antes.
 *
 * Aplica el TOKEN vía el mark TextoColoreado; el color real del documento lo
 * pinta globals.css. El `style` con el color en cada swatch es SOLO
 * presentación del control (el círculo del botón), nunca contenido guardado:
 * al documento solo viaja el token en `data-color`.
 */
function SelectorColor({
  editor,
  colorActual,
}: {
  editor: Editor | null
  colorActual: TextColorToken | null
}) {
  const [abierto, setAbierto] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  if (!editor) return null

  const elegir = (token: TextColorToken) => {
    editor.chain().focus().setColor(token).run()
    setAbierto(false)
  }
  const quitar = () => {
    editor.chain().focus().unsetColor().run()
    setAbierto(false)
  }
  const cerrarConFoco = () => {
    setAbierto(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      className="flex items-center"
      // Cierre barato sin listener global: si el foco sale del contenedor
      // (click en el lienzo, Tab fuera), la paleta se repliega.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          cerrarConFoco()
        }
      }}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant={abierto ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => setAbierto((v) => !v)}
        aria-pressed={abierto}
        aria-expanded={abierto}
        aria-controls={abierto ? panelId : undefined}
        aria-label="Color de texto"
        title="Color de texto"
      >
        {/* Barra estilo Word bajo el icono: muestra el color activo. */}
        <span className="flex flex-col items-center" aria-hidden="true">
          <Palette className="h-4 w-4" />
          <span
            className="mt-px h-1 w-4 rounded-full border border-border/60"
            style={{ backgroundColor: colorActual ? TEXT_COLOR_SWATCH[colorActual] : "transparent" }}
          />
        </span>
      </Button>
      {abierto ? (
        <div id={panelId} className="flex flex-wrap items-center gap-1">
          <div role="group" aria-label="Colores estándar" className="flex flex-wrap items-center gap-1">
            {COLORES_ESTANDAR.map((token) => (
              <SwatchColor
                key={token}
                token={token}
                activo={colorActual === token}
                onElegir={() => elegir(token)}
              />
            ))}
          </div>
          <div aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          <div role="group" aria-label="Colores de la paleta" className="flex flex-wrap items-center gap-1">
            {COLORES_PALETA.map((token) => (
              <SwatchColor
                key={token}
                token={token}
                activo={colorActual === token}
                onElegir={() => elegir(token)}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Quitar color"
            title="Quitar color"
            // preventDefault en mousedown: igual que ToolbarBoton, el click NO
            // debe robar el foco del editor ni destruir la selección.
            onMouseDown={(e) => e.preventDefault()}
            onClick={quitar}
            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border/60 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Swatch circular del selector. El botón ES el círculo: se pinta con el
 * color real (hex directo para estándar, `var(--token)` para paleta, desde
 * TEXT_COLOR_SWATCH). Ese style inline es presentación del control, no del
 * documento. El activo se marca con anillo.
 */
function SwatchColor({
  token,
  activo,
  onElegir,
}: {
  token: TextColorToken
  activo: boolean
  onElegir: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Color ${NOMBRES_COLOR[token]}`}
      title={NOMBRES_COLOR[token]}
      aria-pressed={activo}
      // preventDefault en mousedown: igual que ToolbarBoton, el click NO
      // debe robar el foco del editor ni destruir la selección.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onElegir}
      style={{ backgroundColor: TEXT_COLOR_SWATCH[token] }}
      className={cn(
        "size-6 shrink-0 rounded-full border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        activo && "ring-2 ring-ring ring-offset-1"
      )}
    />
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
