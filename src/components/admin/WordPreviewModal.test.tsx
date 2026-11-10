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
  it("renderiza todos los campos principales de la ficha", () => {
    renderModal()
    expect(screen.getByText("Casa")).toBeDefined()
    expect(screen.getByText("Yat")).toBeDefined()
    expect(screen.getByText("[yat]")).toBeDefined()
    expect(screen.getByText("Construcción para habitar")).toBeDefined()
    expect(screen.getByText("Sustantivo")).toBeDefined()
  })

  it("muestra los fallbacks cuando faltan campos", () => {
    renderModal({
      pronunciation: null,
      culturalContext: null,
      category: null,
      spanish: "",
      nasaYuwe: "",
    })
    expect(screen.getByText("Pronunciación no disponible")).toBeDefined()
    expect(screen.getByText("Sin información contextual disponible")).toBeDefined()
    expect(screen.getByText("Categoría desconocida")).toBeDefined()
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
  })

  it.each([
    ["PUBLISHED", "Publicada"],
    ["DRAFT", /Borrador/],
    ["ARCHIVED", "Archivada"],
  ])("muestra el badge de estado %s", (status, label) => {
    renderModal({ status: status as PreviewWordData["status"] })
    expect(screen.getByText(label)).toBeDefined()
  })

  it("renderiza el reproductor de audio cuando hay audioUrl", () => {
    renderModal({ audioUrl: "/audio/test.wav" })
    expect(document.querySelector("audio")).toBeTruthy()
  })

  it("no renderiza el reproductor de audio cuando audioUrl es null", () => {
    renderModal({ audioUrl: null })
    expect(document.querySelector("audio")).toBeNull()
  })

  it("cierra el modal al pulsar el botón de cierre", async () => {
    const { onOpenChange } = renderModal()
    await userEvent.setup().click(screen.getByText("Cerrar vista previa"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})