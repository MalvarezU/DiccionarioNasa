import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CursosPage from "./page"

vi.mock("@/components/navbar", () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <div data-testid="footer" />,
}))

vi.mock("@/components/breadcrumbs", () => ({
  Breadcrumbs: () => <nav data-testid="breadcrumbs" />,
}))

const mockSession: { data: unknown; status: string } = {
  data: null,
  status: "unauthenticated",
}

vi.mock("next-auth/react", () => ({
  useSession: () => mockSession,
}))

function mockList(courses: unknown[], opts?: { listOk?: boolean }) {
  vi.mocked(fetch).mockImplementation(((url: string) => {
    if (url === "/api/courses" && opts?.listOk === false) {
      return Promise.resolve({ ok: false, status: 500 } as Response)
    }
    if (url === "/api/courses") {
      return Promise.resolve(Response.json({ courses }))
    }
    if (url === "/api/courses?all=1") {
      return Promise.resolve(Response.json({ courses }))
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`))
  }) as typeof fetch)
}

describe("/cursos [B2.2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    localStorage.clear()
    mockSession.data = null
    mockSession.status = "unauthenticated"
  })

  it("lista cursos publicados con avance", async () => {
    mockList([
      { id: "c1", title: "Básico", description: "d", modules: 2, lessons: 4, progressPct: 50 },
    ])
    render(<CursosPage />)
    expect(await screen.findByText("Básico")).toBeDefined()
    expect(screen.getByText("50% completado")).toBeDefined()
  })

  it("estado vacío sin cursos", async () => {
    mockList([])
    render(<CursosPage />)
    expect(await screen.findByText(/Aún no hay cursos/)).toBeDefined()
  })

  it("muestra skeleton de bandas mientras carga", async () => {
    mockList([])
    const { container } = render(<CursosPage />)
    expect(
      container.querySelector('[data-testid="skeleton-course-list-bands"]')
    ).not.toBeNull()
    await screen.findByText(/Aún no hay cursos/)
  })

  it("error de fetch muestra alerta visible, no skeleton infinito", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("caído"))
    render(<CursosPage />)
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toMatch(/No pudimos cargar/)
    expect(
      document.querySelector('[data-testid="skeleton-course-list-bands"]')
    ).toBeNull()
  })

  it("respuesta no-ok también muestra alerta", async () => {
    mockList([], { listOk: false })
    render(<CursosPage />)
    expect(await screen.findByRole("alert")).toBeDefined()
  })

  it("anónimo ve aviso de progreso local", async () => {
    mockList([
      { id: "c1", title: "Básico", description: "d", modules: 1, lessons: 2, progressPct: null },
    ])
    render(<CursosPage />)
    await screen.findByText("Básico")
    expect(screen.getByText(/tu progreso vive en este navegador/)).toBeDefined()
  })

  it("anónimo con progreso local ve resume band", async () => {
    mockList([
      { id: "c1", title: "Básico", description: "d", modules: 1, lessons: 2, progressPct: null },
    ])
    localStorage.setItem("piiyaak:course:anon:v1:c1", JSON.stringify(["l1"]))
    vi.mocked(fetch).mockImplementation(((url: string) => {
      if (url === "/api/courses") {
        return Promise.resolve(
          Response.json({
            courses: [
              { id: "c1", title: "Básico", description: "d", modules: 1, lessons: 2, progressPct: null },
            ],
          })
        )
      }
      if (url === "/api/courses/c1") {
        return Promise.resolve(
          Response.json({
            course: {
              modules: [
                { id: "m1", lessons: [{ id: "l1", title: "Uno", lessonNumber: 1 }] },
                { id: "m2", lessons: [{ id: "l2", title: "Dos", lessonNumber: 1 }] },
              ],
            },
          })
        )
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    }) as typeof fetch)
    render(<CursosPage />)
    const band = await screen.findByLabelText("Continuar Básico")
    expect(band.textContent).toMatch(/50% completado/)
    const cta = band.querySelector('a[href="/cursos/c1?leccion=l2"]')
    expect(cta).not.toBeNull()
  })

  it("con sesión muestra resume + hero retomar con ?leccion=", async () => {
    mockSession.data = { user: { id: "u1", role: "user" } }
    mockSession.status = "authenticated"
    vi.mocked(fetch).mockImplementation(((url: string) => {
      if (url === "/api/courses") {
        return Promise.resolve(
          Response.json({
            courses: [
              { id: "c1", title: "Viejo", description: "d", modules: 1, lessons: 2, progressPct: 50 },
              { id: "c2", title: "Nuevo", description: "d", modules: 1, lessons: 1, progressPct: null },
            ],
          })
        )
      }
      if (url === "/api/courses/c1") {
        return Promise.resolve(
          Response.json({
            course: {
              modules: [{ id: "m1", lessons: [{ id: "l9", title: "Nueve", lessonNumber: 2 }] }],
            },
          })
        )
      }
      if (url === "/api/courses/c1/progress") {
        return Promise.resolve(Response.json({ completedIds: [], lastVisitedLessonId: null }))
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    }) as typeof fetch)
    render(<CursosPage />)
    await screen.findByLabelText("Continuar Viejo")
    expect(screen.getByText("Retomar donde quedaste")).toBeDefined()
    // featured = el más reciente (Nuevo), no el curso en marcha
    expect(screen.getByLabelText("Curso destacado: Nuevo")).toBeDefined()
  })

  it("featured es el más reciente y rows excluyen el destacado", async () => {
    mockList([
      { id: "c1", title: "Primero", description: "d", modules: 1, lessons: 1, progressPct: null },
      { id: "c2", title: "Segundo", description: "d", modules: 1, lessons: 1, progressPct: null },
      { id: "c3", title: "Tercero", description: "d", modules: 1, lessons: 1, progressPct: null },
    ])
    render(<CursosPage />)
    await screen.findByLabelText("Curso destacado: Tercero")
    const rows = screen.getByLabelText("Todos los cursos")
    expect(rows.textContent).toMatch(/Primero/)
    expect(rows.textContent).toMatch(/Segundo/)
    expect(rows.textContent).not.toMatch(/Tercero/)
  })

  it("grid sin numeración: cards con descripción y meta, featured aparte", async () => {
    mockList([
      { id: "c1", title: "Primero", description: "Descr uno", modules: 1, lessons: 2, progressPct: null },
      { id: "c2", title: "Segundo", description: "Descr dos", modules: 2, lessons: 3, progressPct: null },
      { id: "c3", title: "Tercero", description: "Descr tres", modules: 1, lessons: 1, progressPct: null },
    ])
    render(<CursosPage />)
    await screen.findByLabelText("Curso destacado: Tercero")
    const grid = screen.getByLabelText("Todos los cursos")
    const gridInner = grid.querySelector("div.grid")
    expect(gridInner?.className).toMatch(/md:grid-cols-2/)
    expect(gridInner?.className).toMatch(/xl:grid-cols-3/)
    // Una card por curso no destacado, con descripción y meta visibles
    expect(grid.textContent).toMatch(/Descr uno/)
    expect(grid.textContent).toMatch(/Descr dos/)
    expect(grid.textContent).toMatch(/1 módulos · 2 lecciones/)
    expect(grid.textContent).not.toMatch(/Descr tres/)
    // Sin numeración del índice anterior
    expect(grid.textContent).not.toMatch(/\b01\b/)
    expect(grid.textContent).not.toMatch(/\b02\b/)
    expect(grid.textContent).not.toMatch(/\b03\b/)
  })

  it("gestión en grid con badge de borrador y sin link", async () => {
    mockSession.data = { user: { id: "u9", role: "editor" } }
    mockSession.status = "authenticated"
    vi.mocked(fetch).mockImplementation(((url: string) => {
      if (url === "/api/courses") {
        return Promise.resolve(
          Response.json({
            courses: [{ id: "c1", title: "Pub", description: "d", modules: 1, lessons: 1, progressPct: null }],
          })
        )
      }
      if (url === "/api/courses?all=1") {
        return Promise.resolve(
          Response.json({
            courses: [
              { id: "c1", title: "Pub", description: "d", status: "PUBLISHED", modules: 1, lessons: 1, progressPct: null },
              { id: "cd", title: "Borrador X", description: "desc borrador", status: "DRAFT", modules: 0, lessons: 0, progressPct: null },
            ],
          })
        )
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    }) as typeof fetch)
    render(<CursosPage />)
    const gestion = await screen.findByLabelText("Cursos en gestión")
    const gestionInner = gestion.querySelector("div.grid")
    expect(gestionInner?.className).toMatch(/md:grid-cols-2/)
    expect(gestionInner?.className).toMatch(/xl:grid-cols-3/)
    expect(screen.getByText("Borrador X")).toBeDefined()
    expect(screen.getByText("desc borrador")).toBeDefined()
    expect(screen.getByText("Borrador")).toBeDefined()
    expect(screen.getByText("Borrador X").closest("a")).toBeNull()
  })

  it("editor ve apartado de gestión con borradores", async () => {
    mockSession.data = { user: { id: "u9", role: "editor" } }
    mockSession.status = "authenticated"
    vi.mocked(fetch).mockImplementation(((url: string) => {
      if (url === "/api/courses") {
        return Promise.resolve(
          Response.json({
            courses: [{ id: "c1", title: "Pub", description: "d", modules: 1, lessons: 1, progressPct: null }],
          })
        )
      }
      if (url === "/api/courses?all=1") {
        return Promise.resolve(
          Response.json({
            courses: [
              { id: "c1", title: "Pub", description: "d", status: "PUBLISHED", modules: 1, lessons: 1, progressPct: null },
              { id: "cd", title: "Borrador X", description: "d", status: "DRAFT", modules: 0, lessons: 0, progressPct: null },
            ],
          })
        )
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    }) as typeof fetch)
    render(<CursosPage />)
    await screen.findByLabelText("Cursos en gestión")
    expect(screen.getByText("Borrador X")).toBeDefined()
  })

  it("click en CTA de error reintenta (reload)", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockRejectedValue(new Error("caído"))
    const reload = vi.fn()
    Object.defineProperty(window, "location", {
      value: { reload },
      writable: true,
      configurable: true,
    })
    render(<CursosPage />)
    await user.click(await screen.findByText("Reintentar"))
    expect(reload).toHaveBeenCalled()
  })
})
