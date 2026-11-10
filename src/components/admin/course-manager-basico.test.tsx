import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
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
import { mockBase, detailCalls, resetNavState, installJsdomPolyfills } from "./course-manager-test-setup"

installJsdomPolyfills()

function resetNav() {
  resetNavState(nav)
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