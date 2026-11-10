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
        loading={false}
        stats={stats}
      />
    )
    expect(screen.getByRole("heading", { name: "María" })).toBeDefined()
    expect(screen.getByText("maria@test.com")).toBeDefined()
    expect(screen.getByText("user")).toBeDefined()
    // Avatar por inicial (sin foto de perfil)
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("always shows the initial avatar, never a photo", () => {
    render(
      <PerfilHeader
        name="María"
        email="maria@test.com"
        loading={false}
        stats={stats}
      />
    )
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.getByText("M")).toBeDefined()
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
