import { vi, describe, it, expect } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { EditorTextoRico, EditorToolbar } from "./text-editor"
import { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"

describe("EditorTextoRico", () => {
  it("renderiza el toolbar y el contador", async () => {
    render(<EditorTextoRico value="" onChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("toolbar")).toBeDefined())
    expect(screen.getByRole("button", { name: "Negrita" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Lista" })).toBeDefined()
    expect(screen.getByText(/0 \/ 20000/)).toBeDefined()
  })

  it("carga el markdown inicial", async () => {
    render(<EditorTextoRico value={"<h1>Titulo</h1><p>Parrafo con <strong>negrita</strong></p>"} onChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("toolbar")).toBeDefined())
    await waitFor(() => {
      const editable = document.querySelector(".ProseMirror") as HTMLElement
      expect(editable.textContent).toContain("Titulo")
      expect(editable.textContent).toContain("negrita")
    })
  })

  it("muestra el contador en rojo al exceder el límite", async () => {
    const largo = "a".repeat(20_001)
    render(<EditorTextoRico value={largo} onChange={vi.fn()} maxChars={20_000} />)
    await waitFor(() => expect(screen.getByRole("toolbar")).toBeDefined())
    expect(screen.getByText(/20001 \/ 20000/)).toBeDefined()
    const contador = screen.getByText(/20001 \/ 20000/)
    expect(contador.className).toContain("text-destructive")
  })

  it("variante mini oculta títulos y lista, muestra negrita/cursiva", async () => {
    render(<EditorTextoRico value="" onChange={vi.fn()} mini />)
    await waitFor(() => expect(screen.getByRole("toolbar")).toBeDefined())
    expect(screen.queryByRole("button", { name: "Título 1" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Título 2" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Título 3" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Lista" })).toBeNull()
    expect(screen.getByRole("button", { name: "Negrita" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Cursiva" })).toBeDefined()
  })

  it("toolbar reacciona al toggle SIN necesidad de tipear (regresión del delay)", async () => {
    // Editor real de Tiptap (sin jsdom typing): la marca se aplica en cursor
    // colapsado (stored mark) → transacción sin cambio de doc. Con el fix
    // useEditorState, el botón se pinta activo de inmediato.
    const editor = new Editor({
      extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
      content: "<p>Hola</p>",
    })
    const { unmount } = render(<EditorToolbar editor={editor} mini={false} />)
    const boton = screen.getByRole("button", { name: "Negrita" })
    expect(boton.getAttribute("aria-pressed")).toBe("false")

    editor.commands.focus("end")
    editor.commands.toggleBold()
    await waitFor(() => expect(boton.getAttribute("aria-pressed")).toBe("true"))

    editor.commands.toggleBold()
    await waitFor(() => expect(boton.getAttribute("aria-pressed")).toBe("false"))
    unmount()
    editor.destroy()
  })

  it("mini toolbar no muestra títulos ni lista", async () => {
    const editor = new Editor({
      extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
      content: "<p>Hola</p>",
    })
    const { unmount } = render(<EditorToolbar editor={editor} mini />)
    expect(screen.queryByRole("button", { name: "Título 1" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Lista" })).toBeNull()
    expect(screen.getByRole("button", { name: "Negrita" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Cursiva" })).toBeDefined()
    unmount()
    editor.destroy()
  })

  it("round-trip markdown ↔ editor no pierde títulos ni listas (sanity)", async () => {
    // Verificación indirecta: el editor carga markdown y lo muestra sin crashear.
    const md = "<h1>Saludo</h1><ul><li>uno</li><li>dos</li></ul><p><strong>negrita</strong> y <em>cursiva</em></p>"
    render(<EditorTextoRico value={md} onChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("toolbar")).toBeDefined())
    await waitFor(() => {
      const editable = document.querySelector(".ProseMirror") as HTMLElement
      expect(editable.textContent).toContain("Saludo")
      expect(editable.textContent).toContain("uno")
      expect(editable.textContent).toContain("negrita")
    })
  })

  it("paleta colapsable: trigger visible, menú oculto hasta pedirlo (full); nada en mini", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<EditorTextoRico value="" onChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("toolbar")).toBeDefined())
    const trigger = screen.getByRole("button", { name: "Color de texto" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    // Menú oculto por defecto: ni grupos, ni swatches, ni quitar.
    expect(screen.queryByRole("group", { name: "Colores estándar" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Colores de la paleta" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Color Rojo" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Quitar color" })).toBeNull()

    // Click en el trigger abre la fila existente.
    await user.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("group", { name: "Colores estándar" })).toBeDefined()
    expect(screen.getByRole("group", { name: "Colores de la paleta" })).toBeDefined()
    const etiquetas = screen
      .getAllByRole("button", { name: /^Color (?!de texto)/ })
      .map((b) => b.getAttribute("aria-label"))
    expect(etiquetas).toEqual([
      "Color Rojo",
      "Color Naranja",
      "Color Amarillo",
      "Color Verde",
      "Color Azul",
      "Color Violeta",
      "Color Slate",
      "Color Oliva",
      "Color Tierra",
      "Color Ladrillo",
    ])
    // Sin color activo, ningún swatch está presionado.
    for (const b of screen.getAllByRole("button", { name: /^Color (?!de texto)/ })) {
      expect(b.getAttribute("aria-pressed")).toBe("false")
    }
    expect(screen.getByRole("button", { name: "Quitar color" })).toBeDefined()

    // Segundo click en el trigger cierra.
    await user.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("button", { name: "Color Rojo" })).toBeNull()
    unmount()

    render(<EditorTextoRico value="" onChange={vi.fn()} mini />)
    await waitFor(() => expect(screen.getByRole("toolbar")).toBeDefined())
    expect(screen.queryByRole("button", { name: "Color de texto" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Colores estándar" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Colores de la paleta" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Color Rojo" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Quitar color" })).toBeNull()
  })

  it("Escape cierra la paleta y devuelve el foco al trigger", async () => {
    const user = userEvent.setup()
    render(<EditorTextoRico value="" onChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("toolbar")).toBeDefined())
    const trigger = screen.getByRole("button", { name: "Color de texto" })
    await user.click(trigger)
    expect(screen.getByRole("button", { name: "Color Rojo" })).toBeDefined()
    // El trigger toma foco al abrir (sin preventDefault), así Escape llega.
    expect(document.activeElement).toBe(trigger)
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("button", { name: "Color Rojo" })).toBeNull()
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(trigger)
  })

  it("mini toolbar tampoco muestra el color (EditorToolbar directo)", async () => {
    const editor = new Editor({
      extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
      content: "<p>Hola</p>",
    })
    const { unmount } = render(<EditorToolbar editor={editor} mini />)
    expect(screen.queryByRole("button", { name: "Color de texto" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Colores estándar" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Color Rojo" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Quitar color" })).toBeNull()
    unmount()
    editor.destroy()
  })

  it("swatch aplica el token y cierra; Quitar color lo remueve y cierra", async () => {
    const user = userEvent.setup()
    const { TextoColoreado } = await import("./texto-coloreado")
    const { TEXT_COLOR_TOKENS } = await import("@/lib/courses/lesson-html")
    const editor = new Editor({
      extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), TextoColoreado],
      content: "<p>Hola</p>",
    })
    const { unmount } = render(<EditorToolbar editor={editor} mini={false} />)
    // Paleta cerrada por defecto.
    expect(screen.queryByRole("button", { name: "Color Rojo" })).toBeNull()

    // Abrir, elegir Rojo: aplica el token y cierra (estilo dropdown).
    await user.click(screen.getByRole("button", { name: "Color de texto" }))
    const swatch = screen.getByRole("button", { name: "Color Rojo" })
    expect(swatch.getAttribute("aria-pressed")).toBe("false")
    editor.commands.focus("all")
    await user.click(swatch)
    expect(editor.getHTML()).toContain(`data-color="${TEXT_COLOR_TOKENS[0]}"`)
    expect(screen.queryByRole("button", { name: "Color Rojo" })).toBeNull()

    // Reabrir: el swatch activo se marca presionado; Quitar remueve y cierra.
    await user.click(screen.getByRole("button", { name: "Color de texto" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Color Rojo" }).getAttribute("aria-pressed")).toBe("true")
    )
    await user.click(screen.getByRole("button", { name: "Quitar color" }))
    expect(editor.getHTML()).not.toContain("data-color")
    expect(screen.queryByRole("button", { name: "Color Rojo" })).toBeNull()

    unmount()
    editor.destroy()
  })
})
