import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CourseCelebration } from "./course-celebration"
import type { CourseSummary } from "@/components/cursos/course-card"

const matchMediaOrig = window.matchMedia

function mockMatchMedia(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: reduce,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

const suggestions: CourseSummary[] = [
  { id: "c2", title: "Curso 2", description: "Segundo", modules: 1, lessons: 4, progressPct: null, status: "PUBLISHED" },
  { id: "c3", title: "Curso 3", description: "Tercero", modules: 2, lessons: 6, progressPct: 10, status: "PUBLISHED" },
]

const baseProps = {
  courseTitle: "Nasa Yuwe Básico",
  completedCount: 12,
  totalCount: 12,
  suggestions,
  onRepasar: () => {},
}

describe("CourseCelebration", () => {
  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: matchMediaOrig,
    })
  })

  it("muestra título, curso y métrica", () => {
    mockMatchMedia(false)
    render(<CourseCelebration {...baseProps} />)
    expect(screen.getByText("¡Curso completado!")).toBeDefined()
    expect(screen.getByText("«Nasa Yuwe Básico»")).toBeDefined()
    expect(screen.getByText(/Completaste 12 de 12 lecciones/)).toBeDefined()
  })

  it("muestra confetti salvo reduced-motion", () => {
    mockMatchMedia(false)
    const { container } = render(<CourseCelebration {...baseProps} />)
    expect(container.querySelector(".game-confetti")).not.toBeNull()
  })

  it("sin confetti con prefers-reduced-motion", () => {
    mockMatchMedia(true)
    const { container } = render(<CourseCelebration {...baseProps} />)
    expect(container.querySelector(".game-confetti")).toBeNull()
  })

  it("Repasar llama onRepasar", () => {
    mockMatchMedia(false)
    const onRepasar = vi.fn()
    render(<CourseCelebration {...baseProps} onRepasar={onRepasar} />)
    fireEvent.click(screen.getByRole("button", { name: /Repasar el curso/ }))
    expect(onRepasar).toHaveBeenCalledTimes(1)
  })

  it("Ver más cursos enlaza al catálogo", () => {
    mockMatchMedia(false)
    render(<CourseCelebration {...baseProps} />)
    const link = screen.getByRole("link", { name: /Ver más cursos/ })
    expect(link.getAttribute("href")).toBe("/cursos")
  })

  it("renderiza las sugerencias recibidas", () => {
    mockMatchMedia(false)
    render(<CourseCelebration {...baseProps} />)
    expect(screen.getByText("Sigue aprendiendo")).toBeDefined()
    expect(screen.getByText("Curso 2")).toBeDefined()
    expect(screen.getByText("Curso 3")).toBeDefined()
  })

  it("sin sugerencias no muestra la sección", () => {
    mockMatchMedia(false)
    render(<CourseCelebration {...baseProps} suggestions={[]} />)
    expect(screen.queryByText("Sigue aprendiendo")).toBeNull()
  })

  it("sección accesible con labelledby", () => {
    mockMatchMedia(false)
    render(<CourseCelebration {...baseProps} />)
    const section = screen.getByRole("region", { name: "¡Curso completado!" })
    expect(section).toBeDefined()
  })
})
