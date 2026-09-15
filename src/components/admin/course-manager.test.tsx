import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CourseManager } from "./course-manager"

const COURSES = [
  { id: "c1", title: "Básico", description: "d", status: "PUBLISHED", modules: 2, lessons: 4 },
  { id: "c2", title: "Intermedio", description: null, status: "DRAFT", modules: 0, lessons: 0 },
]

const DETAIL = {
  id: "c1",
  title: "Básico",
  description: "d",
  status: "PUBLISHED",
  sequential: true,
  modules: [
    {
      id: "m1",
      title: "M1",
      order: 0,
      lessons: [{ id: "l1", title: "L1", type: "READ", order: 0, wordId: "w1" }],
    },
  ],
}

describe("CourseManager [B2.2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("lista cursos y crea uno nuevo", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ courses: COURSES }))
      .mockResolvedValueOnce(Response.json({ course: { id: "c3" } }))
      .mockResolvedValueOnce(Response.json({ courses: [...COURSES, { id: "c3", title: "N", description: null, status: "DRAFT", modules: 0, lessons: 0 }] }))
      .mockResolvedValueOnce(Response.json(DETAIL))
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    expect(await screen.findByText("Básico")).toBeDefined()
    await user.type(screen.getByLabelText("Título del nuevo curso"), "Nuevo")
    await user.click(screen.getByRole("button", { name: "Crear curso" }))
    expect(fetch).toHaveBeenCalledWith(
      "/api/courses",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("edita módulos y añade lecciones", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ courses: COURSES }))
      .mockResolvedValueOnce(Response.json({ course: DETAIL }))
      .mockResolvedValue(Response.json({ module: { id: "m2" } }))
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    expect(await screen.findByText("M1")).toBeDefined()

    await user.type(screen.getByLabelText("Título del nuevo módulo"), "M2")
    await user.click(screen.getByRole("button", { name: /^Añadir$/ }))
    expect(fetch).toHaveBeenCalledWith(
      "/api/modules",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("sin canDelete no muestra eliminar curso", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ courses: COURSES }))
      .mockResolvedValueOnce(Response.json({ course: DETAIL }))
    const user = userEvent.setup()
    render(<CourseManager canDelete={false} />)

    await user.click(await screen.findByText("Básico"))
    expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull()
  })

  it("doble click en añadir lección crea una sola [admin-cursos]", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ courses: COURSES }))
      .mockResolvedValueOnce(Response.json({ course: DETAIL }))
    // POST pendiente: simula red lenta. fireEvent es sincrónico: ambos
    // clicks llegan antes de cualquier re-render (el race real).
    let resolvePost!: (v: Response) => void
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((r) => {
          resolvePost = r
        })
    )
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.type(screen.getByLabelText(/Título de nueva lección/), "Doble")
    const addBtn = screen.getByRole("button", { name: "Añadir lección" })
    fireEvent.click(addBtn)
    // Sin esperar a la red, el botón ya debe estar bloqueado...
    expect(addBtn).toBeDisabled()
    // ...y un segundo envío no duplica la petición
    fireEvent.click(addBtn)

    const lessonCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes("/lessons"))
    expect(lessonCalls).toHaveLength(1)

    resolvePost(Response.json({ lesson: { id: "l2" } }))
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Doble")).toBeNull()
    })
  })
})
