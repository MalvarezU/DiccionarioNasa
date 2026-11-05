import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CourseIndexRow } from "./course-index-row"
import type { CourseSummary } from "./course-card"

const base: CourseSummary = {
  id: "c1",
  title: "Nasa Yuwe básico",
  description: "d",
  modules: 2,
  lessons: 8,
  progressPct: null,
}

describe("CourseIndexRow", () => {
  it("número serif con formato 01 y link al curso", () => {
    const { container } = render(<CourseIndexRow course={base} index={0} />)
    expect(container.querySelector(".font-serif")?.textContent).toBe("01")
    const link = screen.getByText("Nasa Yuwe básico").closest("a")
    expect(link?.getAttribute("href")).toBe("/cursos/c1")
    expect(screen.getByText("Comenzar")).toBeDefined()
  })

  it("en curso muestra badge + Continuar + %", () => {
    render(<CourseIndexRow course={{ ...base, progressPct: 25 }} index={4} />)
    expect(screen.getByText("En curso")).toBeDefined()
    expect(screen.getByText("Continuar")).toBeDefined()
    expect(screen.getByText(/25%/)).toBeDefined()
    expect(screen.getByText("05")).toBeDefined()
  })

  it("completado muestra badge Completado", () => {
    render(<CourseIndexRow course={{ ...base, progressPct: 100 }} index={1} />)
    expect(screen.getByText("Completado")).toBeDefined()
  })

  it("sin lecciones: sin link, badge Sin contenido", () => {
    render(
      <CourseIndexRow
        course={{ ...base, lessons: 0, modules: 0 }}
        index={2}
      />
    )
    expect(screen.getByText("Nasa Yuwe básico").closest("a")).toBeNull()
    expect(screen.getByText("Sin contenido")).toBeDefined()
  })

  it("borrador muestra badge Borrador", () => {
    render(
      <CourseIndexRow
        course={{ ...base, status: "DRAFT" }}
        index={0}
      />
    )
    expect(screen.getByText("Borrador")).toBeDefined()
  })
})
