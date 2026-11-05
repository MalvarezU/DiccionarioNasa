import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CursoDetailPage from "./page"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null })),
}))

import { useSession } from "next-auth/react"

vi.mock("@/components/navbar", () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

const COURSE = {
  id: "c1",
  title: "Básico",
  description: "d",
  status: "PUBLISHED",
  sequential: true,
  modules: [
    {
      id: "m1",
      title: "M1",
      lessons: [
        {
          id: "l1",
          title: "L1",
          lessonNumber: 1,
          content: { version: 2, blocks: [{ id: "b1", type: "text", html: "Hola" }] },
        },
        {
          id: "l2",
          title: "L2",
          lessonNumber: 2,
          content: { version: 2, blocks: [{ id: "b2", type: "text", html: "Mundo" }] },
        },
      ],
    },
    {
      id: "m2",
      title: "M2",
      lessons: [
        { id: "l3", title: "L3", lessonNumber: 1, content: { version: 2, blocks: [{ id: "b3", type: "text", html: "Tres" }] } },
      ],
    },
  ],
}

describe("/cursos/[id] player", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    window.history.replaceState(null, "", "/cursos/c1")
  })

  function mockCourse() {
    vi.mocked(fetch).mockResolvedValue(Response.json({ course: COURSE }) as never)
  }

  it("bloquea el módulo 2 hasta completar el 1 (secuencial)", async () => {
    mockCourse()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByRole("heading", { name: "Básico" })).toBeDefined()
    // El outline marca L3 como bloqueada sin deshabilitarla
    const outline = screen.getByRole("navigation", { name: /Contenido de/ })
    expect(outline.textContent).toContain("Completá el Módulo 1")
    const l3 = outline.querySelector('[data-lesson-state="locked"]')
    expect(l3).not.toBeNull()
    expect(l3).not.toBeDisabled()
    expect(l3).toHaveAttribute("aria-disabled", "true")
    // El canvas abre en la primera desbloqueada
    expect(await screen.findByRole("heading", { level: 2, name: "L1" })).toBeDefined()
    // El conteo vive en el header del curso y en el resumen del outline
    expect(screen.getAllByText("0/3 lecciones")).toHaveLength(2)
  })

  it("deep-link ?leccion= a lección bloqueada muestra el banner con CTA", async () => {
    mockCourse()
    window.history.replaceState(null, "", "/cursos/c1?leccion=l3")
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByRole("heading", { level: 2, name: "L3" })).toBeDefined()
    const banner = await screen.findByRole("status")
    expect(banner.textContent).toContain("Completá el Módulo 1")
    expect(
      screen.getByRole("button", { name: /Ir a la lección requerida/ })
    ).toBeDefined()
  })

  it("completar lección reporta progreso y desbloquea", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } as never, expires: "2099-01-01T00:00:00Z" },
      status: "authenticated",
      update: vi.fn(),
    })
    // Primera llamada: el curso; siguientes: progreso (visita, lote, completado)
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ course: COURSE }) as never)
      .mockResolvedValue(Response.json({ progress: { id: "p1" } }) as never)
    const user = userEvent.setup()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)

    // L1 ya es la activa: el child sin interactivos ofrece completar a mano
    await user.click(await screen.findByRole("button", { name: /Marcar como completada/ }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/progress",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"lessonId":"l1"'),
        })
      )
    })
    expect(await screen.findAllByText("1/3 lecciones")).toHaveLength(2)
  })

  it("fetch roto muestra error visible, jamás skeletons infinitos", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("caído"))
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByRole("alert")).toBeDefined()
    expect(screen.queryByLabelText("Cargando curso")).toBeNull()
  })
})
