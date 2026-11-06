import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PerfilHeader } from "./perfil-header"

const stats = { favorites: 3, views: 10, coursesInProgress: 1, lessonsCompleted: 7 }

describe("PerfilHeader", () => {
  it("shows name, email and role with the initial avatar", () => {
    render(
      <PerfilHeader
        name="María"
        email="maria@test.com"
        role="user"
        image={null}
        loading={false}
        stats={stats}
      />
    )
    expect(screen.getByRole("heading", { name: "María" })).toBeDefined()
    expect(screen.getByText("maria@test.com")).toBeDefined()
    expect(screen.getByText("user")).toBeDefined()
    // Avatar por inicial cuando no hay foto de Google
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("shows the Google photo when available", () => {
    render(
      <PerfilHeader
        name="María"
        email="maria@test.com"
        image="https://lh3.googleusercontent.com/a/photo"
        loading={false}
        stats={stats}
      />
    )
    const img = document.querySelector("img")
    expect(img?.getAttribute("src")).toBe("https://lh3.googleusercontent.com/a/photo")
  })

  it("falls back to the email prefix without a name", () => {
    render(
      <PerfilHeader
        name={null}
        email="maria@test.com"
        loading={false}
        stats={stats}
      />
    )
    expect(screen.getByRole("heading", { name: "maria" })).toBeDefined()
  })

  it("shows the four stats", () => {
    render(
      <PerfilHeader
        name="María"
        email="maria@test.com"
        loading={false}
        stats={stats}
      />
    )
    expect(screen.getByText("Favoritas")).toBeDefined()
    expect(screen.getByText("Vistas")).toBeDefined()
    expect(screen.getByText("Cursos en curso")).toBeDefined()
    expect(screen.getByText("Lecciones completadas")).toBeDefined()
    expect(screen.getByText("3")).toBeDefined()
    expect(screen.getByText("10")).toBeDefined()
  })
})
