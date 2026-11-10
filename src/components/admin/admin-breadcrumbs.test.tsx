import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}))

import { usePathname } from "next/navigation"
import { AdminBreadcrumbs } from "./admin-breadcrumbs"

function currentLabel() {
  return document.querySelector('[aria-current="page"]')?.textContent
}

describe("AdminBreadcrumbs [F4]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("en /admin muestra Inicio / Admin actual", () => {
    vi.mocked(usePathname).mockReturnValue("/admin")
    render(<AdminBreadcrumbs />)

    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("href")).toBe("/")
    expect(currentLabel()).toBe("Admin")
  })

  it("en sección muestra Inicio / Admin / Sección actual", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/palabras")
    render(<AdminBreadcrumbs />)

    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("href")).toBe("/")
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin")
    expect(currentLabel()).toBe("Palabras")
  })

  it("en editor de lección muestra Gestión de cursos / Lección sin ids crudos", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/cursos/c1/lecciones/l2")
    const { container } = render(<AdminBreadcrumbs />)

    expect(screen.getByRole("link", { name: "Gestión de cursos" }).getAttribute("href")).toBe(
      "/admin/cursos"
    )
    expect(currentLabel()).toBe("Lección")
    expect(container.textContent).not.toContain("c1")
    expect(container.textContent).not.toContain("l2")
  })

  it("en detalle genérico muestra Detalle sin el id crudo", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/cursos/c1")
    const { container } = render(<AdminBreadcrumbs />)

    expect(currentLabel()).toBe("Detalle")
    expect(container.textContent).not.toContain("c1")
  })
})
