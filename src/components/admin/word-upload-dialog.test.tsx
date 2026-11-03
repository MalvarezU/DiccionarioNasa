import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { WordUploadDialog } from "./word-upload-dialog"

describe("WordUploadDialog", () => {
  it("muestra título e hijos", () => {
    render(
      <WordUploadDialog open onOpenChange={() => {}} titulo="Audio para Casa / Yat">
        <p>contenido del picker</p>
      </WordUploadDialog>
    )
    expect(screen.getByText("Audio para Casa / Yat")).toBeDefined()
    expect(screen.getByText("contenido del picker")).toBeDefined()
    expect(screen.queryByText("Guardando en la ficha…")).toBeNull()
  })

  it("muestra el indicador mientras guarda", () => {
    render(
      <WordUploadDialog open onOpenChange={() => {}} titulo="T" saving>
        <p>hijos</p>
      </WordUploadDialog>
    )
    expect(screen.getByText("Guardando en la ficha…")).toBeDefined()
  })

  it("no cierra con Escape mientras guarda, sí cuando no guarda", () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <WordUploadDialog open onOpenChange={onOpenChange} titulo="T" saving>
        <p>hijos</p>
      </WordUploadDialog>
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onOpenChange).not.toHaveBeenCalled()

    rerender(
      <WordUploadDialog open onOpenChange={onOpenChange} titulo="T">
        <p>hijos</p>
      </WordUploadDialog>
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
