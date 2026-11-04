import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { InstallDialog } from "./install-dialog"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe("InstallDialog", () => {
  it("muestra título y pasos de la variante Android", () => {
    render(
      <InstallDialog
        open
        onOpenChange={() => {}}
        variant="android"
        instalPromptDisponible={false}
        instalada={false}
        onInstalar={() => {}}
      />
    )
    expect(screen.getByText("Instalar en Android")).toBeDefined()
    expect(screen.getByText("Abrí esta página en Chrome de Android.")).toBeDefined()
  })

  it("muestra los pasos de la variante escritorio", () => {
    render(
      <InstallDialog
        open
        onOpenChange={() => {}}
        variant="desktop"
        instalPromptDisponible={false}
        instalada={false}
        onInstalar={() => {}}
      />
    )
    expect(screen.getByText("Instalar en tu equipo")).toBeDefined()
    expect(
      screen.getByText("Buscá el icono de instalación en la barra de direcciones (monitor con flecha).")
    ).toBeDefined()
  })

  it("muestra los pasos de la variante iOS", () => {
    render(
      <InstallDialog
        open
        onOpenChange={() => {}}
        variant="ios"
        instalPromptDisponible={false}
        instalada={false}
        onInstalar={() => {}}
      />
    )
    expect(screen.getByText("Instalar en iPhone / iPad")).toBeDefined()
    expect(screen.getByText("Elegí “Añadir a pantalla de inicio”.")).toBeDefined()
  })

  it("con prompt: el botón primario llama a onInstalar", () => {
    const onInstalar = vi.fn()
    render(
      <InstallDialog
        open
        onOpenChange={() => {}}
        variant="android"
        instalPromptDisponible
        instalada={false}
        onInstalar={onInstalar}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Instalar ahora" }))
    expect(onInstalar).toHaveBeenCalledTimes(1)
  })

  it("instalada: el botón primario está deshabilitado y no instala", () => {
    const onInstalar = vi.fn()
    render(
      <InstallDialog
        open
        onOpenChange={() => {}}
        variant="android"
        instalPromptDisponible={false}
        instalada
        onInstalar={onInstalar}
      />
    )
    const boton = screen.getByRole("button", { name: "Ya instalada" })
    expect(boton).toHaveProperty("disabled", true)
    fireEvent.click(boton)
    expect(onInstalar).not.toHaveBeenCalled()
  })

  it("sin prompt: el botón primario solo cierra el diálogo", () => {
    const onOpenChange = vi.fn()
    const onInstalar = vi.fn()
    render(
      <InstallDialog
        open
        onOpenChange={onOpenChange}
        variant="android"
        instalPromptDisponible={false}
        instalada={false}
        onInstalar={onInstalar}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onInstalar).not.toHaveBeenCalled()
  })

  it("cerrado: no renderiza el diálogo", () => {
    render(
      <InstallDialog
        open={false}
        onOpenChange={() => {}}
        variant="android"
        instalPromptDisponible
        instalada={false}
        onInstalar={() => {}}
      />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
