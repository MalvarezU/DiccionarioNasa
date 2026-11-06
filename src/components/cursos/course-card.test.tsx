import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CourseCard, type CourseSummary } from "./course-card"

const base: CourseSummary = {
  id: "c1",
  title: "Nasa Yuwe básico",
  description: "Ruta inicial.",
  modules: 2,
  lessons: 8,
  progressPct: null,
}

/**
 * Edge F5.e (mitad card): la portada ausente o vacía cae al placeholder
 * con ícono en vez de un <img> con src roto.
 */
describe("CourseCard coverImage", () => {
  it("sin cover usa placeholder con ícono (sin img)", () => {
    const { container } = render(<CourseCard course={base} navEnabled />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it.each([undefined, null, ""])("coverImage %p usa placeholder", (coverImage) => {
    const { container, unmount } = render(
      <CourseCard course={{ ...base, coverImage }} navEnabled />
    )
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector('[src=""]')).toBeNull()
    unmount()
  })

  it("con cover renderiza imagen con alt de portada", () => {
    render(
      <CourseCard
        course={{ ...base, coverImage: "https://cdn.test/cover.jpg" }}
        navEnabled
      />
    )
    const img = screen.getByAltText("Portada de Nasa Yuwe básico")
    expect(img.getAttribute("src")).toMatch(/cover\.jpg/)
  })

  it("statusBadge opcional: se muestra arriba-derecha sin romper el CTA", () => {
    const { container } = render(
      <CourseCard
        course={base}
        navEnabled
        statusBadge={<span data-testid="estado">En curso</span>}
      />
    )
    expect(screen.getByTestId("estado")).toBeDefined()
    expect(screen.getByTestId("estado").closest(".shrink-0")).not.toBeNull()
    expect(screen.getByText("Comenzar")).toBeDefined()
    expect(container.querySelector("a[href='/cursos/c1']")).not.toBeNull()
  })

  it("sin statusBadge no hay badge (API intacta)", () => {
    const { container } = render(<CourseCard course={base} navEnabled />)
    expect(container.textContent).not.toMatch(/En curso/)
    expect(container.textContent).not.toMatch(/Completado/)
  })
})
