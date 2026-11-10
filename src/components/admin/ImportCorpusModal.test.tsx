import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
    expect(screen.getByText("Subir archivo Excel o CSV")).toBeDefined()
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

  it("preview y confirmar: muestra vista previa, confirma y reporta", async () => {
    const { onImported } = renderModal()

    const fetchMock = vi.mocked(global.fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          fileName: "corpus.xlsx",
          columns: [{ header: "Palabra_esp", mapped: "spanish" }],
          total: 2,
          valid: 2,
          invalid: 0,
          duplicates: 0,
          errors: [],
          previewToken: "tok-1",
        }),
        { status: 200 }
      )
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          created: 2,
          skipped: 0,
          total: 2,
          report: [{ spanish: "casa", nasaYuwe: "ny", resultado: "creada (DRAFT)" }],
        }),
        { status: 200 }
      )
    )

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(["x"], "corpus.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText(/2 listas/)).toBeDefined(), { timeout: 5000 })
    const confirmBtn = screen.getByRole("button", { name: /confirmar/i })
    await userEvent.setup().click(confirmBtn)

    await waitFor(() => expect(screen.getByText(/importación completada/i)).toBeDefined(), {
      timeout: 5000,
    })
    expect(onImported).toHaveBeenCalled()
  })
})