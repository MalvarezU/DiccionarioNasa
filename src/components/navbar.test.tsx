import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

vi.mock("./auth-modal", () => ({
  AuthModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="auth-modal" /> : null,
}))

vi.mock("./settings-dialog", () => ({
  SettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="settings-dialog" /> : null,
}))

import { useSession, signOut } from "next-auth/react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { NavBar } from "./navbar"

function mockSession(session: { user?: { name?: string; email?: string; role?: string } } | null) {
  vi.mocked(useSession).mockReturnValue({ data: session, status: session ? "authenticated" : "unauthenticated", update: vi.fn() })
}

function mockOnline(online: boolean) {
  vi.mocked(useOnlineStatus).mockReturnValue(online)
}

describe("NavBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnline(true)
    mockSession(null)
  })

  it("renders the app name as a link", () => {
    render(<NavBar />)
    expect(screen.getByText("Nasa Yuwe")).toBeDefined()
  })

  it("shows online badge when connected", () => {
    render(<NavBar />)
    expect(screen.getByText("En línea")).toBeDefined()
  })

  it("shows offline badge when disconnected", () => {
    mockOnline(false)
    render(<NavBar />)
    expect(screen.getByText("Sin conexión")).toBeDefined()
  })

  it("shows login button when not authenticated", () => {
    render(<NavBar />)
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeDefined()
  })

  it("shows user avatar when authenticated", () => {
    mockSession({ user: { name: "Mario", email: "mario@test.com", role: "user" } })
    render(<NavBar />)
    expect(screen.getByText("M")).toBeDefined()
  })

  it("shows user dropdown with favorites, history and logout", async () => {
    mockSession({ user: { name: "Mario", email: "mario@test.com", role: "user" } })
    const user = userEvent.setup()
    render(<NavBar />)

    await user.click(screen.getByText("M"))
    expect(screen.getByText("Mis favoritos")).toBeDefined()
    expect(screen.getByText("Mi historial")).toBeDefined()
    expect(screen.getByText("Cerrar sesión")).toBeDefined()
  })

  it("shows admin link for admin users", async () => {
    mockSession({ user: { name: "Admin", email: "admin@test.com", role: "admin" } })
    const user = userEvent.setup()
    render(<NavBar />)

    await user.click(screen.getByText("A"))
    expect(screen.getByText("Panel de administración")).toBeDefined()
  })

  it("opens auth modal when login button is clicked", async () => {
    const user = userEvent.setup()
    render(<NavBar />)

    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))
    expect(screen.getByTestId("auth-modal")).toBeDefined()
  })

  it("opens settings when gear icon is clicked", async () => {
    const user = userEvent.setup()
    render(<NavBar />)

    await user.click(screen.getByLabelText("Configuración"))
    expect(screen.getByTestId("settings-dialog")).toBeDefined()
  })

  it("calls signOut when logout is clicked", async () => {
    mockSession({ user: { name: "Mario", email: "mario@test.com", role: "user" } })
    const user = userEvent.setup()
    render(<NavBar />)

    await user.click(screen.getByText("M"))
    await user.click(screen.getByText("Cerrar sesión"))
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
  })
})
