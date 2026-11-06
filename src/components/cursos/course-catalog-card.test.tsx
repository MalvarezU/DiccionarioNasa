import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CourseCatalogCard } from "./course-catalog-card"
import type { CourseSummary } from "./course-card"

const base: CourseSummary = {
  id: "c1",
  title: "Nasa Yuwe básico",
  description: "Ruta inicial para saludar y presentarse.",
  modules: 2,
  lessons: 8,
  progressPct: null,
}

describe("CourseCatalogCard", () => {
  it("navegable: link al curso + CTA Comenzar + descripción y meta visibles", () => {
    render(<CourseCatalogCard course={base} />)
    const link = screen.getByText("Nasa Yuwe básico").closest("a")
    expect(link?.getAttribute("href")).toBe("/cursos/c1")
    expect(screen.getByText("Comenzar")).toBeDefined()
    expect(
      screen.getByText("Ruta inicial para saludar y presentarse.")
    ).toBeDefined()
    expect(screen.getByText("2 módulos · 8 lecciones")).toBeDefined()
  })

  it("no numera: sin 01 en el DOM", () => {
    const { container } = render(<CourseCatalogCard course={base} />)
    expect(screen.queryByText("01")).toBeNull()
    expect(container.textContent).not.toMatch(/\b01\b/)
  })

  it("en curso muestra badge + Continuar", () => {
    render(<CourseCatalogCard course={{ ...base, progressPct: 25 }} />)
    expect(screen.getByText("En curso")).toBeDefined()
    expect(screen.getByText("Continuar")).toBeDefined()
  })

  it("completado muestra badge Completado", () => {
    render(<CourseCatalogCard course={{ ...base, progressPct: 100 }} />)
    expect(screen.getByText("Completado")).toBeDefined()
  })

  it("sin lecciones: sin link, badge Sin contenido", () => {
    render(
      <CourseCatalogCard course={{ ...base, lessons: 0, modules: 0 }} />
    )
    expect(screen.getByText("Nasa Yuwe básico").closest("a")).toBeNull()
    expect(screen.getByText("Sin contenido")).toBeDefined()
  })

  it("borrador bloqueado con badge Borrador", () => {
    render(<CourseCatalogCard course={{ ...base, status: "DRAFT" }} />)
    expect(screen.getByText("Nasa Yuwe básico").closest("a")).toBeNull()
    expect(screen.getByText("Borrador")).toBeDefined()
  })

  it("archivado bloqueado con badge Archivado", () => {
    render(<CourseCatalogCard course={{ ...base, status: "ARCHIVED" }} />)
    expect(screen.getByText("Nasa Yuwe básico").closest("a")).toBeNull()
    expect(screen.getByText("Archivado")).toBeDefined()
  })
})
