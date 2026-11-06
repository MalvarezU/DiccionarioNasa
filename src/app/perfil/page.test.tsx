import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/components/navbar", () => ({
  NavBar: () => null,
}))

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => null,
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="auth-modal" /> : null,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })),
}))

import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import PerfilPage from "./page"

function mockSession(status: "authenticated" | "unauthenticated" | "loading") {
  vi.mocked(useSession).mockReturnValue({
    data: status === "authenticated" ? { user: { email: "t@test.com" }, expires: "2099" } : null,
    status,
    update: vi.fn(),
  } as never)
}

const profileWithoutPassword = {
  user: { id: "u1", email: "t@test.com", name: "Test", hasPassword: false, onboardedAt: "2026-01-01T00:00:00.000Z" },
}

describe("/perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })
  })

  it("prompts login when unauthenticated", async () => {
    mockSession("unauthenticated")
    const user = userEvent.setup()
    render(<PerfilPage />)

    expect(screen.getByText(/inicia sesión para ver/i)).toBeDefined()
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))
    expect(screen.getByTestId("auth-modal")).toBeDefined()
  })

  it("shows profile data and create-password form when hasPassword is false", async () => {
    mockSession("authenticated")
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(profileWithoutPassword))
    render(<PerfilPage />)

    await waitFor(() => expect(screen.getByDisplayValue("t@test.com")).toBeDefined())
    expect(screen.getByDisplayValue("Test")).toBeDefined()
    expect(screen.getByRole("heading", { name: /crear contraseña/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /^crear contraseña$/i })).toBeDefined()
  })

  it("edits name via PATCH profile", async () => {
    const { toast } = vi.mocked(useToast)()
    mockSession("authenticated")
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json(profileWithoutPassword))
      .mockResolvedValueOnce(Response.json({ user: { id: "u1", email: "t@test.com", name: "Nuevo" } }))
    const user = userEvent.setup()
    render(<PerfilPage />)

    await waitFor(() => expect(screen.getByDisplayValue("Test")).toBeDefined())
    await user.clear(screen.getByLabelText("Nombre"))
    await user.type(screen.getByLabelText("Nombre"), "Nuevo")
    await user.click(screen.getByRole("button", { name: /guardar nombre/i }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nuevo" }),
      })
    )
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Nombre actualizado" }))
  })

  it("creates password via POST /api/auth/password when none exists", async () => {
    mockSession("authenticated")
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json(profileWithoutPassword))
      .mockResolvedValueOnce(Response.json({ ok: true }))
    const user = userEvent.setup()
    render(<PerfilPage />)

    await waitFor(() => expect(screen.getByPlaceholderText("Mínimo 8 caracteres")).toBeDefined())
    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "password123")
    await user.type(screen.getByPlaceholderText("Repite tu contraseña"), "password123")
    await user.click(screen.getByRole("button", { name: /^crear contraseña$/i }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "password123" }),
      })
    )
  })

  it("changes password via POST /api/auth/password/change when one exists", async () => {
    mockSession("authenticated")
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        Response.json({ user: { ...profileWithoutPassword.user, hasPassword: true } })
      )
      .mockResolvedValueOnce(Response.json({ ok: true }))
    const user = userEvent.setup()
    render(<PerfilPage />)

    await waitFor(() => expect(screen.getByRole("heading", { name: /cambiar contraseña/i })).toBeDefined())
    await user.type(screen.getByPlaceholderText("Tu contraseña actual"), "oldpass123")
    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "newpass123")
    await user.type(screen.getByPlaceholderText("Repite tu contraseña"), "newpass123")
    await user.click(screen.getByRole("button", { name: /^cambiar contraseña$/i }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: "oldpass123", newPassword: "newpass123" }),
      })
    )
  })
})
