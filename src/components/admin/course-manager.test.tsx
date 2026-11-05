import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), curso: "" as string }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/admin/cursos",
  useSearchParams: () => new URLSearchParams(nav.curso ? `curso=${nav.curso}` : ""),
}))

const toastMock = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}))

import { CourseManager } from "./course-manager"

// jsdom no implementa pointer capture: Radix Select lo exige al abrir el
// menú (solo entorno de test, sin efecto en producción).
if (typeof Element !== "undefined") {
  const proto = Element.prototype as unknown as Record<string, unknown>
  if (typeof proto.hasPointerCapture !== "function") {
    proto.hasPointerCapture = () => false
    proto.setPointerCapture = () => {}
    proto.releasePointerCapture = () => {}
  }
  if (typeof proto.scrollIntoView !== "function") {
    proto.scrollIntoView = () => {}
  }
}

const COURSES = [
  { id: "c1", title: "Básico", description: "d", status: "PUBLISHED", modules: 2, lessons: 4 },
  { id: "c2", title: "Intermedio", description: null, status: "DRAFT", modules: 0, lessons: 0 },
]

const DETAIL_C1 = {
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

const DETAIL_C2 = {
  id: "c2",
  title: "Intermedio",
  description: null,
  status: "DRAFT",
  sequential: true,
  modules: [],
}

function resetNav() {
  nav.push.mockClear()
  nav.replace.mockClear()
  nav.curso = ""
}

/** Respuestas base: lista + detalles + escrituras OK. */
function mockBase() {
  vi.mocked(fetch).mockImplementation(async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    if (method !== "GET") {
      if (method === "POST" && url === "/api/courses") return Response.json({ course: { id: "c3" } })
      return Response.json({ ok: true, success: true })
    }
    if (url.startsWith("/api/courses?")) return Response.json({ courses: COURSES })
    if (url === "/api/courses/c1") return Response.json({ course: DETAIL_C1 })
    if (url === "/api/courses/c2") return Response.json({ course: DETAIL_C2 })
    if (url === "/api/courses/c3") return Response.json({ course: { ...DETAIL_C2, id: "c3", title: "Nuevo" } })
    return Response.json({})
  })
}

function detailCalls(id: string) {
  return vi.mocked(fetch).mock.calls.filter(([u]) => String(u) === `/api/courses/${id}`)
}

describe("CourseManager [B2.2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
  })

  it("lista cursos y crea uno nuevo", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await screen.findByRole("button", { name: /Básico/ })
    await user.type(screen.getByLabelText("Título del nuevo curso"), "Nuevo")
    await user.click(screen.getByRole("button", { name: "Crear curso" }))
    expect(fetch).toHaveBeenCalledWith(
      "/api/courses",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("edita módulos y añade lecciones", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    expect(await screen.findByText("M1")).toBeDefined()

    await user.type(screen.getByLabelText("Título del nuevo módulo"), "M2")
    await user.click(screen.getByRole("button", { name: /^Añadir$/ }))
    expect(fetch).toHaveBeenCalledWith(
      "/api/modules",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("sin canDelete no muestra eliminar curso", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete={false} />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull()
  })

  it("doble click en añadir lección crea una sola [admin-cursos]", async () => {
    mockBase()
    const base = vi.mocked(fetch).getMockImplementation()!
    // POST pendiente: simula red lenta. fireEvent es sincrónico: ambos
    // clicks llegan antes de cualquier re-render (el race real).
    let resolvePost!: (v: Response) => void
    vi.mocked(fetch).mockImplementation(
      (input: unknown, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? "GET"
        if (method === "POST" && url.includes("/lessons")) {
          return new Promise<Response>((r) => {
            resolvePost = r
          })
        }
        return base(input as string, init)
      }
    )
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await screen.findByLabelText(/Título de nueva lección/)
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
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
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
    resetNav()
  })

  it("eliminar curso: abre confirm y al confirmar llama DELETE", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    const eliminarBtn = await screen.findByRole("button", { name: "Eliminar" })
    await user.click(eliminarBtn)

    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo.textContent).toContain('¿Eliminar el curso "Básico"?')

    await user.click(within(dialogo).getByRole("button", { name: "Eliminar" }))
    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls
      expect(calls.some((c) => String(c[0]).includes("/api/courses/c1") && (c[1] as RequestInit)?.method === "DELETE")).toBe(true)
    })
  })

  it("cancelar no llama DELETE", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.click(await screen.findByRole("button", { name: "Eliminar" }))

    const dialogo = await screen.findByRole("alertdialog")
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }))
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.some((c) => (c[1] as RequestInit)?.method === "DELETE")).toBe(false)
  })
})

describe("CourseManager — lista con scroll propio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
  })

  it("la lista scrollea en su contenedor con tope de layout y el form queda fijo", async () => {
    mockBase()
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

describe("CourseManager dirty-guard [CU-1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
  })

  async function renderConDirty() {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await screen.findByDisplayValue("Básico")
    await user.clear(screen.getByLabelText("Título"))
    await user.type(screen.getByLabelText("Título"), "Básico editado")
    return user
  }

  it("cambio con dirty abre el guard y no navega", async () => {
    const user = await renderConDirty()
    await user.click(screen.getByRole("button", { name: /Intermedio/ }))

    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo.textContent).toContain("Tenés cambios sin guardar")
    // No navegó: c2 nunca se pidió y la edición sigue intacta
    expect(detailCalls("c2")).toHaveLength(0)
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Básico editado")
  })

  it("cancelar frena y conserva la edición", async () => {
    const user = await renderConDirty()
    await user.click(screen.getByRole("button", { name: /Intermedio/ }))
    await screen.findByRole("alertdialog")

    await user.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(detailCalls("c2")).toHaveLength(0)
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Básico editado")
  })

  it("descartar cambia de curso", async () => {
    const user = await renderConDirty()
    await user.click(screen.getByRole("button", { name: /Intermedio/ }))
    await screen.findByRole("alertdialog")

    await user.click(screen.getByRole("button", { name: "Descartar" }))
    await screen.findByDisplayValue("Intermedio")
    expect(nav.replace).toHaveBeenCalledWith("/admin/cursos?curso=c2", { scroll: false })
  })

  it("guardar y continuar persiste y navega", async () => {
    const user = await renderConDirty()
    await user.click(screen.getByRole("button", { name: /Intermedio/ }))
    await screen.findByRole("alertdialog")

    await user.click(screen.getByRole("button", { name: "Guardar y continuar" }))
    await waitFor(() => {
      const patch = vi
        .mocked(fetch)
        .mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PATCH")
      expect(patch.length).toBeGreaterThan(0)
    })
    await screen.findByDisplayValue("Intermedio")
  })

  it("sin cambios no abre el guard", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await screen.findByDisplayValue("Básico")

    await user.click(screen.getByRole("button", { name: /Intermedio/ }))
    await screen.findByDisplayValue("Intermedio")
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("ir a lección con dirty pide confirmación y al descartar navega", async () => {
    const user = await renderConDirty()
    await user.click(screen.getByRole("button", { name: "Contenido de lección L1" }))

    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo.textContent).toContain("Tenés cambios sin guardar")

    await user.click(within(dialogo).getByRole("button", { name: "Descartar" }))
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith("/admin/cursos/c1/lecciones/l1")
    )
  })
})

describe("CourseManager URL [CU-1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
  })

  it("init desde ?curso= selecciona ese curso sin clicks", async () => {
    nav.curso = "c2"
    mockBase()
    render(<CourseManager canDelete />)

    await screen.findByDisplayValue("Intermedio")
    expect(detailCalls("c1")).toHaveLength(0)
  })

  it("sin ?curso= selecciona el primero y lo refleja en la URL", async () => {
    mockBase()
    render(<CourseManager canDelete />)

    await screen.findByDisplayValue("Básico")
    expect(nav.replace).toHaveBeenCalledWith("/admin/cursos?curso=c1", { scroll: false })
  })
})

describe("CourseManager anti-race y loading [CU-1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
  })

  it("doble click: solo la última respuesta pinta", async () => {
    const gates = new Map<string, (v: Response) => void>()
    vi.mocked(fetch).mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.startsWith("/api/courses?")) return Promise.resolve(Response.json({ courses: COURSES }))
      const m = url.match(/\/api\/courses\/(c\d+)$/)
      if (m) return new Promise<Response>((r) => { gates.set(m[1]!, r) })
      return Promise.resolve(Response.json({}))
    })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await screen.findByRole("button", { name: /Básico/ })
    // El auto-select de c1 ya está en vuelo; el segundo click llega antes de resolver
    await waitFor(() => expect(gates.has("c1")).toBe(true))
    await user.click(screen.getByRole("button", { name: /Intermedio/ }))
    await waitFor(() => expect(gates.has("c2")).toBe(true))

    // Responden al revés: primero la última, después la vieja
    gates.get("c2")!(Response.json({ course: DETAIL_C2 }))
    gates.get("c1")!(Response.json({ course: DETAIL_C1 }))

    await screen.findByDisplayValue("Intermedio")
    // La respuesta tardía de c1 no pisa a c2
    await waitFor(() =>
      expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Intermedio")
    )
  })

  it("el refetch tras guardar no re-skeletoniza la lista", async () => {
    let listCalls = 0
    let resolveRefetch!: (v: Response) => void
    vi.mocked(fetch).mockImplementation((input: unknown, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method !== "GET") return Promise.resolve(Response.json({ ok: true }))
      if (url.startsWith("/api/courses?")) {
        listCalls += 1
        if (listCalls > 1) return new Promise<Response>((r) => { resolveRefetch = r })
        return Promise.resolve(Response.json({ courses: COURSES }))
      }
      if (url === "/api/courses/c1") return Promise.resolve(Response.json({ course: DETAIL_C1 }))
      return Promise.resolve(Response.json({}))
    })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await screen.findByDisplayValue("Básico")

    await user.click(screen.getByRole("button", { name: "Guardar curso" }))

    // Refetch en vuelo: lista visible, skeleton ausente, spinner sutil presente
    await screen.findByRole("status", { name: "Actualizando cursos" })
    expect(document.querySelector('[aria-label="Cargando cursos"]')).toBeNull()
    expect(screen.getByTestId("cursos-lista")).toBeDefined()

    resolveRefetch(Response.json({ courses: COURSES }))
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Actualizando cursos" })).toBeNull()
    )
  })
})


describe("CourseManager feedback [CU-2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
  })

  function toastTitleText(callIndex = 0) {
    const { title } = toastMock.mock.calls[callIndex][0] as { title: ReactNode }
    const { container } = render(<>{title}</>)
    return container
  }

  it("alta de módulo muestra toast con icono", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.type(screen.getByLabelText("Título del nuevo módulo"), "M2")
    await user.click(screen.getByRole("button", { name: /^Añadir$/ }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const container = toastTitleText()
    expect(container).toHaveTextContent("Módulo añadido")
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("alta de lección muestra toast con icono", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.type(screen.getByLabelText(/Título de nueva lección/), "L2")
    await user.click(screen.getByRole("button", { name: "Añadir lección" }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const container = toastTitleText()
    expect(container).toHaveTextContent("Lección añadida")
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("baja de módulo muestra toast con icono", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.click(await screen.findByRole("button", { name: "Eliminar M1" }))

    const dialogo = await screen.findByRole("alertdialog")
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar" }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const container = toastTitleText()
    expect(container).toHaveTextContent("Módulo eliminado")
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("baja de curso muestra toast con icono", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.click(await screen.findByRole("button", { name: "Eliminar" }))

    const dialogo = await screen.findByRole("alertdialog")
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar" }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const container = toastTitleText()
    expect(container).toHaveTextContent("Curso eliminado")
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("reorden de módulos muestra toast con icono", async () => {
    const base = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method !== "GET") return Response.json({ ok: true, success: true })
      if (url.startsWith("/api/courses?")) return Response.json({ courses: COURSES })
      if (url === "/api/courses/c1")
        return Response.json({
          course: {
            ...DETAIL_C1,
            modules: [
              { id: "m1", title: "M1", order: 0, lessons: [] },
              { id: "m2", title: "M2", order: 1, lessons: [] },
            ],
          },
        })
      return Response.json({})
    })
    global.fetch = base as unknown as typeof fetch
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await screen.findByText("M2")
    await user.click(screen.getByRole("button", { name: "Bajar M1" }))

    await waitFor(() =>
      expect(base).toHaveBeenCalledWith(
        "/api/courses/c1/reorder",
        expect.objectContaining({ method: "POST" })
      )
    )
    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const container = toastTitleText()
    expect(container).toHaveTextContent("Orden actualizado")
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("solo cambio de estado usa toast de transición", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await screen.findByDisplayValue("Básico")

    await user.click(screen.getByRole("combobox", { name: "Estado del curso" }))
    await user.click(await screen.findByRole("option", { name: "Archivado" }))
    await user.click(screen.getByRole("button", { name: "Guardar curso" }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const container = toastTitleText()
    expect(container).toHaveTextContent('Estado cambiado a "Archivado"')
    expect(container).not.toHaveTextContent("Curso guardado")
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("contenido + estado usa el toast de guardado normal", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await screen.findByDisplayValue("Básico")

    await user.clear(screen.getByLabelText("Título"))
    await user.type(screen.getByLabelText("Título"), "Básico editado")
    await user.click(screen.getByRole("combobox", { name: "Estado del curso" }))
    await user.click(await screen.findByRole("option", { name: "Archivado" }))
    await user.click(screen.getByRole("button", { name: "Guardar curso" }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const container = toastTitleText()
    expect(container).toHaveTextContent("Curso guardado")
  })

  it("error de operación: toast destructive y el inline se descarta", async () => {
    mockBase()
    const base = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation((input: unknown, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "POST" && url === "/api/modules")
        return Promise.resolve(Response.json({ message: "No se pudo" }, { status: 500 }))
      return base(input as string, init)
    })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.type(screen.getByLabelText("Título del nuevo módulo"), "M-rota")
    await user.click(screen.getByRole("button", { name: /^Añadir$/ }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      )
    )
    const alerta = await screen.findByRole("alert")
    expect(alerta).toHaveTextContent("No se pudo")

    await user.click(screen.getByRole("button", { name: "Descartar error" }))
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
  })
})
