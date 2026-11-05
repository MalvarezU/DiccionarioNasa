import { describe, expect, it } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PlayerShell } from "./player-shell"

function shell(overrides: Partial<Parameters<typeof PlayerShell>[0]> = {}) {
  return {
    outline: <div data-testid="outline">Índice</div>,
    canvas: <div data-testid="canvas">Lección</div>,
    ...overrides,
  }
}

describe("PlayerShell", () => {
  it("loading: skeleton con aria-busy, sin outline ni canvas", () => {
    render(
      <PlayerShell
        {...shell({ loading: <div data-testid="cargando" />, outline: null, canvas: null })}
      />
    )
    expect(screen.getByTestId("cargando")).toBeDefined()
    expect(screen.getByLabelText("Cargando curso")).toHaveAttribute("aria-busy", "true")
    expect(screen.queryByTestId("canvas")).toBeNull()
  })

  it("error: role=alert visible (jamás skeletons infinitos)", () => {
    render(
      <PlayerShell
        {...shell({
          error: <p>No se pudo cargar el curso</p>,
          outline: null,
          canvas: null,
        })}
      />
    )
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("No se pudo cargar el curso")
  })

  it("empty: mensaje de curso en preparación", () => {
    render(
      <PlayerShell
        {...shell({
          empty: <p>Este curso se está preparando</p>,
          outline: null,
          canvas: null,
        })}
      />
    )
    expect(screen.getByText("Este curso se está preparando")).toBeDefined()
    expect(screen.queryByTestId("outline")).toBeNull()
  })

  it("ready: grid con outline sticky y canvas con min-h anti-CLS", () => {
    const { container } = render(<PlayerShell {...shell()} />)
    expect(screen.getByTestId("outline")).toBeDefined()
    expect(screen.getByTestId("canvas")).toBeDefined()
    const sticky = container.querySelector(".sticky.top-14")
    expect(sticky).not.toBeNull()
    const canvas = screen.getByTestId("canvas").parentElement
    expect(canvas?.className).toContain("min-h-[max(420px,60dvh)]")
  })

  it("móvil: botón abre el Sheet y Esc lo cierra", async () => {
    const user = userEvent.setup()
    render(<PlayerShell {...shell()} />)
    await user.click(screen.getByRole("button", { name: /Índice del curso/ }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("Índice")
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("móvil: activar una lección dentro del Sheet lo cierra", async () => {
    const user = userEvent.setup()
    render(
      <PlayerShell
        {...shell({
          outline: (
            <button type="button" data-lesson-button="">
              Lección 1.1
            </button>
          ),
        })}
      />
    )
    await user.click(screen.getByRole("button", { name: /Índice del curso/ }))
    await screen.findByRole("dialog")
    await user.click(screen.getByRole("button", { name: /Lección 1\.1/ }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })
})
