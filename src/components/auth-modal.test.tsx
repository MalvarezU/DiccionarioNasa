import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

import { signIn } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { AuthModal } from "./auth-modal"

const onOpenChange = vi.fn()
const emailPlaceholder = "tu@email.com"
const passwordPlaceholder = "Tu contraseña"
const regPasswordPlaceholder = "Mínimo 6 caracteres"
const confirmPlaceholder = "Repite tu contraseña"

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast: vi.fn() })
  })

  describe("login mode (default)", () => {
    it("renders login form when open", () => {
      render(<AuthModal open={true} onOpenChange={onOpenChange} />)
      expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeDefined()
      expect(screen.getByPlaceholderText(emailPlaceholder)).toBeDefined()
      expect(screen.getByPlaceholderText(passwordPlaceholder)).toBeDefined()
    })

    it("renders nothing when closed", () => {
      const { container } = render(<AuthModal open={false} onOpenChange={onOpenChange} />)
      expect(container.innerHTML).toBe("")
    })

    it("calls signIn with credentials on submit", async () => {
      vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: "" })
      const user = userEvent.setup()

      render(<AuthModal open={true} onOpenChange={onOpenChange} />)
      await user.type(screen.getByPlaceholderText(emailPlaceholder), "test@test.com")
      await user.type(screen.getByPlaceholderText(passwordPlaceholder), "password123")
      await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))

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
      await user.type(screen.getByPlaceholderText(emailPlaceholder), "bad@test.com")
      await user.type(screen.getByPlaceholderText(passwordPlaceholder), "wrong")
      await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error al iniciar sesión" })
      )
    })

    it("shows welcome toast and closes on successful login", async () => {
      const { toast } = vi.mocked(useToast)()
      vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: "" })
      const user = userEvent.setup()

      render(<AuthModal open={true} onOpenChange={onOpenChange} />)
      await user.type(screen.getByPlaceholderText(emailPlaceholder), "test@test.com")
      await user.type(screen.getByPlaceholderText(passwordPlaceholder), "password123")
      await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "¡Bienvenido/a!" })
      )
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("can switch to register mode", async () => {
      const user = userEvent.setup()
      render(<AuthModal open={true} onOpenChange={onOpenChange} />)

      await user.click(screen.getByText("Regístrate"))
      expect(screen.getByRole("heading", { name: /crear cuenta/i })).toBeDefined()
      expect(screen.getByPlaceholderText("Tu nombre")).toBeDefined()
      expect(screen.getByPlaceholderText(regPasswordPlaceholder)).toBeDefined()
    })
  })

  describe("register mode", () => {
    async function renderRegister() {
      const user = userEvent.setup()
      render(<AuthModal open={true} onOpenChange={onOpenChange} />)
      await user.click(screen.getByText("Regístrate"))
      return user
    }

    it("renders register form with name, email, password and confirm", async () => {
      await renderRegister()
      expect(screen.getByRole("heading", { name: /crear cuenta/i })).toBeDefined()
      expect(screen.getByPlaceholderText("Tu nombre")).toBeDefined()
      expect(screen.getByPlaceholderText(emailPlaceholder)).toBeDefined()
      expect(screen.getByPlaceholderText(regPasswordPlaceholder)).toBeDefined()
      expect(screen.getByPlaceholderText(confirmPlaceholder)).toBeDefined()
    })

    it("shows password mismatch error", async () => {
      const { toast } = vi.mocked(useToast)()
      const user = await renderRegister()

      await user.type(screen.getByPlaceholderText(emailPlaceholder), "test@test.com")
      await user.type(screen.getByPlaceholderText(regPasswordPlaceholder), "password123")
      await user.type(screen.getByPlaceholderText(confirmPlaceholder), "different")
      await user.click(screen.getByRole("button", { name: /crear cuenta/i }))

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Contraseñas no coinciden" })
      )
    })

    it("calls fetch and auto-login after successful register", async () => {
      const { toast } = vi.mocked(useToast)()
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ok: true })
      )
      vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: "" })

      const user = await renderRegister()

      await user.type(screen.getByPlaceholderText("Tu nombre"), "Test User")
      await user.type(screen.getByPlaceholderText(emailPlaceholder), "test@test.com")
      await user.type(screen.getByPlaceholderText(regPasswordPlaceholder), "password123")
      await user.type(screen.getByPlaceholderText(confirmPlaceholder), "password123")
      await user.click(screen.getByRole("button", { name: /crear cuenta/i }))

      expect(fetch).toHaveBeenCalledWith("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@test.com", password: "password123", name: "Test User" }),
      })

      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@test.com",
        password: "password123",
        redirect: false,
      })

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "¡Cuenta creada!" })
      )
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("shows error toast when register fails", async () => {
      const { toast } = vi.mocked(useToast)()
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ message: "Email ya registrado" }, { status: 409 })
      )

      const user = await renderRegister()

      await user.type(screen.getByPlaceholderText(emailPlaceholder), "existing@test.com")
      await user.type(screen.getByPlaceholderText(regPasswordPlaceholder), "password123")
      await user.type(screen.getByPlaceholderText(confirmPlaceholder), "password123")
      await user.click(screen.getByRole("button", { name: /crear cuenta/i }))

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error al registrarse" })
      )
    })

    it("shows inline error message when passwords do not match", async () => {
      const user = await renderRegister()

      const passwordInput = screen.getByPlaceholderText(regPasswordPlaceholder)
      const confirmInput = screen.getByPlaceholderText(confirmPlaceholder)

      await user.type(passwordInput, "password123")
      await user.type(confirmInput, "different")

      expect(screen.getByText("Las contraseñas no coinciden")).toBeDefined()
    })
  })
})
