import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}))

vi.mock("@/lib/local-db", () => ({
  getCachedWordOfDay: vi.fn(),
  setCachedWordOfDay: vi.fn(),
}))

import { useOnlineStatus } from "@/hooks/use-online-status"
import { getCachedWordOfDay, setCachedWordOfDay } from "@/lib/local-db"
import { WordOfDayCard } from "./word-of-day-card"

const mockWord = {
  id: "w1",
  spanish: "Sol",
  nasaYuwe: "atek",
  pronunciation: "a-tek",
  audioUrl: null,
  culturalContext: "El sol es sagrado en la cultura Nasa",
  category: "naturaleza",
  examples: null,
}

function mockOnline(online: boolean) {
  vi.mocked(useOnlineStatus).mockReturnValue(online)
}

function mockFetch(response: Response) {
  return vi.mocked(fetch).mockResolvedValueOnce(response)
}

describe("WordOfDayCard", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    vi.clearAllMocks()
    mockOnline(true)
    vi.mocked(getCachedWordOfDay).mockResolvedValue(null)
    vi.mocked(setCachedWordOfDay).mockResolvedValue(undefined)
  })

  it("shows loading state initially", () => {
    // Keep fetch unresolved so loading persists
    global.fetch = vi.fn(() => new Promise(() => {}))
    render(<WordOfDayCard />)
    expect(screen.getByText("Cargando...")).toBeDefined()
  })

  it("renders word from server", async () => {
    mockFetch(
      Response.json({ word: mockWord, date: "2026-05-24" })
    )
    render(<WordOfDayCard />)

    expect(await screen.findByText("Sol")).toBeDefined()
    expect(screen.getByText("atek")).toBeDefined()
    expect(screen.getByText("[a-tek]")).toBeDefined()
    expect(screen.getByText("naturaleza")).toBeDefined()
    expect(screen.getByText("Ver ficha completa")).toBeDefined()
  })

  it("shows no-connection state when offline and no cache", async () => {
    mockOnline(false)
    vi.mocked(getCachedWordOfDay).mockResolvedValue(null)

    render(<WordOfDayCard />)
    expect(await screen.findByText("Conéctate para descubrir la palabra del día")).toBeDefined()
  })

  it("shows cached word when offline", async () => {
    mockOnline(false)
    vi.mocked(getCachedWordOfDay).mockResolvedValue({
      word: mockWord,
      date: "2026-05-23",
      cachedAt: "2026-05-23T10:00:00Z",
    })

    render(<WordOfDayCard />)
    expect(await screen.findByText("Sol")).toBeDefined()
    expect(screen.getByText("atek")).toBeDefined()
    // Shows "sin conexión" badge
    expect(screen.getByText("sin conexión")).toBeDefined()
  })

  it("shows cached word when server fails", async () => {
    mockFetch(new Response(null, { status: 500 }))
    vi.mocked(getCachedWordOfDay).mockResolvedValue({
      word: mockWord,
      date: "2026-05-23",
      cachedAt: "2026-05-23T10:00:00Z",
    })

    render(<WordOfDayCard />)
    expect(await screen.findByText("Sol")).toBeDefined()
    expect(screen.getByText("sin conexión")).toBeDefined()
  })

  it("returns nothing when online but server fails and no cache", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"))
    vi.mocked(getCachedWordOfDay).mockResolvedValue(null)

    const { container } = render(<WordOfDayCard />)
    await vi.waitFor(() => expect(screen.queryByText("Cargando...")).toBeNull())
    // Component returns null when online and no data available
    expect(container.innerHTML).toBe("")
  })

  it("returns nothing when server returns 500 and no cache", async () => {
    mockFetch(new Response(null, { status: 500 }))
    vi.mocked(getCachedWordOfDay).mockResolvedValue(null)

    const { container } = render(<WordOfDayCard />)
    await vi.waitFor(() => expect(screen.queryByText("Cargando...")).toBeNull())
    expect(container.innerHTML).toBe("")
  })

  it("calls onWordSelect when clicking the card", async () => {
    const onWordSelect = vi.fn()
    mockFetch(
      Response.json({ word: mockWord, date: "2026-05-24" })
    )

    const user = userEvent.setup()
    render(<WordOfDayCard onWordSelect={onWordSelect} />)

    expect(await screen.findByText("Sol")).toBeDefined()
    const card = screen.getByText("Sol").closest(".cursor-pointer")!
    await user.click(card)
    expect(onWordSelect).toHaveBeenCalledWith("w1")
  })

  it("caches the word after successful server fetch", async () => {
    mockFetch(
      Response.json({ word: mockWord, date: "2026-05-24" })
    )

    render(<WordOfDayCard />)
    expect(await screen.findByText("Sol")).toBeDefined()
    expect(setCachedWordOfDay).toHaveBeenCalledWith(
      expect.objectContaining({
        word: mockWord,
        date: "2026-05-24",
      })
    )
  })

  it("does not show sin-conexión badge when fresh from server", async () => {
    mockFetch(
      Response.json({ word: mockWord, date: "2026-05-24" })
    )

    render(<WordOfDayCard />)
    expect(await screen.findByText("Sol")).toBeDefined()
    expect(screen.queryByText("sin conexión")).toBeNull()
  })
})
