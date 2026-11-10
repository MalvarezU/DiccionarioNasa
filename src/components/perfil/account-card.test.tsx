import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })),
}))

import { useToast } from "@/hooks/use-toast"
import { AccountCard } from "./account-card"
import type { PerfilProfile } from "./use-perfil-data"

const baseProfile: PerfilProfile = {
  id: "u1",
  email: "t@test.com",
  name: "Test",
  hasPassword: false,
}

function renderCard(profile: PerfilProfile = baseProfile) {
  const onProfileChange = vi.fn()
  render(<AccountCard profile={profile} onProfileChange={onProfileChange} />)
  return { onProfileChange }
}

async function openCard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /cuenta y seguridad/i }))
}

describe("AccountCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })
  })

  it("starts collapsed and expands on click", async () => {
    const user = userEvent.setup()
    renderCard()
    const toggle = screen.getByRole("button", { name: /cuenta y seguridad/i })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByLabelText("Nombre")).toBeNull()

    await openCard(user)
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByLabelText("Nombre")).toBeDefined()
  })

  it("edits name via PATCH profile", async () => {
    const { toast } = vi.mocked(useToast)()
    const user = userEvent.setup()
    const { onProfileChange } = renderCard()
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ user: { id: "u1", email: "t@test.com", name: "Nuevo" } })
    )
    await openCard(user)

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
    expect(onProfileChange).toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Nombre actualizado" }))
  })

  it("creates password via POST /api/auth/password when none exists", async () => {
    const user = userEvent.setup()
    renderCard()
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ok: true }))
    await openCard(user)

    expect(screen.getByRole("heading", { name: /crear contraseña/i })).toBeDefined()
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
    const user = userEvent.setup()
    renderCard({ ...baseProfile, hasPassword: true })
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ok: true }))
    await openCard(user)

    expect(screen.getByRole("heading", { name: /cambiar contraseña/i })).toBeDefined()
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
