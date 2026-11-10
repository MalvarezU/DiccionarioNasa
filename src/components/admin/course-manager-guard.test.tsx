import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
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
import {
  COURSES,
  DETAIL_C1,
  DETAIL_C2,
  mockBase,
  detailCalls,
  resetNavState,
  installJsdomPolyfills,
} from "./course-manager-test-setup"

installJsdomPolyfills()

function resetNav() {
  resetNavState(nav)
}

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