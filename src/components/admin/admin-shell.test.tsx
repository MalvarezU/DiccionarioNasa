import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}))

import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { AdminShell } from "./admin-shell"

function mockAdmin() {
  vi.mocked(useSession).mockReturnValue({
    data: {
      user: { name: "Ada Admin", email: "admin@x.com", role: "admin" } as never,
      expires: "2099-01-01T00:00:00Z",
    },
    status: "authenticated",
    update: vi.fn(),
  })
}

function mockEditor() {
  vi.mocked(useSession).mockReturnValue({
    data: {
      user: { name: "Edi Editor", email: "ed@x.com", role: "editor" } as never,
      expires: "2099-01-01T00:00:00Z",
    },
    status: "authenticated",
    update: vi.fn(),
  })
}

describe("AdminShell [F1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePathname).mockReturnValue("/admin")
  })

  it("muestra las 6 secciones al admin con la activa marcada", () => {
    mockAdmin()
    render(
      <AdminShell>
        <p>hola</p>
      </AdminShell>
    )

    for (const label of ["Resumen", "Palabras", "Gestión de cursos", "Ilustraciones", "Audios", "Usuarios"]) {
      // La miga de pan repite la sección activa: puede haber 1 o 2 nodos.
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
    // La activa del sidebar lleva aria-current="page" en su enlace...
    const enlacesResumen = screen
      .getAllByText("Resumen")
      .map((el) => el.closest("a"))
      .filter((a): a is HTMLAnchorElement => a !== null)
    expect(enlacesResumen).toHaveLength(1)
    expect(enlacesResumen[0]?.getAttribute("aria-current")).toBe("page")
    // ...y la miga actual también (Panel > Resumen).
    const migas = screen.getByRole("navigation", { name: "Migas de pan" })
    expect(within(migas).getByText("Resumen").getAttribute("aria-current")).toBe("page")
    expect(screen.getByText("Admin")).toBeDefined()
    expect(screen.getByText("Salir al diccionario")).toBeDefined()
  })

  it("oculta Usuarios al editor y muestra badge Editor", () => {
    mockEditor()
    render(
      <AdminShell>
        <p>hola</p>
      </AdminShell>
    )

    expect(screen.queryByText("Usuarios")).toBeNull()
    expect(screen.getByText("Editor")).toBeDefined()
    // El resto de secciones sí visibles
    expect(screen.getByText("Palabras")).toBeDefined()
    expect(screen.getByText("Gestión de cursos")).toBeDefined()
  })

  it("marca la ruta activa según pathname", () => {
    mockAdmin()
    vi.mocked(usePathname).mockReturnValue("/admin/cursos")
    render(
      <AdminShell>
        <p>hola</p>
      </AdminShell>
    )
    expect(screen.getByText("Gestión de cursos").closest("a")?.getAttribute("aria-current")).toBe("page")
    expect(screen.getByText("Resumen").closest("a")?.getAttribute("aria-current")).toBeNull()
  })

  it("muestra skeleton mientras la sesión carga", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "loading",
      update: vi.fn(),
    } as never)
    render(
      <AdminShell>
        <p>hola</p>
      </AdminShell>
    )
    expect(screen.getByLabelText("Cargando sesión")).toBeDefined()
  })
})
