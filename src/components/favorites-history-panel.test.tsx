import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="auth-modal" /> : null,
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}))

import { useSession } from "next-auth/react"
import { useIsMobile } from "@/hooks/use-mobile"
import { FavoritesHistoryPanel } from "./favorites-history-panel"

const mockFavorites = {
  favorites: [
    {
      id: "fav-1",
      wordId: "word-1",
      createdAt: "2024-03-15T10:00:00Z",
      word: {
        id: "word-1",
        spanish: "agua",
        nasaYuwe: "yu'",
        pronunciation: "yuʔ",
        category: "sustantivo",
        audioUrl: "/audio/yu.mp3",
      },
    },
  ],
}

const mockHistory = {
  history: [
    {
      id: "hist-1",
      wordId: "word-2",
      createdAt: "2024-03-20T14:00:00Z",
      word: {
        id: "word-2",
        spanish: "sol",
        nasaYuwe: "ate",
        pronunciation: null,
        category: null,
        audioUrl: null,
      },
    },
  ],
}

function renderPanel(options?: { initialTab?: "favorites" | "history" }) {
  const onWordSelect = vi.fn()
  const onOpenChange = vi.fn()
  const result = render(
    <FavoritesHistoryPanel
      open={true}
      onOpenChange={onOpenChange}
      initialTab={options?.initialTab}
      onWordSelect={onWordSelect}
    />
  )
  return { onWordSelect, onOpenChange }
}

describe("FavoritesHistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      status: "authenticated",
      update: vi.fn(),
    })
    vi.mocked(useIsMobile).mockReturnValue(false)
  })

  it("shows favorites tab by default", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockFavorites)
    )
    renderPanel()
    expect(await screen.findByText("yu'")).toBeDefined()
    expect(screen.getByText("agua")).toBeDefined()
    expect(screen.getByText(/sustantivo/)).toBeDefined()
  })

  it("shows history tab when initialTab is history", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockHistory)
    )
    renderPanel({ initialTab: "history" })
    expect(await screen.findByText("ate")).toBeDefined()
    expect(screen.getByText("sol")).toBeDefined()
  })

  it("shows dialog on desktop", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockFavorites)
    )
    renderPanel()
    expect(await screen.findByText("Mis Palabras")).toBeDefined()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
  })

  it("shows sheet on mobile", async () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockFavorites)
    )
    renderPanel()
    const sheets = document.querySelectorAll('[role="dialog"]')
    expect(sheets.length).toBeGreaterThan(0)
  })

  it("shows loading spinner for favorites", () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    renderPanel()
    expect(document.querySelector(".animate-spin")).toBeTruthy()
  })

  it("shows login prompt when not authenticated", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    })
    renderPanel()
    expect(
      await screen.findByText("Inicia sesión para ver tus favoritos")
    ).toBeDefined()
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeDefined()
  })

  it("opens auth modal when login button is clicked", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    })
    const user = userEvent.setup()
    renderPanel()
    const loginBtn = await screen.findByRole("button", { name: /iniciar sesión/i })
    await user.click(loginBtn)
    expect(screen.getByTestId("auth-modal")).toBeDefined()
  })

  it("switches to history tab when clicked", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockFavorites)
    )
    const { onOpenChange } = renderPanel()
    expect(await screen.findByText("yu'")).toBeDefined()
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockHistory)
    )
    await userEvent.setup().click(screen.getByText("Historial"))
    expect(screen.getByText("Limpiar historial")).toBeDefined()
  })

  it("calls onWordSelect and closes when word is clicked", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockFavorites)
    )
    const { onWordSelect, onOpenChange } = renderPanel()
    const card = await screen.findByText("yu'")
    await userEvent.setup().click(card)
    expect(onWordSelect).toHaveBeenCalledWith("word-1")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("clears history on button click", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockHistory)
    )
    renderPanel({ initialTab: "history" })
    const user = userEvent.setup()
    await screen.findByText("ate")
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "ok" }))
    await user.click(screen.getByText("Limpiar historial"))
    expect(fetch).toHaveBeenCalledWith(
      "/api/dictionary/history",
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("shows empty favorites message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ favorites: [] })
    )
    renderPanel()
    expect(
      await screen.findByText("No tienes palabras favoritas")
    ).toBeDefined()
  })

  it("shows empty history message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ history: [] })
    )
    renderPanel({ initialTab: "history" })
    expect(
      await screen.findByText("No tienes historial de consultas")
    ).toBeDefined()
  })

  it("shows history tab as active when clicked", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(mockFavorites)
    )
    renderPanel()
    expect(await screen.findByText("yu'")).toBeDefined()
    const favTab = screen.getByRole("button", { name: /favoritos/i })
    expect(favTab.getAttribute("aria-pressed")).toBe("true")
  })
})
