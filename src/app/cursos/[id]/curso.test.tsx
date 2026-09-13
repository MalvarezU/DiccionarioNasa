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
          type: "READ",
          wordId: "w1",
          payload: null,
          word: {
            id: "w1",
            spanish: "Casa",
            nasaYuwe: "Yat",
            pronunciation: "yat",
            audioUrl: null,
            culturalContext: null,
            category: "sustantivo",
          },
        },
        {
          id: "l2",
          title: "L2",
          type: "READ",
          wordId: null,
          payload: null,
          word: null,
        },
      ],
    },
    {
      id: "m2",
      title: "M2",
      lessons: [
        { id: "l3", title: "L3", type: "READ", wordId: null, payload: null, word: null },
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
