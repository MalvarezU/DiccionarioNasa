import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), curso: "" as string, q: "" as string }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/admin/cursos",
  useSearchParams: () => {
    const params = new URLSearchParams()
    if (nav.curso) params.set("curso", nav.curso)
    if (nav.q) params.set("q", nav.q)
    return params
  },
}))

const toastMock = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}))

import { CourseManager } from "./course-manager"
import {
  COURSES,
  DETAIL_C1,
  mockBase,
  detailCalls,
  resetNavState,
  installJsdomPolyfills,
} from "./course-manager-test-setup"

installJsdomPolyfills()

function resetNav() {
  resetNavState(nav)
}

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

describe("CourseManager estructura [CU-3]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
    localStorage.clear()
  })

  function toastTitleText(callIndex = 0) {
    const { title } = toastMock.mock.calls[callIndex][0] as { title: ReactNode }
    const { container } = render(<>{title}</>)
    return container
  }

  it("click en título abre input: Enter guarda con PATCH y toast con icono", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.click(screen.getByRole("button", { name: "Renombrar módulo M1" }))

    const input = screen.getByLabelText("Nuevo título para el módulo M1")
    expect(input).toHaveValue("M1")
    await user.clear(input)
    await user.type(input, "M1 editado")
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/modules/m1",
        expect.objectContaining({ method: "PATCH" })
      )
    })
    const patch = vi
      .mocked(fetch)
      .mock.calls.find(
        ([u, init]) => String(u) === "/api/modules/m1" && (init as RequestInit)?.method === "PATCH"
      )
    expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({ title: "M1 editado" })

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    const container = toastTitleText()
    expect(container).toHaveTextContent("Módulo renombrado")
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("Esc cancela el renombrado sin llamar PATCH", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.click(screen.getByRole("button", { name: "Renombrar módulo M1" }))

    const input = screen.getByLabelText("Nuevo título para el módulo M1")
    await user.clear(input)
    await user.type(input, "Descartado")
    await user.keyboard("{Escape}")

    expect(screen.queryByLabelText(/Nuevo título para el módulo/)).toBeNull()
    expect(screen.getByRole("button", { name: "Renombrar módulo M1" })).toBeDefined()
    const patchCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PATCH")
    expect(patchCalls).toHaveLength(0)
  })

  it("acordeón colapsa/expande con numeración y persiste en localStorage", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await screen.findByLabelText(/Título de nueva lección/)
    expect(screen.getByText("01")).toBeDefined()

    await user.click(screen.getByRole("button", { name: "Colapsar módulo M1" }))
    await waitFor(() =>
      expect(screen.queryByLabelText(/Título de nueva lección/)).toBeNull()
    )
    expect(screen.getByRole("button", { name: "Expandir módulo M1" })).toBeDefined()
    expect(localStorage.getItem("cm-modulos:c1")).toBe("[]")

    await user.click(screen.getByRole("button", { name: "Expandir módulo M1" }))
    await screen.findByLabelText(/Título de nueva lección/)
    expect(localStorage.getItem("cm-modulos:c1")).toBe('["m1"]')
  })

  it("restaura el acordeón colapsado al remontar", async () => {
    mockBase()
    localStorage.setItem("cm-modulos:c1", "[]")
    const user = userEvent.setup()
    const { unmount } = render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await screen.findByRole("button", { name: "Expandir módulo M1" })
    expect(screen.queryByLabelText(/Título de nueva lección/)).toBeNull()
    unmount()

    render(<CourseManager canDelete />)
    await screen.findByRole("button", { name: "Expandir módulo M1" })
    expect(screen.queryByLabelText(/Título de nueva lección/)).toBeNull()
  })

  it("chips filtran la lista y espejan ?filtro= junto a ?curso=", async () => {
    resetNav()
    nav.curso = "c1"
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)
    await screen.findByDisplayValue("Básico")

    await user.click(screen.getByRole("button", { name: "Publicado" }))
    expect(screen.getByRole("button", { name: /Básico/ })).toBeDefined()
    expect(screen.queryByRole("button", { name: /Intermedio/ })).toBeNull()
    expect(nav.replace).toHaveBeenCalledWith("/admin/cursos?curso=c1&filtro=PUBLISHED", {
      scroll: false,
    })

    await user.click(screen.getByRole("button", { name: "Archivado" }))
    expect(screen.queryByRole("button", { name: /Básico/ })).toBeNull()
    expect(screen.getByText("Sin cursos con este estado.")).toBeDefined()

    await user.click(screen.getByRole("button", { name: "Todos" }))
    await screen.findByRole("button", { name: /Intermedio/ })
    expect(nav.replace).toHaveBeenLastCalledWith("/admin/cursos?curso=c1", { scroll: false })
  })

  it("sin canDelete oculta el botón Eliminar del módulo", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete={false} />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await screen.findByRole("button", { name: "Renombrar módulo M1" })
    expect(screen.queryByRole("button", { name: "Eliminar M1" })).toBeNull()
    expect(screen.getByRole("button", { name: "Subir M1" })).toBeDefined()
    expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull()
  })

  it("con canDelete muestra el botón Eliminar del módulo", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    expect(await screen.findByRole("button", { name: "Eliminar M1" })).toBeDefined()
  })
})

describe("CourseManager estructura colapsar/expandir todo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
    localStorage.clear()
  })

  const DETAIL_2MOD = {
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
      {
        id: "m2",
        title: "M2",
        order: 1,
        lessons: [
          {
            id: "l2",
            title: "L2",
            order: 0,
            lessonNumber: 2,
            content: { version: 1, blocks: [{ tipo: "texto" }] },
          },
        ],
      },
    ],
  }

  function mockDosModulos() {
    vi.mocked(fetch).mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method !== "GET") return Response.json({ ok: true, success: true })
      if (url.startsWith("/api/courses?")) return Response.json({ courses: COURSES })
      if (url === "/api/courses/c1") return Response.json({ course: DETAIL_2MOD })
      return Response.json({})
    })
  }

  it("fila maestra muestra conteo y colapsar todo pliega los módulos", async () => {
    mockDosModulos()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))

    const conteo = await screen.findByTestId("estructura-conteo")
    expect(conteo).toHaveTextContent("2 módulos · 2 lecciones · 1 sin contenido")
    expect(conteo.className).toMatch(/tabular-nums/)

    expect(screen.getAllByLabelText(/Título de nueva lección/)).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: "Colapsar todo" }))
    await waitFor(() =>
      expect(screen.queryByLabelText(/Título de nueva lección/)).toBeNull()
    )
    expect(screen.getByLabelText("Título")).toBeDefined()
    expect(screen.getByRole("button", { name: "Expandir todo" })).toBeDefined()
    expect(localStorage.getItem("cm-modulos:c1")).toBe("[]")
  })

  it("expandir todo reabre los módulos y persiste", async () => {
    mockDosModulos()
    localStorage.setItem("cm-modulos:c1", "[]")
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await screen.findByRole("button", { name: "Expandir todo" })
    expect(screen.queryByLabelText(/Título de nueva lección/)).toBeNull()

    await user.click(screen.getByRole("button", { name: "Expandir todo" }))
    await waitFor(() =>
      expect(screen.getAllByLabelText(/Título de nueva lección/)).toHaveLength(2)
    )
    expect(screen.getByRole("button", { name: "Colapsar todo" })).toBeDefined()
    expect(localStorage.getItem("cm-modulos:c1")).toBe('["m1","m2"]')
  })
})