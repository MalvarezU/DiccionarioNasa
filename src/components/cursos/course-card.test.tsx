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

  it("con cover renderiza imagen con alt de portada y padre relative (fill)", () => {
    const { container } = render(
      <CourseCard
        course={{ ...base, coverImage: "https://cdn.test/cover.jpg" }}
        navEnabled
      />
    )
    const img = screen.getByAltText("Portada de Nasa Yuwe básico")
    expect(img.getAttribute("src")).toMatch(/cover\.jpg/)
    // next/image fill exige padre relative: el contrato del layout.
    expect(img.parentElement?.className).toMatch(/relative/)
    expect(container.innerHTML).toMatch(/aspect-\[16\/9\]/)
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

/**
 * F-C: layout horizontal — cover al lado del título, un solo interactivo
 * real (Link stretched), CTA decorativo, bloqueado sin progreso.
 */
describe("CourseCard horizontal", () => {
  it("título envuelto en Link al curso + descripción y meta visibles", () => {
    render(<CourseCard course={base} navEnabled />)
    const link = screen.getByText("Nasa Yuwe básico").closest("a")
    expect(link?.getAttribute("href")).toBe("/cursos/c1")
    expect(screen.getByText("Ruta inicial.")).toBeDefined()
    expect(screen.getByText("2 módulos · 8 lecciones")).toBeDefined()
  })

  it("un solo interactivo real: el CTA es decorativo (aria-hidden)", () => {
    const { container } = render(<CourseCard course={base} navEnabled />)
    expect(container.querySelectorAll("a")).toHaveLength(1)
    expect(screen.getByText("Comenzar").closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("con progreso muestra Continuar + % tabular", () => {
    const { container } = render(
      <CourseCard course={{ ...base, progressPct: 40 }} navEnabled />
    )
    expect(screen.getByText("Continuar")).toBeDefined()
    expect(screen.getByText("40% completado")).toBeDefined()
    expect(container.querySelector(".tabular-nums")).not.toBeNull()
  })

  it("navegable no pinta Lock", () => {
    const { container } = render(<CourseCard course={base} navEnabled />)
    expect(container.textContent).not.toMatch(/Sin contenido/)
    expect(container.querySelector('[aria-label="Avance:')).toBeNull()
  })

  it("bloqueado: misma estructura, sin link, sin progreso, con Lock y aviso", () => {
    const { container } = render(<CourseCard course={base} navEnabled={false} />)
    expect(screen.getByText("Nasa Yuwe básico").closest("a")).toBeNull()
    expect(container.querySelector('[aria-label^="Avance:"]')).toBeNull()
    expect(screen.getByText("Sin contenido")).toBeDefined()
    expect(
      screen.getByText("Este curso aún no tiene lecciones.")
    ).toBeDefined()
    // Overlay de bloqueo con Lock sobre la portada.
    expect(container.querySelector("svg")).not.toBeNull()
    expect(container.querySelectorAll("a")).toHaveLength(0)
  })

  it("bloqueado con cover: imagen en grayscale + overlay de Lock", () => {
    const { container } = render(
      <CourseCard
        course={{ ...base, coverImage: "https://cdn.test/cover.jpg" }}
        navEnabled={false}
        statusBadge={<span data-testid="estado">Borrador</span>}
      />
    )
    const img = screen.getByAltText("Portada de Nasa Yuwe básico")
    expect(img.className).toMatch(/grayscale/)
    expect(screen.getByTestId("estado")).toBeDefined()
    expect(screen.getByText("Borrador")).toBeDefined()
  })
})
