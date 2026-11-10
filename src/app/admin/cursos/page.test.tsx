import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import AdminCoursesPage from "./page"

// La página es un wrapper fino de CourseManager (ya testeado a fondo), pero
// tiene un gate de rol con implicación de seguridad: `canDelete` solo llega a
// true si el rol es admin. Eso se verifica acá.

const mockSession: { data: unknown; status: string } = {
  data: null,
  status: "unauthenticated",
}
vi.mock("next-auth/react", () => ({ useSession: () => mockSession }))

vi.mock("@/components/admin/course-manager", () => ({
  CourseManager: ({ canDelete }: { canDelete: boolean }) => (
    <div
      data-testid="course-manager"
      data-can-delete={canDelete ? "true" : "false"}
    />
  ),
}))
vi.mock("@/components/admin/admin-page-header", () => ({
  AdminPageHeader: ({ title }: { title: string }) => (
    <div data-testid="header">{title}</div>
  ),
}))

describe("/admin/cursos", () => {
  beforeEach(() => {
    mockSession.data = null
    mockSession.status = "unauthenticated"
  })

  it("renderiza el header de gestión de cursos", () => {
    render(<AdminCoursesPage />)
    expect(screen.getByTestId("header").textContent).toBe("Gestión de cursos")
  })

  it("pasa canDelete=true si el rol es admin", () => {
    mockSession.data = { user: { id: "u1", role: "admin" } }
    mockSession.status = "authenticated"
    render(<AdminCoursesPage />)
    expect(screen.getByTestId("course-manager").getAttribute("data-can-delete")).toBe("true")
  })

  it("pasa canDelete=false si el rol es editor", () => {
    mockSession.data = { user: { id: "u1", role: "editor" } }
    mockSession.status = "authenticated"
    render(<AdminCoursesPage />)
    expect(screen.getByTestId("course-manager").getAttribute("data-can-delete")).toBe("false")
  })

  it("pasa canDelete=false sin sesión", () => {
    render(<AdminCoursesPage />)
    expect(screen.getByTestId("course-manager").getAttribute("data-can-delete")).toBe("false")
  })
})