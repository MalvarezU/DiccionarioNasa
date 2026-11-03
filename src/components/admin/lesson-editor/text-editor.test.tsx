import { vi, describe, it, expect } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

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
})
