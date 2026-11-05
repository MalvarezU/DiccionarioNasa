import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }))
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
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

const DETAIL_C2 = {
  id: "c2",
  title: "Intermedio",
  description: null,
  status: "DRAFT",
  sequential: true,
  modules: [],
}

function mockRutas(base: { patchOk?: boolean; moduleOk?: boolean } = {}) {
  vi.mocked(fetch).mockImplementation(async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    if (url.includes("/api/modules") && method === "POST") {
      if (base.moduleOk === false) return Response.json({ message: "No se pudo crear" }, { status: 500 })
      return Response.json({ module: { id: "mX" } })
    }
    if (url.includes("/api/courses/c1") && method === "PATCH") {
      if (base.patchOk === false) return Response.json({ message: "Falló el guardado" }, { status: 500 })
      return Response.json({ course: DETAIL })
    }
    if (url.includes("/api/courses/c1")) return Response.json({ course: DETAIL })
    if (url.includes("/api/courses/c2")) return Response.json({ course: DETAIL_C2 })
    return Response.json({ courses: COURSES })
  })
}

describe("CourseManager P1.4 — guardar, dirty-guard, errores por zona", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("guardar curso: hace PATCH y muestra toast de éxito", async () => {
    mockRutas()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.click(await screen.findByRole("button", { name: "Guardar curso" }))

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(
        ([url, init]) => String(url).includes("/api/courses/c1") && (init as RequestInit)?.method === "PATCH"
      )).toBe(true)
    })
    expect(toastMock).toHaveBeenCalledWith({ title: "Curso guardado" })
  })

  it("guardar curso con error: toast destructivo y alerta en la zona", async () => {
    mockRutas({ patchOk: false })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.click(await screen.findByRole("button", { name: "Guardar curso" }))

    const alertas = await screen.findAllByRole("alert")
    expect(alertas.some((a) => a.textContent?.includes("Falló el guardado"))).toBe(true)
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "No se pudo guardar el curso", variant: "destructive" })
    )
  })

  it("up/down deshabilitados en los límites con título explicativo", async () => {
    mockRutas()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    const subir = await screen.findByRole("button", { name: "Subir M1" })
    expect(subir).toBeDisabled()
    expect(subir).toHaveAttribute("title", "Ya es el primer módulo")
    expect(screen.getByRole("button", { name: "Bajar M1" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Subir lección L1" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Bajar lección L1" })).toBeDisabled()
  })

  it("descripción usa textarea multilínea", async () => {
    mockRutas()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    expect(screen.getByLabelText("Descripción").tagName).toBe("TEXTAREA")
  })

  it("dirty-guard: editar y cambiar de fila pide Guardar / Descartar / Cancelar", async () => {
    mockRutas()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.type(screen.getByLabelText("Título"), "!")
    await user.click(screen.getByText("Intermedio"))

    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo.textContent).toContain("¿Guardar cambios antes de salir?")

    // Cancelar: el diálogo se cierra y se queda en el curso editado
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }))
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })
    expect(screen.getByDisplayValue("Básico!")).toBeDefined()
  })

  it("dirty-guard: Descartar navega sin guardar", async () => {
    mockRutas()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.type(screen.getByLabelText("Título"), "!")
    await user.click(screen.getByText("Intermedio"))

    const dialogo = await screen.findByRole("alertdialog")
    await user.click(within(dialogo).getByRole("button", { name: "Descartar" }))

    expect(await screen.findByDisplayValue("Intermedio")).toBeDefined()
    expect(vi.mocked(fetch).mock.calls.some(
      ([, init]) => (init as RequestInit)?.method === "PATCH"
    )).toBe(false)
  })

  it("dirty-guard: Guardar cambios guarda y navega", async () => {
    mockRutas()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.type(screen.getByLabelText("Título"), "!")
    await user.click(screen.getByText("Intermedio"))

    const dialogo = await screen.findByRole("alertdialog")
    await user.click(within(dialogo).getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(
        ([url, init]) => String(url).includes("/api/courses/c1") && (init as RequestInit)?.method === "PATCH"
      )).toBe(true)
    })
    expect(await screen.findByDisplayValue("Intermedio")).toBeDefined()
  })

  it("sin ediciones no hay dirty-guard: cambia de fila directo", async () => {
    mockRutas()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.click(screen.getByText("Intermedio"))

    expect(await screen.findByDisplayValue("Intermedio")).toBeDefined()
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("error de módulo se muestra en su zona con role=alert", async () => {
    mockRutas({ moduleOk: false })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByText("Básico"))
    await user.type(screen.getByLabelText("Título del nuevo módulo"), "MX")
    await user.click(screen.getByRole("button", { name: /^Añadir$/ }))

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo crear")
  })
})
