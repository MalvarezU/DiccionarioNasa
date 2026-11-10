import { vi, describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConfirmDialog } from "./confirm-dialog"

describe("ConfirmDialog", () => {
  it("renderiza título y descripción", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        titulo="¿Eliminar?"
        descripcion="No se puede deshacer."
      />
    )
    expect(screen.getByText("¿Eliminar?")).toBeDefined()
    expect(screen.getByText("No se puede deshacer.")).toBeDefined()
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDefined()
  })

  it("Cancelar no llama onConfirm", async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} titulo="T" />
    )
    await user.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("Confirmar llama onConfirm", async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} titulo="T" />)
    await user.click(screen.getByRole("button", { name: "Eliminar" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("processing deshabilita ambos botones y muestra spinner", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        titulo="T"
        processing
      />
    )
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled()
  })

  it("accionLabel y cancelarLabel customizables", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        titulo="T"
        accionLabel="Quitar"
        cancelarLabel="Volver"
      />
    )
    expect(screen.getByRole("button", { name: "Quitar" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Volver" })).toBeDefined()
  })

  it("no renderiza descripción si no se pasa", () => {
    render(<ConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} titulo="T" />)
    expect(screen.queryByText("No se puede deshacer.")).toBeNull()
  })
})
