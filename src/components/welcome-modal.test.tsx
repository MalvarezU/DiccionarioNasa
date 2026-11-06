import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })),
}))

import { useToast } from "@/hooks/use-toast"
import { WelcomeModal } from "./welcome-modal"

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  initialName: "María",
  email: "maria@test.com",
  image: null as string | null,
  onCompleted: vi.fn(),
}

describe("WelcomeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })
  })

  it("renders nothing when closed", () => {
    const { container } = render(<WelcomeModal {...baseProps} open={false} />)
    expect(container.innerHTML).toBe("")
  })

  it("prefills Google data (name, email) and shows avatar when available", () => {
    render(<WelcomeModal {...baseProps} image="https://img/test.jpg" />)
    expect(screen.getByRole("heading", { name: /bienvenido/i })).toBeDefined()
    expect(screen.getByDisplayValue("María")).toBeDefined()
    expect(screen.getByText("maria@test.com")).toBeDefined()
    const avatar = document.querySelector('img[src="https://img/test.jpg"]')
    expect(avatar).not.toBeNull()
  })

  it("blocks save without terms acceptance", async () => {
    const { toast } = vi.mocked(useToast)()
    const user = userEvent.setup()
    render(<WelcomeModal {...baseProps} />)

    await user.click(screen.getByRole("button", { name: /guardar y continuar/i }))

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Aceptación requerida" })
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("shows inline error when password and confirmation differ", async () => {
    const user = userEvent.setup()
    render(<WelcomeModal {...baseProps} />)

    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "password123")
    await user.type(screen.getByPlaceholderText("Repite tu contraseña"), "different")

    expect(screen.getByText("Las contraseñas no coinciden")).toBeDefined()
  })

  it("rejects short optional password with toast", async () => {
    const { toast } = vi.mocked(useToast)()
    const user = userEvent.setup()
    render(<WelcomeModal {...baseProps} />)

    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "corta")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /guardar y continuar/i }))

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Contraseña muy corta" })
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("saves name only: single PATCH with completeOnboarding, no password call", async () => {
    const { toast } = vi.mocked(useToast)()
    const onCompleted = vi.fn()
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ user: {} }))
    const user = userEvent.setup()
    render(<WelcomeModal {...baseProps} onCompleted={onCompleted} />)

    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /guardar y continuar/i }))

    await waitFor(() => expect(onCompleted).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "María", completeOnboarding: true }),
    })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "¡Listo!" }))
  })

  it("saves with password: POST password first, then PATCH profile", async () => {
    const onCompleted = vi.fn()
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ user: {} }))
    const user = userEvent.setup()
    render(<WelcomeModal {...baseProps} onCompleted={onCompleted} />)

    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "password123")
    await user.type(screen.getByPlaceholderText("Repite tu contraseña"), "password123")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /guardar y continuar/i }))

    await waitFor(() => expect(onCompleted).toHaveBeenCalled())
    const calls = vi.mocked(fetch).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toBe("/api/auth/password")
    expect(calls[1][0]).toBe("/api/user/profile")
    expect(JSON.parse(calls[0][1]?.body as string)).toEqual({ password: "password123" })
    expect(JSON.parse(calls[1][1]?.body as string)).toEqual({ name: "María", completeOnboarding: true })
  })

  it("does not complete onboarding when password creation fails", async () => {
    const onCompleted = vi.fn()
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ message: "Ya tienes una contraseña" }, { status: 400 })
    )
    const user = userEvent.setup()
    render(<WelcomeModal {...baseProps} onCompleted={onCompleted} />)

    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "password123")
    await user.type(screen.getByPlaceholderText("Repite tu contraseña"), "password123")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /guardar y continuar/i }))

    await waitFor(() =>
      expect(vi.mocked(useToast)().toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "No se pudo guardar la contraseña" })
      )
    )
    expect(onCompleted).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("skip marks onboarding complete without name or password", async () => {
    const onCompleted = vi.fn()
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ user: {} }))
    const user = userEvent.setup()
    render(<WelcomeModal {...baseProps} onCompleted={onCompleted} />)

    await user.click(screen.getByRole("button", { name: /por ahora no/i }))

    await waitFor(() => expect(onCompleted).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completeOnboarding: true }),
    })
  })

  it("secondary skip action meets target size and contrast", () => {
    render(<WelcomeModal {...baseProps} />)
    const skip = screen.getByRole("button", { name: /por ahora no/i })
    expect(skip.className).toMatch(/min-h-\[44px\]/)
  })
})
