import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const toastMock = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}))

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
      lessons: [{ id: "l1", title: "L1", order: 0, lessonNumber: 1 }],
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

  it("guardar curso muestra toast de éxito con icono", async () => {
    vi.mocked(fetch).mockImplementation(async (input: unknown) => {
      const url = String(input)
      if (url.includes("/api/courses/c1")) {
        return Response.json({ course: DETAIL })
      }
      return Response.json({ courses: COURSES })
    })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.click(await screen.findByRole("button", { name: "Guardar curso" }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const { title } = toastMock.mock.calls[0][0] as { title: ReactNode }
    const { container } = render(<>{title}</>)
    expect(container).toHaveTextContent("Curso guardado")
    expect(container.querySelector("svg")).not.toBeNull()
  })
})

describe("CourseManager delete con confirm dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("eliminar curso: abre confirm y al confirmar llama DELETE", async () => {
    vi.mocked(fetch).mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === "DELETE") return Response.json({ success: true })
      if (url.includes("/api/courses/c1")) {
        return Response.json({ course: DETAIL, stats: { alumnos: 0, promedioPct: null, completadas: 0 } })
      }
      return Response.json({ courses: COURSES })
    })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await user.click(await screen.findByText("Básico"))
    const eliminarBtn = await screen.findByRole("button", { name: "Eliminar" })
    await user.click(eliminarBtn)

    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo.textContent).toContain('¿Eliminar el curso "Básico"?')

    await user.click(within(dialogo).getByRole("button", { name: "Eliminar" }))
    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls
      expect(calls.some((c) => String(c[0]).includes("/api/courses/c1") && (c[1] as any)?.method === "DELETE")).toBe(true)
    })
  })

  it("cancelar no llama DELETE", async () => {
    vi.mocked(fetch).mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/courses/c1")) {
        return Response.json({ course: DETAIL, stats: { alumnos: 0, promedioPct: null, completadas: 0 } })
      }
      return Response.json({ courses: COURSES })
    })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await user.click(await screen.findByText("Básico"))
    await user.click(await screen.findByRole("button", { name: "Eliminar" }))

    const dialogo = await screen.findByRole("alertdialog")
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }))
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.some((c) => (c[1] as any)?.method === "DELETE")).toBe(false)
  })
})

describe("CourseManager — lista con scroll propio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("la lista scrollea en su contenedor con tope de layout y el form queda fijo", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ courses: COURSES }))
    render(<CourseManager canDelete />)

    const lista = await screen.findByTestId("cursos-lista")
    expect(lista.className).toMatch(/overflow-y-auto/)
    expect(lista.className).toMatch(/flex-1/)
    expect(lista.className).toMatch(/min-h-0/)

    const card = screen.getByTestId("cursos-card")
    expect(card.className).toMatch(/lg:max-h-\[calc\(100dvh-13rem\)\]/)

    // El form de alta queda fuera del área scrolleable (siempre visible)
    expect(lista.querySelector('input[aria-label="Título del nuevo curso"]')).toBeNull()
    expect(screen.getByLabelText("Título del nuevo curso")).toBeDefined()
  })
})
