import { vi, describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WordPreviewModal, type PreviewWordData } from "./WordPreviewModal"

const baseWord: PreviewWordData = {
  spanish: "Casa",
  nasaYuwe: "Yat",
  pronunciation: "yat",
  culturalContext: "Construcción para habitar",
  category: "sustantivo",
  audioUrl: null,
  status: "PUBLISHED",
}

function renderModal(word: Partial<PreviewWordData> = {}) {
  const onOpenChange = vi.fn()
  render(
    <WordPreviewModal
      open={true}
      onOpenChange={onOpenChange}
      word={{ ...baseWord, ...word }}
    />
  )
  return { onOpenChange }
}

describe("WordPreviewModal", () => {
  it("renders word in spanish", () => {
    renderModal()
    expect(screen.getByText("Casa")).toBeDefined()
  })

  it("renders nasa yuwe translation", () => {
    renderModal()
    expect(screen.getByText("Yat")).toBeDefined()
  })

  it("shows pronunciation when available", () => {
    renderModal({ pronunciation: "yat" })
    expect(screen.getByText("[yat]")).toBeDefined()
  })

  it("shows 'Pronunciación no disponible' when missing", () => {
    renderModal({ pronunciation: null })
    expect(screen.getByText("Pronunciación no disponible")).toBeDefined()
  })

  it("shows cultural context when available", () => {
    renderModal({ culturalContext: "Contexto culturalTest" })
    expect(screen.getByText("Contexto culturalTest")).toBeDefined()
  })

  it("shows 'Sin información contextual' when cultural context is null", () => {
    renderModal({ culturalContext: null })
    expect(screen.getByText("Sin información contextual disponible")).toBeDefined()
  })

  it("shows PUBLISHED badge when status is PUBLISHED", () => {
    renderModal({ status: "PUBLISHED" })
    expect(screen.getByText("Publicada")).toBeDefined()
  })

  it("shows DRAFT badge when status is DRAFT", () => {
    renderModal({ status: "DRAFT" })
    expect(screen.getByText(/Borrador/)).toBeDefined()
  })

  it("shows ARCHIVED badge when status is ARCHIVED", () => {
    renderModal({ status: "ARCHIVED" })
    expect(screen.getByText("Archivada")).toBeDefined()
  })

  it("shows category badge when category is set", () => {
    renderModal({ category: "sustantivo" })
    expect(screen.getByText("Sustantivo")).toBeDefined()
  })

  it("shows 'Categoría desconocida' when no category", () => {
    renderModal({ category: null })
    expect(screen.getByText("Categoría desconocida")).toBeDefined()
  })

  it("renders audio player when audioUrl is set", () => {
    renderModal({ audioUrl: "/audio/test.wav" })
    expect(document.querySelector("audio")).toBeTruthy()
  })

  it("does not render audio player when audioUrl is null", () => {
    renderModal({ audioUrl: null })
    expect(document.querySelector("audio")).toBeNull()
  })

  it("calls onOpenChange(false) when close button clicked", async () => {
    const { onOpenChange } = renderModal()
    await userEvent.setup().click(screen.getByText("Cerrar vista previa"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows dash when spanish is empty", () => {
    renderModal({ spanish: "" })
    expect(screen.getByText("—")).toBeDefined()
  })

  it("shows dash when nasaYuwe is empty", () => {
    renderModal({ nasaYuwe: "" })
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
  })
})