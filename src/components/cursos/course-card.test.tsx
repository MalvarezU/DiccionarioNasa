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
})
