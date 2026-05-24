import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

const toastMock = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}))

import { useSession } from "next-auth/react"
import { UserManagementSection } from "./user-management-section"

const mockUsers = [
  {
    id: "user-1",
    email: "admin@test.com",
    name: "Admin User",
    role: "admin",
    createdAt: "2024-01-15T10:00:00Z",
    _count: { favorites: 5, viewHistory: 12 },
  },
  {
    id: "user-2",
    email: "user@test.com",
    name: null,
    role: "user",
    createdAt: "2024-03-20T14:30:00Z",
    _count: { favorites: 0, viewHistory: 3 },
  },
]

function renderSection() {
  return render(<UserManagementSection />)
}

describe("UserManagementSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1", email: "admin@test.com", role: "admin" } },
      status: "authenticated",
      update: vi.fn(),
    })
  })

  it("shows loading spinner initially", () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    renderSection()
    expect(document.querySelector(".animate-spin")).toBeTruthy()
  })

  it("renders users table after loading", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ users: mockUsers })
    )
    renderSection()
    expect(await screen.findByText("Admin User")).toBeDefined()
    expect(screen.getByText("admin@test.com")).toBeDefined()
    expect(screen.getByText("user@test.com")).toBeDefined()
  })

  it("shows empty state when no users", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ users: [] })
    )
    renderSection()
    expect(await screen.findByText("No hay usuarios registrados")).toBeDefined()
  })

  it("shows 'Tú' badge for current user", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ users: mockUsers })
    )
    renderSection()
    expect(await screen.findByText("Tú")).toBeDefined()
  })

  it("calls fetch with search param", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ users: mockUsers })
    )
    renderSection()
    expect(await screen.findByText("Admin User")).toBeDefined()
    const searchInput = screen.getByPlaceholderText("Buscar por email o nombre...")
    await userEvent.setup().type(searchInput, "test")
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("search=test")
    )
  })

  it("calls PATCH when toggling user role", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ users: mockUsers })
    )
    renderSection()
    const user = userEvent.setup()
    expect(await screen.findByRole("button", { name: /hacer admin/i })).toBeDefined()
    const hacerAdminBtn = screen.getByRole("button", { name: /hacer admin/i })
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "ok" }))
    await user.click(hacerAdminBtn)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-2"),
      expect.objectContaining({ method: "PATCH" })
    )
  })

  it("shows delete confirmation dialog when trash icon clicked", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ users: mockUsers })
    )
    renderSection()
    const user = userEvent.setup()
    expect(await screen.findByRole("button", { name: /eliminar usuario/i })).toBeDefined()
    const deleteBtn = screen.getByRole("button", { name: /eliminar usuario/i })
    await user.click(deleteBtn)
    expect(screen.getByText("¿Eliminar este usuario?")).toBeDefined()
    expect(screen.getByText((content) => content.startsWith("Se eliminará permanentemente"))).toBeDefined()
  })

  it("calls DELETE when confirming deletion", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ users: mockUsers })
    )
    renderSection()
    const user = userEvent.setup()
    expect(await screen.findByRole("button", { name: /eliminar usuario/i })).toBeDefined()
    const deleteBtn = screen.getByRole("button", { name: /eliminar usuario/i })
    await user.click(deleteBtn)
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "ok" }))
    const confirmBtn = screen.getByText("Eliminar usuario")
    await user.click(confirmBtn)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-2"),
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("calls toast on 403 response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("Forbidden", { status: 403 })
    )
    renderSection()
    await new Promise((r) => setTimeout(r, 100))
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Acceso denegado" })
    )
  })

  it("does not show action buttons for current user row", async () => {
    const selfOnly = [
      {
        id: "user-1",
        email: "admin@test.com",
        name: "Admin",
        role: "admin",
        createdAt: "2024-01-15T10:00:00Z",
        _count: { favorites: 5, viewHistory: 12 },
      },
    ]
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ users: selfOnly })
    )
    renderSection()
    expect(await screen.findByText("Tú")).toBeDefined()
    expect(screen.queryByRole("button", { name: /hacer admin/i })).toBeNull()
  })
})
