import { describe, it, expect } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { WordIllustration } from "./word-illustration"

/**
 * La ilustración es un componente reutilizable, así que su contrato tiene que
 * quedar fijado acá y no en cada módulo que la use: sin imagen no dibuja nada,
 * con imagen dibuja con alt derivado de la palabra, y si la carga falla cae a
 * un aviso legible en vez de dejar un hueco roto.
 */
describe("WordIllustration", () => {
  it("no renderiza nada cuando la palabra no tiene ilustración", () => {
    const { container } = render(<WordIllustration url={null} alt="casa" />)
    expect(container.innerHTML).toBe("")
  })

  it("trata la ausencia de url igual que null", () => {
    const { container } = render(<WordIllustration alt="casa" />)
    expect(container.innerHTML).toBe("")
  })

  it("renderiza la imagen con alt derivado de la palabra", () => {
    const { getByAltText } = render(<WordIllustration url="/api/media/abc123" alt="casa" />)
    const img = getByAltText("Ilustración de casa")
    expect(img.getAttribute("src")).toContain("media")
  })

  it("cae a un aviso legible si la imagen no carga", () => {
    const { getByAltText, getByText } = render(
      <WordIllustration url="/api/media/abc123" alt="casa" />
    )
    fireEvent.error(getByAltText("Ilustración de casa"))
    expect(getByText("Ilustración no disponible")).toBeTruthy()
  })
})
