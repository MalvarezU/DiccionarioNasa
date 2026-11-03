import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
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

describe("/cursos/[id] [B2.2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  function mockCourse() {
    vi.mocked(fetch).mockResolvedValue(Response.json({ course: COURSE }) as never)
  }

  it("bloquea el módulo 2 hasta completar el 1 (secuencial)", async () => {
    mockCourse()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByText("Básico")).toBeDefined()
    expect(screen.getByText("Bloqueado")).toBeDefined()
    expect(screen.getByText("0/3 lecciones")).toBeDefined()
  })

  it("completar lección reporta progreso y desbloquea", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } as never, expires: "2099-01-01T00:00:00Z" },
      status: "authenticated",
      update: vi.fn(),
    })
    // Primera llamada: el curso; siguientes: progreso
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ course: COURSE }) as never)
      .mockResolvedValue(Response.json({ progress: { id: "p1" } }) as never)
    const user = userEvent.setup()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)

    await user.click(await screen.findByText("L1"))
    await user.click(await screen.findByText("Marcar como completada"))

    expect(fetch).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"lessonId":"l1"'),
      })
    )
    expect(await screen.findByText("1/3 lecciones")).toBeDefined()
  })
})
