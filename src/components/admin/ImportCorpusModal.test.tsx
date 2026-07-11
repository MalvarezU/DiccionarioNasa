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

  it("renders dialog title", () => {
    renderModal()
    expect(screen.getByText("Importar corpus")).toBeDefined()
  })

  it("shows file upload label", () => {
    renderModal()
    expect(screen.getByText("Subir archivo CSV")).toBeDefined()
  })

  it("shows file upload area", () => {
    renderModal()
    const fileInputs = document.querySelectorAll('input[type="file"]')
    expect(fileInputs.length).toBeGreaterThan(0)
  })

  it("calls onOpenChange(false) when cancel clicked", async () => {
    const { onOpenChange } = renderModal()
    const cancelBtn = screen.getByText("Cancelar")
    await userEvent.setup().click(cancelBtn)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})