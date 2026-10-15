import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import {
  AdminDashboardSkeleton,
  CourseCardSkeleton,
  CourseGridSkeleton,
  ExploreListSkeleton,
  FavoritesGridSkeleton,
  HistorySkeleton,
  HomeSkeleton,
  SearchResultsSkeleton,
  UsersTableSkeleton,
  WordDetailSkeleton,
  WordTableSkeleton,
} from "@/components/skeletons"

/**
 * Los skeletons existen para evitar el salto de layout cuando llega el dato.
 * Estos tests fijan dos cosas: que exponen un data-slot estable (contrato
 * para los tests de los componentes que los usan) y que dibujan la cantidad
 * de filas que corresponde al contenido real.
 */
describe("skeletons", () => {
  it("expone data-slot en cada skeleton compuesto", () => {
    const casos: Array<[React.ReactElement, string]> = [
      [<AdminDashboardSkeleton key="a" />, "skeleton-admin-dashboard"],
      [<CourseCardSkeleton key="b" />, "skeleton-course-card"],
      [<CourseGridSkeleton key="c" />, "skeleton-course-grid"],
      [<ExploreListSkeleton key="d" />, "skeleton-explore-list"],
      [<FavoritesGridSkeleton key="e" />, "skeleton-favorites-grid"],
      [<HistorySkeleton key="f" />, "skeleton-history"],
      [<SearchResultsSkeleton key="g" />, "skeleton-search-results"],
      [<WordDetailSkeleton key="h" />, "skeleton-word-detail"],
      [<WordTableSkeleton key="i" />, "skeleton-word-table"],
      [<UsersTableSkeleton key="j" />, "skeleton-users-table"],
      [<HomeSkeleton key="k" />, "skeleton-home"],
    ]

    for (const [elemento, slot] of casos) {
      const { container, unmount } = render(elemento)
      expect(container.querySelector(`[data-slot="${slot}"]`)).toBeTruthy()
      unmount()
    }
  })

  it("dibuja la cantidad de filas que se le pide", () => {
    const { container: grid } = render(<CourseGridSkeleton count={6} />)
    expect(grid.querySelectorAll('[data-slot="skeleton-course-card"]')).toHaveLength(6)

    const { container: palabras } = render(<SearchResultsSkeleton count={3} />)
    expect(palabras.querySelectorAll('[data-slot="skeleton-word-result"]')).toHaveLength(3)

    const { container: favs } = render(<FavoritesGridSkeleton count={8} />)
    expect(favs.querySelectorAll('[data-slot="skeleton-favorite-card"]')).toHaveLength(8)

    const { container: tabla } = render(<WordTableSkeleton rows={5} />)
    expect(tabla.querySelectorAll('[data-slot="skeleton-table-row"]')).toHaveLength(5)
  })

  it("usa la misma clase de animación que el primitivo de UI", () => {
    // Si el skeleton no late, el usuario no percibe que algo está pasando.
    const { container } = render(<CourseCardSkeleton />)
    const barras = container.querySelectorAll(".animate-pulse")
    expect(barras.length).toBeGreaterThan(0)
  })

  it("el skeleton de la ficha replica los bloques que el usuario va a leer", () => {
    const { container } = render(<WordDetailSkeleton />)
    const barras = container.querySelectorAll('[data-slot="skeleton"]')
    // titulo + pronunciación + botón de audio + 4 atributos + descripción
    expect(barras.length).toBeGreaterThanOrEqual(9)
  })

  it("no renderiza texto de estado legible", () => {
    // Un skeleton con "Cargando..." escrita adentro duplica el trabajo: el
    // usuario no necesita leer para saber que espera.
    const { container } = render(<AdminDashboardSkeleton />)
    expect(container.textContent?.trim()).toBe("")
  })
})