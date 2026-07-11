import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange?.("sustantivo")}>trigger</button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

vi.mock("./WordPreviewModal", () => ({
  WordPreviewModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="preview-modal" /> : null,
}))

import { EditWordModal, type WordForEdit } from "./EditWordModal"

const mockWord: WordForEdit = {
  id: "w1",
  spanish: "Casa",
  nasaYuwe: "Yat",
  pronunciation: "yat",
  audioUrl: null,
  culturalContext: "Construcción",
  category: "sustantivo",
  status: "PUBLISHED",
}

function renderModal(word: WordForEdit | null = mockWord) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  render(
    <EditWordModal
      open={true}
      onOpenChange={onOpenChange}
      word={word}
      onSaved={onSaved}
    />
  )
  return { onOpenChange, onSaved }
}

describe("EditWordModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renders dialog title", () => {
    renderModal()
    expect(screen.getByText("Editar ficha")).toBeDefined()
  })

  it("pre-fills form with word data", () => {
    renderModal()
    expect(screen.getByDisplayValue("Casa")).toBeDefined()
    expect(screen.getByDisplayValue("Yat")).toBeDefined()
  })

  it("returns null when word is null", () => {
    const { onOpenChange, onSaved } = renderModal(null)
    expect(screen.queryByText("Editar ficha")).toBeNull()
  })

  it("shows validation error when spanish is cleared", async () => {
    renderModal()
    const user = userEvent.setup()
    const spanishInput = screen.getByDisplayValue("Casa")
    await user.clear(spanishInput)
    await user.click(screen.getByText("Guardar cambios"))
    expect(screen.getByText(/El campo «Español» es obligatorio/)).toBeDefined()
  })

  it("shows 'No se detectaron cambios' when no changes made", async () => {
    renderModal()
    const user = userEvent.setup()
    await user.click(screen.getByText("Guardar cambios"))
    expect(await screen.findByText("No se detectaron cambios")).toBeDefined()
  })

  it("sends PUT to /api/admin/words/:id on save with changes", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ id: "w1" }) as never
    )
    renderModal()
    const user = userEvent.setup()
    const spanishInput = screen.getByDisplayValue("Casa")
    await user.clear(spanishInput)
    await user.type(spanishInput, "Casita")
    await user.click(screen.getByText("Guardar cambios"))

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/words/w1",
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("shows success message after updating", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ id: "w1" }) as never
    )
    renderModal()
    const user = userEvent.setup()
    const spanishInput = screen.getByDisplayValue("Casa")
    await user.clear(spanishInput)
    await user.type(spanishInput, "Casita")
    await user.click(screen.getByText("Guardar cambios"))

    expect(await screen.findByText("Ficha actualizada correctamente")).toBeDefined()
  })

  it("shows error on API failure", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ message: "Error del servidor" }, { status: 500 }) as never
    )
    renderModal()
    const user = userEvent.setup()
    const spanishInput = screen.getByDisplayValue("Casa")
    await user.clear(spanishInput)
    await user.type(spanishInput, "Casita")
    await user.click(screen.getByText("Guardar cambios"))

    expect(await screen.findByText("Error del servidor")).toBeDefined()
  })

  it("shows Publish button when status is DRAFT", () => {
    renderModal({ ...mockWord, status: "DRAFT" })
    expect(screen.getByText("Publicar")).toBeDefined()
  })

  it("shows Archive button when status is PUBLISHED", () => {
    renderModal({ ...mockWord, status: "PUBLISHED" })
    expect(screen.getByText("Archivar")).toBeDefined()
  })

  it("shows 'Volver a publicar' button when status is ARCHIVED", () => {
    renderModal({ ...mockWord, status: "ARCHIVED" })
    expect(screen.getByText("Volver a publicar")).toBeDefined()
  })

  it("sends PATCH for status transition", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ id: "w1", status: "PUBLISHED" }) as never
    )
    renderModal({ ...mockWord, status: "DRAFT", audioUrl: "/audio/test.wav" })
    const user = userEvent.setup()
    await user.click(screen.getByText("Publicar"))

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/words/w1",
      expect.objectContaining({ method: "PATCH" })
    )
  })

  it("shows warning dialog when publishing without audio", async () => {
    renderModal({ ...mockWord, status: "DRAFT", audioUrl: null })
    const user = userEvent.setup()
    await user.click(screen.getByText("Publicar"))
    expect(await screen.findByText("Publicar sin audio")).toBeDefined()
  })

  it("calls onOpenChange(false) when Cancelar clicked", async () => {
    const { onOpenChange } = renderModal()
    const user = userEvent.setup()
    await user.click(screen.getByText("Cancelar"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})