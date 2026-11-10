import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import NotFound from "./not-found"

vi.mock("@/components/navbar", () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <div data-testid="footer" />,
}))

describe("not-found [404]", () => {
  it("muestra título, explicación y rutas de salida", () => {
    render(<NotFound />)
    expect(screen.getByText("Error 404")).toBeDefined()
    expect(screen.getByRole("heading", { name: "Recurso no encontrado" })).toBeDefined()
    expect(screen.getByRole("link", { name: /Volver al diccionario/ })).toHaveProperty("href", expect.stringContaining("/diccionario"))
    expect(screen.getByRole("link", { name: "Juegos" })).toHaveProperty("href", expect.stringContaining("/juegos"))
    expect(screen.getByRole("link", { name: "Cursos" })).toHaveProperty("href", expect.stringContaining("/cursos"))
  })
})
