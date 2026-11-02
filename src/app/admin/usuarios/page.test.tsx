import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("@/components/user-management-section", () => ({
  UserManagementSection: () => <div data-testid="user-mgmt" />,
}))

import { useSession } from "next-auth/react"
import AdminUsuariosPage from "./page"

describe("AdminUsuariosPage [F1 guard]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("el editor ve 'sin permiso' y no la gestión", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "editor" } as never, expires: "2099" },
      status: "authenticated",
      update: vi.fn(),
    })
    render(<AdminUsuariosPage />)
    expect(screen.getByText("Sin permiso")).toBeDefined()
    expect(screen.queryByTestId("user-mgmt")).toBeNull()
  })

  it("el admin ve la gestión de usuarios", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "admin" } as never, expires: "2099" },
      status: "authenticated",
      update: vi.fn(),
    })
    render(<AdminUsuariosPage />)
    expect(screen.getByTestId("user-mgmt")).toBeDefined()
  })
})
