import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import {
  AdminDashboardSkeleton,
  CourseCardSkeleton,
  CourseGridSkeleton,
  CoursePlayerSkeleton,
  ExploreListSkeleton,
  FavoritesGridSkeleton,
  FeaturedWordCardSkeleton,
  FeaturedWordsGridSkeleton,
  HistorySkeleton,  HomeSkeleton,
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
      [<FeaturedWordCardSkeleton key="e2" />, "skeleton-featured-word-card"],
      [<FeaturedWordsGridSkeleton key="e3" />, "skeleton-featured-words-grid"],
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

    const { container: destacadas } = render(<FeaturedWordsGridSkeleton count={6} />)
    expect(destacadas.querySelectorAll('[data-slot="skeleton-featured-word-card"]')).toHaveLength(6)

    const { container: tabla } = render(<WordTableSkeleton rows={5} />)
    expect(tabla.querySelectorAll('[data-slot="skeleton-table-row"]')).toHaveLength(5)
  })

  it("es estático: no usa clases animate-* (decisión explícita del usuario)", () => {
    // El barrido de luz se descartó: la animación no se leía. Los skeletons
    // quedan quietos. Si algún día se quiere movimiento, hay que revertir
    // este bloque y la decisión del usuario que lo originó.
    const { container } = render(<CourseCardSkeleton />)
    const markup = container.innerHTML
    expect(markup).not.toMatch(/animate-/)
  })

  it("rellena con el token muted de la paleta (arena cálida), no con verde ni blanco", () => {
    // El relleno es --muted: queda un tono por debajo del card, suficiente
    // para leerse como hueco, y es un color que ya existía en la paleta.
    // Fija el contrato para que nadie vuelva al bg-accent (verde moss).
    const { container } = render(<WordDetailSkeleton />)
    const bloque = container.querySelector('[data-slot="skeleton"]')
    expect(bloque?.className).toContain("bg-muted")
    expect(bloque?.className).toContain("border-outline-variant")
    expect(bloque?.className).not.toContain("bg-accent")
    expect(bloque?.className).not.toContain("bg-white")
  })

  it("el skeleton de la ficha replica los bloques que el usuario va a leer", () => {
    const { container } = render(<WordDetailSkeleton />)
    const barras = container.querySelectorAll('[data-slot="skeleton"]')
    // titulo + pronunciación + botón de audio + 4 atributos + descripción
    expect(barras.length).toBeGreaterThanOrEqual(9)
  })

  it("el skeleton del player replica header + grid (sin pop del encabezado)", () => {
    // El header del curso (breadcrumbs + back-link + tile + título + meta +
    // descripción) llegaba de golpe tras el skeleton del grid. El skeleton
    // ahora pinta primero la zona del header con la misma composición
    // (mb-8/space-y-3/mb-4) para que el swap sea fade, no aparición.
    const { container } = render(<CoursePlayerSkeleton />)
    const root = container.querySelector('[data-testid="skeleton-course-player"]')
    expect(root).toBeTruthy()
    // header + grid
    expect(root!.children).toHaveLength(2)
    const header = root!.children[0]
    // breadcrumbs (5 segmentos) + back-link + bloque título + descripción
    expect(header.children.length).toBeGreaterThanOrEqual(3)
    // grid sidebar + canvas
    const grid = root!.children[1]
    expect(grid.children).toHaveLength(2)
  })

  it("no renderiza texto de estado legible", () => {
    // Un skeleton con "Cargando..." escrita adentro duplica el trabajo: el
    // usuario no necesita leer para saber que espera.
    const { container } = render(<AdminDashboardSkeleton />)
    expect(container.textContent?.trim()).toBe("")
  })
})