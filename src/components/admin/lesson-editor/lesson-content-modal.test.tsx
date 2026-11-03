import { vi, describe, it, expect } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("./lesson-editor", () => ({
  LessonEditor: ({ onBloquesChange, initialBlocks }: { onBloquesChange?: (b: any[]) => void; initialBlocks?: any[] }) => (
    <div>
      <button type="button" onClick={() => onBloquesChange?.([{ id: "b-new", type: "text", markdown: "Nuevo bloque" }])}>
        Agregar bloque de prueba
      </button>
      <button type="button">Vista previa</button>
      <span data-testid="initial-count">{initialBlocks?.length ?? 0}</span>
    </div>
  ),
}))

vi.mock("@/lib/courses/word-data", () => ({
  fetchWordsByIds: vi.fn(async () => new Map()),
}))

import { LessonContentModal } from "./lesson-content-modal"
import type { LessonContent } from "@/lib/courses/blocks"

const lesson = {
  id: "l1",
  title: "Lección 1",
  moduleTitle: "Módulo 1",
  lessonNumber: 1,
  content: { version: 2, blocks: [{ id: "b1", type: "text", html: "Hola" }] } as LessonContent,
}

describe("LessonContentModal", () => {
  it("renderiza el editor a ancho completo (sin columna lateral)", async () => {
    render(<LessonContentModal lesson={lesson} open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText("Contenido · 1. Lección 1")).toBeDefined()
    // ya no hay preview lateral: el editor ocupa todo el ancho
    expect(screen.queryByText("Vista previa (estudiante)")).toBeNull()
    // el botón de vista previa vive dentro del editor
    expect(screen.getByRole("button", { name: /Vista previa/i })).toBeDefined()
  })

  it("el editor recibe onBloquesChange (sin preview lateral)", async () => {
    const user = userEvent.setup()
    render(<LessonContentModal lesson={lesson} open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    // el modal no crashea al disparar el callback (aunque ya no hay preview lateral)
    await user.click(screen.getByRole("button", { name: "Agregar bloque de prueba" }))
    // el editor mockeado se renderizó
    expect(screen.getByTestId("initial-count").textContent).toBe("1")
  })

  it("no crashea con lección sin contenido", () => {
    const sinContenido = { ...lesson, content: null }
    render(<LessonContentModal lesson={sinContenido} open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText("Contenido · 1. Lección 1")).toBeDefined()
    expect(screen.getByTestId("initial-count").textContent).toBe("0")
  })

  it("muestra el número de bloques iniciales en el editor", () => {
    render(<LessonContentModal lesson={lesson} open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByTestId("initial-count").textContent).toBe("1")
  })

  it("no renderiza nada si lesson es null", () => {
    const { container } = render(<LessonContentModal lesson={null} open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    expect(container.textContent).toBe("")
  })
})
