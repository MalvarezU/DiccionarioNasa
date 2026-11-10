import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { GameTile, GameMotifArt, type GameMotif } from "./game-tile"

// next/link needs a router context; replace it with a plain anchor in jsdom.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

const MOTIVOS: GameMotif[] = ["flash", "memory", "gaps", "ordena", "relacionar", "escucha"]

describe("GameTile [WU-L6]", () => {
  it.each(MOTIVOS)("renderiza el motivo %s con titulo y enlace intactos", (motivo) => {
    render(
      <GameTile
        motivo={motivo}
        href="/juegos/flashcards"
        title="Flashcards"
        description="Descripcion de prueba"
      />
    )
    expect(screen.getByText("Flashcards")).toBeDefined()
    expect(screen.getByText("Descripcion de prueba")).toBeDefined()
    expect(screen.getByText("Jugar ahora")).toBeDefined()
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/juegos/flashcards"
    )
  })

  it("motivo flash muestra la mini-carta con palabra y lineas fantasma", () => {
    const { container } = render(<GameMotifArt motivo="flash" />)
    expect(screen.getByText("yuwe")).toBeDefined()
    // Front card + 3 ghost lines
    expect(container.querySelectorAll(".bg-primary\\/15").length).toBe(3)
  })

  it("motivo memory muestra una grilla 3x2 con 2 volteadas y 4 tapadas", () => {
    render(<GameMotifArt motivo="memory" />)
    expect(screen.getAllByText("·").length).toBe(2)
    expect(screen.getAllByText("?").length).toBe(4)
  })

  it("motivo gaps muestra celdas con borde inferior oliva", () => {
    const { container } = render(<GameMotifArt motivo="gaps" />)
    expect(screen.getByText("c")).toBeDefined()
    expect(screen.getByText("s")).toBeDefined()
    expect(
      container.querySelectorAll(".border-b-2.border-secondary").length
    ).toBe(2)
  })

  it("motivo ordena muestra 4 mini-tiles desordenados con letras", () => {
    const { container } = render(<GameMotifArt motivo="ordena" />)
    expect(screen.getByText("tx")).toBeDefined()
    expect(screen.getByText("sx")).toBeDefined()
    expect(container.querySelectorAll(".bg-secondary-container").length).toBe(4)
  })

  it("motivo relacionar muestra dos columnas ES ↔ NY unidas", () => {
    const { container } = render(<GameMotifArt motivo="relacionar" />)
    expect(screen.getByText("casa")).toBeDefined()
    expect(screen.getByText("yat")).toBeDefined()
    expect(screen.getByText("sol")).toBeDefined()
    expect(screen.getByText("sek")).toBeDefined()
    expect(container.querySelectorAll(".bg-secondary-container").length).toBe(2)
  })

  it("motivo escucha muestra anillos de onda + barras de ecualizador", () => {
    const { container } = render(<GameMotifArt motivo="escucha" />)
    // 2 anillos concéntricos + 5 barras de ecualizador
    expect(container.querySelectorAll(".rounded-full.border").length).toBe(2)
    expect(container.querySelectorAll(".bg-secondary").length).toBe(5)
  })

  it("locked usa 'Sin contenido' y nota por defecto", () => {
    render(
      <GameTile
        motivo="flash"
        href="/juegos/flashcards"
        title="Flashcards"
        description="Descripcion de prueba"
        locked
      />
    )
    expect(screen.getByText("Sin contenido")).toBeDefined()
    expect(screen.getByText("Este juego aún no está disponible.")).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("locked acepta badge y nota personalizados (gate de audios)", () => {
    render(
      <GameTile
        motivo="escucha"
        href="/juegos/escucha"
        title="Escucha"
        description="Descripcion de prueba"
        locked
        lockedBadge="Requiere audios"
        lockedNote="Necesita al menos 8 palabras con audio publicado."
      />
    )
    expect(screen.getByText("Requiere audios")).toBeDefined()
    expect(
      screen.getByText("Necesita al menos 8 palabras con audio publicado.")
    ).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
