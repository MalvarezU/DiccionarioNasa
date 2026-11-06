import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { FeaturedCourseCard } from "./featured-course-card"
import type { CourseSummary } from "./course-card"

const base: CourseSummary = {
  id: "c9",
  title: "Curso Destacado",
  description: "Aprendé saludos y presentaciones.",
  modules: 3,
  lessons: 12,
  progressPct: null,
}

const COVER = "https://cdn.test/cover.jpg"

describe("FeaturedCourseCard", () => {
  it("sin cover usa placeholder con ícono (sin img y sin overlay)", () => {
    const { container } = render(<FeaturedCourseCard course={base} />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("svg")).not.toBeNull()
    expect(container.querySelector(".mix-blend-multiply")).toBeNull()
    expect(screen.getByText("Comenzar")).toBeDefined()
  })

  it("F-E5: eyebrow 'Curso sugerido' + aria-label canonizado sin 'Destacado'", () => {
    const { container } = render(<FeaturedCourseCard course={base} />)
    expect(screen.getByText("Curso sugerido")).toBeDefined()
    // Match exacto: el título del fixture es "Curso Destacado"; solo el
    // eyebrow viejo podría igualar a "Destacado".
    expect(screen.queryByText("Destacado")).toBeNull()
    expect(screen.getByLabelText("Curso sugerido: Curso Destacado")).toBeDefined()
  })

  it("con cover renderiza imagen con alt de portada", () => {
    render(
      <FeaturedCourseCard
        course={{ ...base, coverImage: COVER }}
      />
    )
    const img = screen.getByAltText("Portada de Curso Destacado")
    expect(img.getAttribute("src")).toMatch(/cover\.jpg/)
  })

  it("F-E3 overlay duotone: grayscale + mix-blend-multiply solo con cover", () => {
    const { container, unmount } = render(
      <FeaturedCourseCard course={{ ...base, coverImage: COVER }} />
    )
    const img = screen.getByAltText("Portada de Curso Destacado")
    expect(img.className).toMatch(/grayscale/)
    expect(container.querySelector(".mix-blend-multiply")).not.toBeNull()
    unmount()
    const { container: sinCover } = render(<FeaturedCourseCard course={base} />)
    expect(sinCover.querySelector(".mix-blend-multiply")).toBeNull()
  })

  it("con progreso muestra Continuar + % tabular", () => {
    const { container } = render(<FeaturedCourseCard course={{ ...base, progressPct: 40 }} />)
    expect(screen.getByText("Continuar")).toBeDefined()
    expect(screen.getByText("40% completado")).toBeDefined()
    expect(container.querySelector(".tabular-nums")).not.toBeNull()
  })

  it("stretched-link apunta al curso", () => {
    render(<FeaturedCourseCard course={base} />)
    const link = screen.getByText("Curso Destacado").closest("a")
    expect(link?.getAttribute("href")).toBe("/cursos/c9")
  })

  it("sin lecciones muestra badge Sin contenido y no enlaza", () => {
    render(<FeaturedCourseCard course={{ ...base, lessons: 0 }} />)
    expect(screen.getByText("Sin contenido")).toBeDefined()
    expect(screen.queryByText("Comenzar")).toBeNull()
  })

  it("coverImage vacía o ausente usa placeholder vellum-high (sin img rota)", () => {
    for (const coverImage of [undefined, null, ""]) {
      const { container, unmount } = render(
        <FeaturedCourseCard course={{ ...base, coverImage }} />
      )
      expect(container.querySelector("img")).toBeNull()
      expect(container.querySelector('[src=""]')).toBeNull()
      expect(container.querySelector("svg")).not.toBeNull()
      unmount()
    }
  })
})
