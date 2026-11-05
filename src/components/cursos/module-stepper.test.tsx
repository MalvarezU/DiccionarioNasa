import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ModuleStepper, type RealModule } from "./module-stepper"

const modulo: RealModule = {
  id: "mod-2",
  title: "Saludos",
  lessons: [{ id: "les-1", title: "Hola", lessonNumber: 1, content: null }],
}

function props(overrides: Partial<Parameters<typeof ModuleStepper>[0]> = {}) {
  return {
    module: modulo,
    moduleIndex: 2,
    isUnlocked: true,
    completedLessons: [],
    moduleProgress: { done: 0, total: 1 },
    onLessonComplete: vi.fn(),
    ...overrides,
  }
}

describe("ModuleStepper — encabezado operable por teclado", () => {
  it("el encabezado es un botón real con aria-expanded y aria-controls", () => {
    render(<ModuleStepper {...props()} />)
    const header = screen.getByRole("button", { name: /Saludos/ })
    expect(header).toHaveAttribute("aria-expanded", "false")
    expect(header).toHaveAttribute("aria-controls", "modulo-2-panel")
    // El panel colapsado no se renderiza (la section externa sí es region por su aria-label)
    expect(document.getElementById("modulo-2-panel")).toBeNull()
  })

  it("abre y cierra con click de mouse", async () => {
    const user = userEvent.setup()
    render(<ModuleStepper {...props()} />)
    const header = screen.getByRole("button", { name: /Saludos/ })
    await user.click(header)
    expect(header).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: /Hola/ })).toBeDefined()
    await user.click(header)
    expect(header).toHaveAttribute("aria-expanded", "false")
  })

  it("abre y cierra con teclado (Tab + Enter / Espacio)", async () => {
    const user = userEvent.setup()
    render(<ModuleStepper {...props()} />)
    const header = screen.getByRole("button", { name: /Saludos/ })

    await user.tab()
    expect(header).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(header).toHaveAttribute("aria-expanded", "true")
    const panel = document.getElementById("modulo-2-panel")
    expect(panel).toHaveAttribute("role", "region")
    expect(panel).toHaveAttribute("aria-labelledby", header.id)

    await user.keyboard(" ")
    expect(header).toHaveAttribute("aria-expanded", "false")
  })

  it("bloqueado: botón deshabilitado con motivo, Badge visible y sin panel", () => {
    render(<ModuleStepper {...props({ isUnlocked: false })} />)
    const header = screen.getByRole("button", { name: /Saludos/ })
    expect(header).toBeDisabled()
    expect(header).toHaveAttribute(
      "title",
      "Completá el Módulo 1 para desbloquear este módulo"
    )
    expect(screen.getByText("Bloqueado")).toBeDefined()
    expect(document.getElementById("modulo-2-panel")).toBeNull()
  })
})
