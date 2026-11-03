import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { EditLessonModal, type LessonForEdit } from "./edit-lesson-modal"

const mockLesson: LessonForEdit = {
  id: "l1",
  moduleId: "m1",
  moduleTitle: "Módulo 1",
  moduleIndex: 1,
  title: "Bienvenida",
  lessonNumber: 1,
}

function renderModal(lesson: LessonForEdit | null = mockLesson) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  const onMove = vi.fn().mockResolvedValue(undefined)
  render(
    <EditLessonModal
      lesson={lesson}
      open={true}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      onMove={onMove}
    />
  )
  return { onOpenChange, onSaved, onMove }
}

describe("EditLessonModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("pre-rellena el título y muestra el número (sin palabra asociada)", () => {
    renderModal()
    expect(screen.getByText("Editar lección")).toBeDefined()
    expect(screen.getByDisplayValue("Bienvenida")).toBeDefined()
    expect(screen.queryByLabelText(/palabra asociada/i)).toBeNull()
    expect(screen.getByText("1.1")).toBeDefined()
    // sin tipo: el encabezado muestra solo el modulo
    expect(screen.getByText("Módulo 1")).toBeDefined()
  })

  it("guarda solo el título con PATCH y bloquea doble envío", async () => {
    const { onSaved, onOpenChange } = renderModal()
    // Fetch pendiente: simula red lenta para que ambos clicks lleguen
    // antes de que el primero termine (el race real del doble click).
    let resolveFetch!: (v: Response) => void
    vi.mocked(global.fetch).mockImplementation(
      () => new Promise<Response>((r) => { resolveFetch = r })
    )
    const user = userEvent.setup()

    await user.clear(screen.getByDisplayValue("Bienvenida"))
    await user.type(screen.getByLabelText("Título"), "Bienvenida 2")
    // Doble click rápido: una sola petición
    const saveBtn = screen.getByRole("button", { name: /guardar cambios/i })
    const firstClick = user.click(saveBtn)
    await user.click(saveBtn)
    await firstClick
    expect(global.fetch).toHaveBeenCalledTimes(1)

    resolveFetch(Response.json({ lesson: { id: "l1" } }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/lessons/l1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Bienvenida 2" }),
      })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("mover deshabilita los botones mientras envía", async () => {
    const { onMove } = renderModal()
    let resolveMove!: () => void
    onMove.mockImplementation(
      () => new Promise<void>((r) => { resolveMove = r })
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /^Bajar lección$/ }))
    // Mientras mueve: Subir deshabilitado
    expect(screen.getByRole("button", { name: "Subir lección" })).toBeDisabled()
    expect(onMove).toHaveBeenCalledTimes(1)
    resolveMove()
  })

  it("muestra error del servidor sin cerrar", async () => {
    renderModal()
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ message: "Ya existe otra lección" }, { status: 409 })
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }))
    expect(await screen.findByText("Ya existe otra lección")).toBeDefined()
  })
})
