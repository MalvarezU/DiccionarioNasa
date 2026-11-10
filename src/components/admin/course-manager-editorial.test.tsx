import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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

describe("CourseManager editorial [CU-4]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
    localStorage.clear()
  })

  it("encabezado muestra título serif, estado tonal y conteos con sin-contenido", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))

    const resumen = await screen.findByTestId("curso-resumen")
    expect(resumen).toHaveTextContent("Publicado")
    expect(resumen).toHaveTextContent("1 módulo · 1 lección")
    expect(resumen).toHaveTextContent("1 sin contenido")

    const serif = [...document.querySelectorAll(".font-serif.tracking-tight")]
    expect(serif.map((t) => t.textContent)).toContain("Básico")
  })

  it("tras crear lección re-enfoca el input del módulo", async () => {
    mockBase()
    const base = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation((input: unknown, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "POST" && url.includes("/lessons"))
        return Promise.resolve(Response.json({ lesson: { id: "l2" } }))
      return base(input as string, init)
    })
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    const input = await screen.findByLabelText(/Título de nueva lección/)
    await user.type(input, "L2")
    await user.click(screen.getByRole("button", { name: "Añadir lección" }))

    await waitFor(() => expect(input).toHaveValue(""))
    await waitFor(() => expect(document.activeElement).toBe(input))
  })

  it("acciones de fila en reveal lg con targets h-8", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))

    const subirLeccion = await screen.findByRole("button", { name: "Subir lección L1" })
    expect(subirLeccion.className).toMatch(/h-8 w-8/)
    expect(subirLeccion.parentElement!.className).toMatch(/lg:opacity-0/)
    expect(subirLeccion.parentElement!.className).toMatch(/lg:group-focus-within:opacity-100/)

    const subirModulo = await screen.findByRole("button", { name: "Subir M1" })
    expect(subirModulo.className).toMatch(/h-8 w-8/)
    expect(subirModulo.parentElement!.className).toMatch(/lg:opacity-0/)
  })

  it("el detalle ocupa la misma altura fija y scrollea en su contenido", async () => {
    mockBase()
    render(<CourseManager canDelete />)

    await screen.findByRole("button", { name: /Básico/ })

    const detalle = screen.getByTestId("curso-detalle")
    expect(detalle.className).toMatch(/lg:h-\[calc\(100dvh-13rem\)\]/)
    expect(detalle.className).toMatch(/flex-col/)

    const contenido = screen.getByTestId("curso-detalle-contenido")
    expect(contenido.className).toMatch(/overflow-y-auto/)
    expect(contenido.className).toMatch(/flex-1/)
    expect(contenido.className).toMatch(/min-h-0/)
  })
})

describe("CourseManager form plegable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
    localStorage.clear()
  })

  it("default expandido: form visible con Título, Guardar y Eliminar", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    expect(screen.getByLabelText("Título")).toBeDefined()
    expect(screen.getByRole("button", { name: "Guardar curso" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeDefined()

    const toggle = screen.getByRole("button", { name: "Colapsar detalles del curso" })
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(toggle.getAttribute("aria-controls")).toBe("form-curso")
    expect(document.getElementById("form-curso")).not.toBeNull()
  })

  it("plegar muestra resumen con título y estado; expandir restaura el form", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await screen.findByLabelText("Título")

    await user.click(screen.getByRole("button", { name: "Colapsar detalles del curso" }))

    const toggle = screen.getByRole("button", { name: "Expandir detalles del curso" })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(document.getElementById("form-curso")).toBeNull()
    expect(screen.queryByLabelText("Título")).toBeNull()

    const resumen = screen.getByTestId("form-resumen")
    expect(resumen).toHaveTextContent("Básico")
    expect(resumen).toHaveTextContent("Publicado")
    expect(screen.getByRole("button", { name: "Guardar curso" })).toBeDefined()
    expect(localStorage.getItem("cm-form:c1")).toBe("false")

    await user.click(toggle)
    expect(screen.getByLabelText("Título")).toBeDefined()
    expect(screen.getByRole("button", { name: "Colapsar detalles del curso" })).toBeDefined()
    expect(localStorage.getItem("cm-form:c1")).toBe("true")
  })

  it("persiste plegado por curso y lo restaura al remontar", async () => {
    mockBase()
    localStorage.setItem("cm-form:c1", "false")
    const user = userEvent.setup()
    const { unmount } = render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await screen.findByRole("button", { name: "Expandir detalles del curso" })
    expect(screen.queryByLabelText("Título")).toBeNull()
    unmount()

    render(<CourseManager canDelete />)
    await screen.findByRole("button", { name: "Expandir detalles del curso" })
    expect(screen.queryByLabelText("Título")).toBeNull()
  })

  it("plegar con foco dentro mueve el foco al chevron y no pierde dirty", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    const titulo = await screen.findByLabelText("Título")
    await user.clear(titulo)
    await user.type(titulo, "Básico editado")

    ;(titulo as HTMLElement).focus()
    const toggle = screen.getByRole("button", { name: "Colapsar detalles del curso" })
    fireEvent.click(toggle)

    await waitFor(() => expect(document.activeElement).toBe(toggle))

    fireEvent.click(screen.getByRole("button", { name: "Expandir detalles del curso" }))
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Básico editado")
  })

  it("plegado con dirty conserva el guard al cambiar de curso", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await user.click(await screen.findByRole("button", { name: /Básico/ }))
    await user.clear(await screen.findByLabelText("Título"))
    await user.type(screen.getByLabelText("Título"), "Básico editado")
    await user.click(screen.getByRole("button", { name: "Colapsar detalles del curso" }))
    expect(screen.queryByLabelText("Título")).toBeNull()

    await user.click(screen.getByRole("button", { name: /Intermedio/ }))
    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo.textContent).toContain("Tenés cambios sin guardar")
  })
})

describe("CourseManager buscador [CU-5]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    resetNav()
    localStorage.clear()
  })

  it("filtra por título insensible a tildes y muestra mensaje de cero resultados", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await screen.findByRole("button", { name: /Básico/ })
    await screen.findByRole("button", { name: /Intermedio/ })

    const input = screen.getByPlaceholderText("Buscar curso...")
    await user.type(input, "basico")
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Básico/ })).toBeDefined()
      expect(screen.queryByRole("button", { name: /Intermedio/ })).toBeNull()
    })

    await user.clear(input)
    await user.type(input, "zzz sin match")
    expect(await screen.findByText(/Sin resultados para «zzz sin match»/)).toBeDefined()
  })

  it("espeja la búsqueda en ?q= y limpiar restaura la lista", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await screen.findByRole("button", { name: /Básico/ })
    const input = screen.getByPlaceholderText("Buscar curso...")
    await user.type(input, "intermedio")
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Básico/ })).toBeNull()
    )
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining("q=intermedio"),
      { scroll: false }
    )

    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }))
    await screen.findByRole("button", { name: /Básico/ })
    expect((input as HTMLInputElement).value).toBe("")
  })

  it("init desde ?q= filtra sin tipear", async () => {
    nav.q = "intermedio"
    mockBase()
    render(<CourseManager canDelete />)

    await screen.findByRole("button", { name: /Intermedio/ })
    expect(screen.queryByRole("button", { name: /Básico/ })).toBeNull()
    expect((screen.getByPlaceholderText("Buscar curso...") as HTMLInputElement).value).toBe("intermedio")
  })

  it("combina búsqueda con chip de estado", async () => {
    mockBase()
    const user = userEvent.setup()
    render(<CourseManager canDelete />)

    await screen.findByRole("button", { name: /Básico/ })
    await user.click(screen.getByRole("button", { name: "Publicado" }))
    const input = screen.getByPlaceholderText("Buscar curso...")
    await user.type(input, "intermedio")
    expect(await screen.findByText(/Sin resultados para «intermedio»/)).toBeDefined()
  })
})