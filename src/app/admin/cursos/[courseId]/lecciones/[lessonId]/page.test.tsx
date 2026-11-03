import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useParams: () => ({ courseId: "c1", lessonId: "l1" }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

import LessonEditorPage from "./page"

const LECCION = {
  id: "l1",
  title: "Lección 1",
  lessonNumber: 1,
  content: { version: 2, blocks: [] },
  moduleId: "m1",
  moduleTitle: "Módulo 1",
  courseId: "c1",
  courseTitle: "Curso 1",
  courseStatus: "DRAFT",
  prev: null,
  next: { id: "l2", title: "Lección 2" },
}

function mockFetchLeccion() {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    if (String(input).includes("/api/lessons/")) {
      return Response.json({ lesson: LECCION })
    }
    return Response.json({ words: [], totalPages: 1, total: 0 })
  })
}

describe("LessonEditorPage [F2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    mockFetchLeccion()
  })

  it("carga la lección: título, breadcrumb y vecinas", async () => {
    render(<LessonEditorPage />)
    expect(await screen.findByDisplayValue("Lección 1")).toBeDefined()
    expect(screen.getByText(/Curso 1 · Módulo 1/)).toBeDefined()
    // prev deshabilitado (es la primera), next habilitado
    expect(screen.getByRole("button", { name: /Sin lección anterior/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Lección siguiente/ })).toBeEnabled()
    // undo/redo disponibles
    expect(screen.getByRole("button", { name: "Deshacer último cambio" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Rehacer cambio" })).toBeDefined()
  })

  it("el modo vista muestra el preview y oculta el editor", async () => {
    render(<LessonEditorPage />)
    await screen.findByDisplayValue("Lección 1")

    fireEvent.click(screen.getByRole("button", { name: "Vista previa" }))
    expect(screen.getByRole("button", { name: "Volver a edición" })).toBeDefined()
  })

  it("navegar con cambios abre el guard y Descarta", async () => {
    const user = (await import("@testing-library/user-event")).default.setup()
    render(<LessonEditorPage />)
    const titulo = await screen.findByDisplayValue("Lección 1")

    // ensuciar: cambiar el título
    await user.clear(titulo)
    await user.type(titulo, "Lección 1 editada")
    expect(await screen.findByText("Cambios sin guardar")).toBeDefined()

    // intentar salir
    fireEvent.click(screen.getByRole("button", { name: "Volver a Gestión de cursos" }))
    expect(await screen.findByText("¿Salir sin guardar?")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }))
    expect(pushMock).toHaveBeenCalledWith("/admin/cursos")
  })

  it("404 muestra estado de error con volver", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
    render(<LessonEditorPage />)
    expect(await screen.findByText("Lección no encontrada")).toBeDefined()
  })
})
