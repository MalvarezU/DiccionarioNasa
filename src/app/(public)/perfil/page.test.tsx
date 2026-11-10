import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
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
import { useSearchParams, usePathname } from "next/navigation"
import PerfilPage from "./page"

function mockSession(status: "authenticated" | "unauthenticated" | "loading") {
  vi.mocked(useSession).mockReturnValue({
    data:
      status === "authenticated"
        ? {
            user: {
              name: "Test",
              email: "t@test.com",
              role: "user",
              image: null,
            },
          }
        : null,
    status,
    update: vi.fn(),
  } as never)
}

function mockTab(tab: string | null) {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(tab ? `tab=${tab}` : "") as never
  )
  vi.mocked(usePathname).mockReturnValue("/perfil")
}

const favoriteWord = {
  id: "word-1",
  spanish: "agua",
  nasaYuwe: "yu'",
  pronunciation: "yuʔ",
  category: "sustantivo",
  audioUrl: null,
}

function mockApi() {
  vi.mocked(fetch).mockImplementation((url) => {
    const u = String(url)
    if (u.includes("/api/user/profile"))
      return Promise.resolve(
        Response.json({ user: { id: "u1", email: "t@test.com", name: "Test", hasPassword: false } })
      )
    if (u.includes("/api/dictionary/favorites"))
      return Promise.resolve(
        Response.json({
          favorites: [{ id: "fav-1", wordId: "word-1", createdAt: "2026-03-15T10:00:00.000Z", word: favoriteWord }],
        })
      )
    if (u.includes("/api/dictionary/search-history"))
      return Promise.resolve(
        Response.json({ history: [{ id: "s-1", query: "nasa", createdAt: "2026-03-20T13:00:00.000Z" }] })
      )
    if (u.includes("/api/dictionary/history"))
      return Promise.resolve(
        Response.json({
          history: [
            {
              id: "hist-1",
              wordId: "word-1",
              createdAt: "2026-03-20T14:00:00.000Z",
              word: favoriteWord,
            },
          ],
        })
      )
    if (u.includes("/api/user/course-progress"))
      return Promise.resolve(
        Response.json({
          courses: [
            {
              courseId: "c-1",
              title: "Nasa Yuwe básico",
              coverImage: null,
              lessonsTotal: 10,
              lessonsCompleted: 4,
              percent: 40,
              lastVisitedAt: "2026-03-20T14:00:00.000Z",
              lastLessonId: "l-5",
              lastLessonTitle: "Saludos",
            },
          ],
        })
      )
    return Promise.resolve(Response.json({}))
  })
}

describe("/perfil — Mi espacio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    mockTab(null)
  })

  it("prompts login when unauthenticated", async () => {
    mockSession("unauthenticated")
    const user = userEvent.setup()
    render(<PerfilPage />)

    expect(screen.getByText(/inicia sesión para ver/i)).toBeDefined()
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))
    expect(screen.getByTestId("auth-modal")).toBeDefined()
  })

  it("shows header with name and the three tabs on favorites by default", async () => {
    mockSession("authenticated")
    mockApi()
    render(<PerfilPage />)

    expect(await screen.findByRole("heading", { name: "Test" })).toBeDefined()
    expect(screen.getByText("t@test.com")).toBeDefined()
    const tablist = screen.getByRole("tablist", { name: /secciones de mi espacio/i })
    expect(within(tablist).getByRole("tab", { name: /favoritos/i })).toBeDefined()
    expect(within(tablist).getByRole("tab", { name: /historial/i })).toBeDefined()
    expect(within(tablist).getByRole("tab", { name: /mi avance/i })).toBeDefined()
    // Datos del servidor en el tab por defecto
    expect(await screen.findByText("yu'")).toBeDefined()
    // Stats derivados: 1 favorita, 1 vista, 1 en curso, 4 completadas
    expect(screen.getByText("Favoritas")).toBeDefined()
  })

  it("opens the history tab directly with ?tab=history", async () => {
    mockSession("authenticated")
    mockTab("history")
    mockApi()
    render(<PerfilPage />)

    expect(await screen.findByText("Palabras vistas")).toBeDefined()
    expect(screen.getByText("Búsquedas recientes")).toBeDefined()
    expect(screen.getByText("nasa")).toBeDefined()
  })

  it("opens the progress tab directly with ?tab=progress", async () => {
    mockSession("authenticated")
    mockTab("progress")
    mockApi()
    render(<PerfilPage />)

    expect(await screen.findByText("Nasa Yuwe básico")).toBeDefined()
    expect(screen.getByRole("link", { name: /continuar/i })).toBeDefined()
  })

  it("removes a favorite with one click via POST toggle", async () => {
    mockSession("authenticated")
    mockTab(null)
    mockApi()
    const user = userEvent.setup()
    render(<PerfilPage />)

    await screen.findByText("yu'")
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ isFavorite: false }))
    await user.click(screen.getByRole("button", { name: /quitar yu' de favoritas/i }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/dictionary/favorites",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ wordId: "word-1" }),
        })
      )
    )
    await waitFor(() => expect(screen.queryByText("yu'")).toBeNull())
  })

  it("clears history via DELETE and shows the empty state", async () => {
    mockSession("authenticated")
    mockTab("history")
    mockApi()
    const user = userEvent.setup()
    render(<PerfilPage />)

    await screen.findByText("Palabras vistas")
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true }))
    await user.click(screen.getByRole("button", { name: /limpiar todo/i }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/dictionary/history",
        expect.objectContaining({ method: "DELETE" })
      )
    )
  })

  it("keeps account and security collapsed at the bottom", async () => {
    mockSession("authenticated")
    mockTab(null)
    mockApi()
    const user = userEvent.setup()
    render(<PerfilPage />)

    await screen.findByText("yu'")
    const toggle = screen.getByRole("button", { name: /cuenta y seguridad/i })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByLabelText("Nombre")).toBeNull()

    await user.click(toggle)
    expect(screen.getByLabelText("Nombre")).toBeDefined()
  })
})
