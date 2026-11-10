import { vi, describe, it, expect } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/courses/word-data", () => ({
  fetchWordsByIds: vi.fn(async (ids: string[]) => {
    const m = new Map()
    const data: Record<string, { id: string; spanish: string; nasaYuwe: string; pronunciation: string | null; audioUrl: string | null; culturalContext: string | null; category: string | null }> = {
      w1: { id: "w1", spanish: "Casa", nasaYuwe: "Yat", pronunciation: "yat", audioUrl: null, culturalContext: null, category: "sustantivo" },
      w2: { id: "w2", spanish: "Agua", nasaYuwe: "Yu'", pronunciation: "yu'", audioUrl: null, culturalContext: null, category: "sustantivo" },
    }
    for (const id of ids) if (data[id]) m.set(id, data[id])
    return m
  }),
}))

vi.mock("./word-picker", () => ({
  WordPicker: ({ onElegir }: { onElegir: (p: { id: string; spanish: string }) => void }) => (
    <button type="button" onClick={() => onElegir({ id: "w2", spanish: "Agua" })}>
      Agregar palabra
    </button>
  ),
}))

import { FormVocabulary } from "./block-forms"
import type { LessonBlock } from "@/lib/courses/blocks"

const block: Extract<LessonBlock, { type: "vocabulary" }> = {
  id: "v1",
  type: "vocabulary",
  wordIds: ["w1", "w2"],
}

describe("FormVocabulary", () => {
  it("muestra el contador de palabras", () => {
    render(<FormVocabulary block={block} onChange={vi.fn()} errores={[]} />)
    expect(screen.getByText(/2 palabras/)).toBeDefined()
  })

  it("muestra las fichas resueltas (español + nasa yuwe)", async () => {
    render(<FormVocabulary block={block} onChange={vi.fn()} errores={[]} />)
    await waitFor(() => expect(screen.getByText("Casa")).toBeDefined())
    expect(screen.getByText("Yat")).toBeDefined()
    expect(screen.getByText("Agua")).toBeDefined()
    expect(screen.getByText("Yu'")).toBeDefined()
  })

  it("muestra el id crudo si la palabra no se resuelve", async () => {
    const b = { ...block, wordIds: ["w999"] }
    render(<FormVocabulary block={b} onChange={vi.fn()} errores={[]} />)
    await waitFor(() => expect(screen.getByText("w999")).toBeDefined())
  })

  it("agregar sin duplicar: si ya está, no llama onChange", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    // block ya tiene w2; el picker "agrega" w2
    render(<FormVocabulary block={block} onChange={onChange} errores={[]} />)
    await user.click(screen.getByRole("button", { name: "Agregar palabra" }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("agregar nuevo añade el id al final", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const b = { ...block, wordIds: ["w1"] }
    render(<FormVocabulary block={b} onChange={onChange} errores={[]} />)
    await user.click(screen.getByRole("button", { name: "Agregar palabra" }))
    expect(onChange).toHaveBeenCalled()
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.wordIds).toEqual(["w1", "w2"])
  })

  it("quitar elimina el id", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormVocabulary block={block} onChange={onChange} errores={[]} />)
    await waitFor(() => expect(screen.getByText("Casa")).toBeDefined())
    await user.click(screen.getByRole("button", { name: "Quitar palabra Casa" }))
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.wordIds).toEqual(["w2"])
  })

  it("mover reordena", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormVocabulary block={block} onChange={onChange} errores={[]} />)
    await waitFor(() => expect(screen.getByText("Casa")).toBeDefined())
    await user.click(screen.getAllByRole("button", { name: "Bajar palabra" })[0]!)
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.wordIds).toEqual(["w2", "w1"])
  })

  it("mover arriba deshabilitado en el primero", () => {
    render(<FormVocabulary block={block} onChange={vi.fn()} errores={[]} />)
    const btns = screen.getAllByRole("button", { name: "Subir palabra" })
    expect(btns[0]).toBeDisabled()
  })

  it("empty state cuando no hay palabras", () => {
    const b = { ...block, wordIds: [] }
    render(<FormVocabulary block={b} onChange={vi.fn()} errores={[]} />)
    expect(screen.getByText(/Todavía no hay palabras/)).toBeDefined()
  })

  it("muestra ErroresBloque si hay errores", () => {
    render(<FormVocabulary block={block} onChange={vi.fn()} errores={["falta palabra"]} />)
    expect(screen.getByText(/falta palabra/)).toBeDefined()
  })
})
