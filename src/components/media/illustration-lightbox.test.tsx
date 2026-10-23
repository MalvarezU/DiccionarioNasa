import { describe, it, expect } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { IllustrationLightbox } from "./illustration-lightbox"

describe("IllustrationLightbox", () => {
  it("no dibuja nada sin url", () => {
    const { container } = render(<IllustrationLightbox url={null} alt="casa" />)
    expect(container.innerHTML).toBe("")
  })

  it("abre el tamaño real al hacer clic y cierra con el botón", async () => {
    const { getByRole, queryByRole } = render(
      <IllustrationLightbox url="https://cdn.test/images/abc.png" alt="casa" />
    )

    const thumb = getByRole("button", { name: /tamaño real/i })
    expect(thumb).toHaveAttribute("aria-haspopup", "dialog")
    expect(queryByRole("dialog")).toBeNull()

    fireEvent.click(thumb)
    const dialog = await Promise.resolve().then(() => getByRole("dialog"))
    expect(dialog).toBeTruthy()
    // El tamaño real usa el render canónico de la ficha
    expect(dialog.textContent ?? "").toContain("Ilustración de casa")

    fireEvent.click(getByRole("button", { name: "Close" }))
    expect(queryByRole("dialog")).toBeNull()
  })
})
