import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/admin-utils", () => ({
  WORD_CATEGORIES: [{ value: "sustantivo", label: "Sustantivo" }],
}))

import { ImportCorpusModal } from "./ImportCorpusModal"

function renderModal() {
  const onOpenChange = vi.fn()
  const onImported = vi.fn()
  render(
    <ImportCorpusModal
      open={true}
      onOpenChange={onOpenChange}
      onImported={onImported}
    />
  )
  return { onOpenChange, onImported }
}

describe("ImportCorpusModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renderiza el diálogo con título, etiqueta y área de archivo", () => {
    renderModal()
    expect(screen.getByText("Importar corpus")).toBeDefined()
    expect(screen.getByText("Subir archivo Excel o CSV")).toBeDefined()
    expect(document.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0)
  })

  it("cierra el modal al pulsar Cancelar", async () => {
    const { onOpenChange } = renderModal()
    await userEvent.setup().click(screen.getByText("Cancelar"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})