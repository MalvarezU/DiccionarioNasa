import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CursosPage from "./page"

vi.mock("@/components/navbar", () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

describe("/cursos [B2.2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("lista cursos publicados con avance", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        courses: [
          { id: "c1", title: "Básico", description: "d", modules: 2, lessons: 4, progressPct: 50 },
        ],
      }) as never
    )
    render(<CursosPage />)
    expect(await screen.findByText("Básico")).toBeDefined()
    expect(screen.getByText("50% completado")).toBeDefined()
  })

  it("estado vacío sin cursos", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ courses: [] }) as never)
    render(<CursosPage />)
    expect(await screen.findByText(/Aún no hay cursos/)).toBeDefined()
  })
})
