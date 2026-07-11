import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn(),
}))

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}))

vi.mock("@/lib/local-db", () => ({
  getAllLocalWords: vi.fn(),
  isLocalDBReady: vi.fn(),
  getNormalizedInitial: vi.fn(),
}))

import { useVirtualizer } from "@tanstack/react-virtual"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { getAllLocalWords, isLocalDBReady, getNormalizedInitial } from "@/lib/local-db"
import { ExploreSection } from "./explore-section"

function mockVirtualizer(virtualRows: Array<{ index: number; key: string; start: number; type: string }>) {
  const totalSize = virtualRows.length * 56
  vi.mocked(useVirtualizer).mockReturnValue({
    getVirtualItems: () =>
      virtualRows.map((r) => ({ ...r, size: 56, end: r.start + 56 })),
    getTotalSize: () => totalSize,
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
  })
}

const mockWords = [
  { id: "w1", spanish: "Agua", nasaYuwe: "yu'", pronunciation: "yuʔ", category: "sustantivo", culturalContext: null },
  { id: "w2", spanish: "Sol", nasaYuwe: "ate", pronunciation: null, category: null, culturalContext: null },
  { id: "w3", spanish: "Casa", nasaYuwe: "kxãwã", pronunciation: "kshawa", category: "sustantivo", culturalContext: null },
]

function setupVirtualRows(words: Array<{ id: string; spanish: string }>) {
  const sorted = [...words].sort((a, b) => a.spanish.localeCompare(b.spanish, "es"))
  const letters = [...new Set(sorted.map((w) => w.spanish[0].toUpperCase()))]
  const rows: Array<{ index: number; key: string; start: number; type: string }> = []
  let idx = 0
  let start = 0
  for (const letter of letters) {
    rows.push({ index: idx++, key: `header-${letter}`, start, type: "header" })
    start += 52
    for (const w of sorted.filter((w) => w.spanish[0].toUpperCase() === letter)) {
      rows.push({ index: idx++, key: `word-${w.id}`, start, type: "word" })
      start += 56
    }
  }
  return rows
}

describe("ExploreSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(isLocalDBReady).mockResolvedValue(false)
    vi.mocked(getNormalizedInitial).mockImplementation(
      (s: string | null) => (s ? s[0].toUpperCase() : "#")
    )

    const virtualRows = setupVirtualRows(mockWords)
    mockVirtualizer(virtualRows)
  })

  it("shows loading state", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Cargando diccionario...")).toBeDefined()
  })

  it("shows list after loading from API", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    expect(screen.getByText("Sol")).toBeDefined()
    expect(screen.getByText("Casa")).toBeDefined()
  })

  it("shows empty state when no words returned", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: [] })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("No hay palabras disponibles")).toBeDefined()
  })

  it("shows offline-downloading state when offline and DB not ready", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(isLocalDBReady).mockResolvedValue(false)
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(
      await screen.findByText("El diccionario se está descargando.")
    ).toBeDefined()
  })

  it("loads from local DB when offline", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(isLocalDBReady).mockResolvedValue(true)
    vi.mocked(getAllLocalWords).mockResolvedValue(mockWords as any)
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    expect(screen.getByText("Sol")).toBeDefined()
  })

  it("shows category filter dropdown", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    await userEvent.setup().click(screen.getByText("Filtrar por categoría"))
    expect(screen.getByRole("button", { name: "Sustantivo" })).toBeDefined()
    expect(screen.getByText("Todas las categorías")).toBeDefined()
  })

  it("filters by category", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    await userEvent.setup().click(screen.getByText("Filtrar por categoría"))
    await userEvent.setup().click(screen.getByRole("button", { name: "Sustantivo" }))
    expect(screen.getByText("Agua")).toBeDefined()
    expect(screen.getByText("Casa")).toBeDefined()
    expect(screen.queryByText("Sol")).toBeNull()
  })

  it("clears category filter when clicking 'Mostrar todas'", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    await userEvent.setup().click(screen.getByText("Filtrar por categoría"))
    await userEvent.setup().click(screen.getByRole("button", { name: "Sustantivo" }))
    expect(screen.queryByText("Sol")).toBeNull()
    await userEvent.setup().click(screen.getByText("Mostrar todas"))
    expect(screen.getByText("Sol")).toBeDefined()
  })

  it("calls onWordSelect when word is clicked", async () => {
    const onWordSelect = vi.fn()
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={onWordSelect} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    await userEvent.setup().click(screen.getByText("Agua"))
    expect(onWordSelect).toHaveBeenCalledWith("w1")
  })

  it("shows letter index buttons", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    const letterBtns = screen.getAllByRole("button", { name: /ir a la letra/i })
    expect(letterBtns.length).toBeGreaterThan(0)
  })

  it("shows word count in header", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("3 palabras")).toBeDefined()
  })

  it("falls back to local DB when API fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))
    vi.mocked(isLocalDBReady).mockResolvedValue(true)
    vi.mocked(getAllLocalWords).mockResolvedValue(mockWords as any)
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
  })

})
