import { vi, describe, it, expect } from "vitest"
import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ChipOpcion } from "./chip-opcion"

const base = {
  texto: "Opción A",
  correcta: false,
  onChange: vi.fn(),
  onMarcarCorrecta: vi.fn(),
  onQuitar: vi.fn(),
  puedeSubir: true,
  puedeBajar: true,
}

describe("ChipOpcion", () => {
  it("renderiza el input, el radio y las acciones básicas", () => {
    render(<ChipOpcion {...base} />)
    expect(screen.getByLabelText("Texto de la opción")).toBeDefined()
    expect(screen.getByRole("button", { name: "Marcar" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Quitar opción" })).toBeDefined()
    // las flechas solo aparecen si se pasan los callbacks
    expect(screen.queryByRole("button", { name: "Subir opción" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Bajar opción" })).toBeNull()
  })

  it("en modo correcta muestra 'Correcta', aria-pressed y clase secondary", () => {
    render(<ChipOpcion {...base} correcta />)
    const btn = screen.getByRole("button", { name: "Correcta" })
    expect(btn.getAttribute("aria-pressed")).toBe("true")
    expect(btn.className).toContain("border-secondary")
  })

  it("escribir en el input dispara onChange con el texto editado", async () => {
    function Wrapper() {
      const [t, setT] = useState("Opción A")
      return <ChipOpcion {...base} texto={t} onChange={setT} />
    }
    const user = userEvent.setup()
    render(<Wrapper />)
    const input = screen.getByLabelText("Texto de la opción") as HTMLInputElement
    await user.clear(input)
    await user.type(input, "Nueva")
    expect(input.value).toBe("Nueva")
  })

  it("marcar correcta dispara onMarcarCorrecta", async () => {
    const onMarcarCorrecta = vi.fn()
    const user = userEvent.setup()
    render(<ChipOpcion {...base} onMarcarCorrecta={onMarcarCorrecta} />)
    await user.click(screen.getByRole("button", { name: "Marcar" }))
    expect(onMarcarCorrecta).toHaveBeenCalledTimes(1)
  })

  it("quitar dispara onQuitar", async () => {
    const onQuitar = vi.fn()
    const user = userEvent.setup()
    render(<ChipOpcion {...base} onQuitar={onQuitar} />)
    await user.click(screen.getByRole("button", { name: "Quitar opción" }))
    expect(onQuitar).toHaveBeenCalledTimes(1)
  })

  it("mover arriba/bajo dispara los callbacks", async () => {
    const onMoverArriba = vi.fn()
    const onMoverAbajo = vi.fn()
    const user = userEvent.setup()
    render(
      <ChipOpcion
        {...base}
        onMoverArriba={onMoverArriba}
        onMoverAbajo={onMoverAbajo}
        puedeSubir
        puedeBajar
      />
    )
    await user.click(screen.getByRole("button", { name: "Subir opción" }))
    await user.click(screen.getByRole("button", { name: "Bajar opción" }))
    expect(onMoverArriba).toHaveBeenCalledTimes(1)
    expect(onMoverAbajo).toHaveBeenCalledTimes(1)
  })

  it("deshabilita mover en los extremos", () => {
    render(<ChipOpcion {...base} puedeSubir={false} puedeBajar={false} onMoverArriba={() => {}} onMoverAbajo={() => {}} />)
    expect(screen.getByRole("button", { name: "Subir opción" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Bajar opción" })).toBeDisabled()
  })

  it("no renderiza flechas si no se pasan los callbacks", () => {
    render(<ChipOpcion {...base} />)
    expect(screen.queryByRole("button", { name: "Subir opción" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Bajar opción" })).toBeNull()
  })

  it("disabled deshabilita todos los controles", () => {
    render(
      <ChipOpcion
        {...base}
        disabled
        onMoverArriba={() => {}}
        onMoverAbajo={() => {}}
      />
    )
    expect(screen.getByLabelText("Texto de la opción")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Marcar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Quitar opción" })).toBeDisabled()
  })
})
