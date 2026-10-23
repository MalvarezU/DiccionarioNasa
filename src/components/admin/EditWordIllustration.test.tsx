import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EditWordIllustration } from "./EditWordIllustration"
import type { useWordIllustration } from "./use-word-illustration"

type Illustration = ReturnType<typeof useWordIllustration>

function fakeIllustration(overrides: Partial<Illustration>): Illustration {
  return {
    illustrationUrl: null,
    originalIllustrationUrl: null,
    illustrationChanged: false,
    resetIllustration: vi.fn(),
    handleIllustrationChange: vi.fn(),
    removeIllustration: vi.fn(),
    ...overrides,
  }
}

describe("EditWordIllustration — un solo punto de entrada por estado", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sin imagen: solo botón Subir, sin picker visible", () => {
    render(<EditWordIllustration illustration={fakeIllustration({})} />)

    expect(screen.getByRole("button", { name: /subir ilustración/i })).toBeTruthy()
    expect(screen.queryByLabelText("Elegir imagen del dispositivo")).toBeNull()
    expect(screen.queryByRole("button", { name: /reemplazar/i })).toBeNull()
  })

  it("con imagen sin cambio: Reemplazar + Quitar, sin picker visible", () => {
    render(
      <EditWordIllustration
        illustration={fakeIllustration({ illustrationUrl: "https://cdn.test/a.png" })}
      />
    )

    expect(screen.getByRole("button", { name: /reemplazar/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /^quitar$/i })).toBeTruthy()
    expect(screen.queryByLabelText("Elegir imagen del dispositivo")).toBeNull()
  })

  it("Quitar llama con null (limpia la ficha)", () => {
    const handleIllustrationChange = vi.fn()
    render(
      <EditWordIllustration
        illustration={fakeIllustration({ illustrationUrl: "https://cdn.test/a.png", handleIllustrationChange })}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^quitar$/i }))
    expect(handleIllustrationChange).toHaveBeenCalledWith(null)
  })

  it("con cambio pendiente: Descartar vuelve a la original", () => {
    const removeIllustration = vi.fn()
    render(
      <EditWordIllustration
        illustration={fakeIllustration({
          illustrationUrl: "https://cdn.test/nueva.png",
          originalIllustrationUrl: "https://cdn.test/vieja.png",
          illustrationChanged: true,
          removeIllustration,
        })}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /descartar cambio/i }))
    expect(removeIllustration).toHaveBeenCalled()
  })
})
