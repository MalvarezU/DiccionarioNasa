import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })),
}))

import { signIn } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { AuthModal } from "./auth-modal"

const onOpenChange = vi.fn()

describe("AuthModal (Google-first)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })
  })

  it("renders Google as the primary action and no register mode", () => {
    render(<AuthModal open={true} onOpenChange={onOpenChange} />)
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /continuar con google/i })).toBeDefined()
    // Sin registro por correo: no hay modo "Crear cuenta" ni "Regístrate"
    expect(screen.queryByRole("button", { name: /crear cuenta/i })).toBeNull()
    expect(screen.queryByText("Regístrate")).toBeNull()
    // Sin formulario de credenciales visible por defecto
    expect(screen.queryByPlaceholderText("tu@email.com")).toBeNull()
  })

  it("renders nothing when closed", () => {
    const { container } = render(<AuthModal open={false} onOpenChange={onOpenChange} />)
    expect(container.innerHTML).toBe("")
  })

  it("never calls the removed /api/auth/register endpoint", async () => {
    const user = userEvent.setup()
    render(<AuthModal open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /continuar con google/i }))
    await user.click(screen.getByRole("button", { name: /correo y contraseña/i }))
    await user.type(screen.getByPlaceholderText("tu@email.com"), "test@test.com")
    await user.type(screen.getByPlaceholderText("Tu contraseña"), "password123")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /iniciar sesión con correo/i }))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.join(" ")).not.toContain("/api/auth/register")
  })

  it("requires terms before Google sign-in", async () => {
    const { toast } = vi.mocked(useToast)()
    const user = userEvent.setup()
    render(<AuthModal open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /continuar con google/i }))

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Aceptación requerida" })
    )
    expect(signIn).not.toHaveBeenCalled()
  })

  it("calls Google sign-in after accepting terms", async () => {
    const user = userEvent.setup()
    render(<AuthModal open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /continuar con google/i }))

    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" })
  })

  it("reveals credentials only after expanding the secondary toggle", async () => {
    const user = userEvent.setup()
    render(<AuthModal open={true} onOpenChange={onOpenChange} />)

    const toggle = screen.getByRole("button", { name: /correo y contraseña/i })
    expect(toggle).toHaveProperty("tagName", "BUTTON")
    expect(toggle.getAttribute("aria-expanded")).toBe("false")

    await user.click(toggle)

    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByPlaceholderText("tu@email.com")).toBeDefined()
    expect(screen.getByPlaceholderText("Tu contraseña")).toBeDefined()
    expect(screen.getByRole("button", { name: /iniciar sesión con correo/i })).toBeDefined()
  })

  it("requires terms before credentials login", async () => {
    const { toast } = vi.mocked(useToast)()
    const user = userEvent.setup()
    render(<AuthModal open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /correo y contraseña/i }))
    await user.type(screen.getByPlaceholderText("tu@email.com"), "test@test.com")
    await user.type(screen.getByPlaceholderText("Tu contraseña"), "password123")
    await user.click(screen.getByRole("button", { name: /iniciar sesión con correo/i }))

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Aceptación requerida" })
    )
    expect(signIn).not.toHaveBeenCalled()
  })

  it("calls signIn with credentials on submit after accepting terms", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: "" })
    const user = userEvent.setup()

    render(<AuthModal open={true} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole("button", { name: /correo y contraseña/i }))
    await user.type(screen.getByPlaceholderText("tu@email.com"), "test@test.com")
    await user.type(screen.getByPlaceholderText("Tu contraseña"), "password123")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /iniciar sesión con correo/i }))

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "test@test.com",
      password: "password123",
      redirect: false,
    })
  })

  it("shows error toast on failed login", async () => {
    const { toast } = vi.mocked(useToast)()
    vi.mocked(signIn).mockResolvedValue({ error: "Invalid credentials", ok: false, status: 401, url: "" })
    const user = userEvent.setup()

    render(<AuthModal open={true} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole("button", { name: /correo y contraseña/i }))
    await user.type(screen.getByPlaceholderText("tu@email.com"), "bad@test.com")
    await user.type(screen.getByPlaceholderText("Tu contraseña"), "wrong")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /iniciar sesión con correo/i }))

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error al iniciar sesión" })
    )
  })

  it("shows welcome toast and closes on successful login", async () => {
    const { toast } = vi.mocked(useToast)()
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: "" })
    const user = userEvent.setup()

    render(<AuthModal open={true} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole("button", { name: /correo y contraseña/i }))
    await user.type(screen.getByPlaceholderText("tu@email.com"), "test@test.com")
    await user.type(screen.getByPlaceholderText("Tu contraseña"), "password123")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /iniciar sesión con correo/i }))

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "¡Bienvenido/a!" })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("opens the legal modal in place instead of navigating [terminos]", async () => {
    const user = userEvent.setup()
    render(<AuthModal open={true} onOpenChange={onOpenChange} />)

    expect(document.querySelector('a[target="_blank"]')).toBeNull()

    await user.click(screen.getByRole("button", { name: /términos y condiciones/i }))
    expect(screen.getByRole("heading", { name: /términos y privacidad/i })).toBeDefined()
  })

  it("accepting in the legal modal checks the terms box [terminos]", async () => {
    const user = userEvent.setup()
    render(<AuthModal open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /política de privacidad/i }))
    await user.click(screen.getByRole("button", { name: /aceptar términos y privacidad/i }))

    expect(screen.getByRole("checkbox")).toHaveProperty("checked", true)
  })
})
