import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
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

// Functional stand-in for the shadcn/Radix Select: options render as plain
// buttons wired to onValueChange, so tests exercise the filter logic without
// depending on Radix portal behavior in jsdom. Production uses the real Select.
vi.mock("@/components/ui/select", async () => {
  const React = await import("react")
  const Ctx = React.createContext<(v: string) => void>(() => {})
  return {
    Select: ({ children, value, onValueChange }: any) => (
      <Ctx.Provider value={onValueChange}>
        <div data-slot="select" data-value={value}>
          {children}
        </div>
      </Ctx.Provider>
    ),
    SelectTrigger: ({ children, ...props }: any) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectGroup: ({ children }: any) => <div>{children}</div>,
    SelectLabel: ({ children }: any) => <div>{children}</div>,
    SelectSeparator: () => <hr />,
    SelectItem: ({ children, value }: any) => {
      const onChange = React.useContext(Ctx)
      return (
        <button type="button" onClick={() => onChange(value)}>
          {children}
        </button>
      )
    },
  }
})

import { useVirtualizer } from "@tanstack/react-virtual"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { getAllLocalWords, isLocalDBReady, getNormalizedInitial } from "@/lib/local-db"
import { INDEX_ROW_HEIGHT } from "./use-explore-words"
import { ExploreSection } from "./explore-section"

// The virtualizer mock renders every row: it reads the real `count` the hook
// computed (chunked multi-entry rows) and lays rows out at fixed height.
function mockVirtualizerByCount() {
  vi.mocked(useVirtualizer).mockImplementation((opts: any) => {
    const count = opts?.count ?? 0
    const items = Array.from({ length: count }, (_, index) => ({
      index,
      key: `row-${index}`,
      start: index * INDEX_ROW_HEIGHT,
      size: INDEX_ROW_HEIGHT,
      end: index * INDEX_ROW_HEIGHT + INDEX_ROW_HEIGHT,
      lane: 0,
    }))
    const getVirtualItems = Object.assign(() => items, { updateDeps: vi.fn() })
    return {
      getVirtualItems,
      getTotalSize: () => count * INDEX_ROW_HEIGHT,
      scrollToIndex: vi.fn(),
      measureElement: vi.fn(),
    } as never
  })
}

function mockMatchMedia({ xl = false, md = false } = {}) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("1280") ? xl : query.includes("768") ? md : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  })
}

const mockWords = [
  { id: "w1", spanish: "Agua", nasaYuwe: "yu'", pronunciation: "yuʔ", category: "sustantivo", culturalContext: null },
  { id: "w2", spanish: "Sol", nasaYuwe: "ate", pronunciation: null, category: null, culturalContext: null },
  { id: "w3", spanish: "Casa", nasaYuwe: "kxãwã", pronunciation: "kshawa", category: "sustantivo", culturalContext: null },
]

const sameLetterWords = [
  { id: "a1", spanish: "Alba", nasaYuwe: "alba-yu", pronunciation: "alba", category: null, culturalContext: null },
  { id: "a2", spanish: "Agua", nasaYuwe: "yu'", pronunciation: "yuʔ", category: null, culturalContext: null },
  { id: "a3", spanish: "Ave", nasaYuwe: "ave-yu", pronunciation: null, category: null, culturalContext: null },
  { id: "a4", spanish: "Ala", nasaYuwe: "ala-yu", pronunciation: "ala", category: null, culturalContext: null },
]

describe("ExploreSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    mockMatchMedia()
    mockVirtualizerByCount()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(isLocalDBReady).mockResolvedValue(false)
    vi.mocked(getNormalizedInitial).mockImplementation(
      (s: string | null) => (s ? s[0].toUpperCase() : "#")
    )
  })

  it("muestra un skeleton del listado mientras carga", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    const { container } = render(<ExploreSection onWordSelect={vi.fn()} />)
    // Filas fantasma con la forma del listado, no un spinner centrado.
    const lista = await waitFor(() =>
      container.querySelector('[data-slot="skeleton-explore-list"]'),
    )
    expect(lista).toBeTruthy()
    expect(container.querySelectorAll('[data-slot="skeleton-table-row"], [data-slot="skeleton-explore-list"] > div').length)
      .toBeGreaterThan(0)
    expect(screen.queryByText("Cargando diccionario...")).toBeNull()
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

  it("shows the 'Índice' title", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByRole("heading", { name: "Índice" })).toBeDefined()
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

  it("shows one entry per row on a single column", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    const { container } = render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    // 3 letters → 3 single-entry rows
    expect(container.querySelectorAll('[data-index]').length).toBe(3)
  })

  it("chunks same-letter words into multi-entry rows on xl screens", async () => {
    mockMatchMedia({ xl: true })
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: sameLetterWords })
    )
    const { container } = render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Alba")).toBeDefined()
    // 4 words at 3 columns → 2 rows (3 + 1)
    expect(container.querySelectorAll('[data-index]').length).toBe(2)
    const firstRow = container.querySelector('[data-index="0"] > div')
    expect(firstRow?.getAttribute("style")).toContain("repeat(3,")
    // All four entries are reachable
    for (const name of ["Alba", "Agua", "Ave", "Ala"]) {
      expect(screen.getByText(name)).toBeDefined()
    }
  })

  it("shows the sticky letter strip with current letter and count", async () => {
    mockMatchMedia({ xl: true })
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: sameLetterWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Alba")).toBeDefined()
    const scroll = screen.getByTestId("explore-scroll")
    expect(within(scroll).getByText("Aa")).toBeDefined()
    expect(within(scroll).getByText("4 palabras")).toBeDefined()
  })

  it("updates the sticky strip when the list scrolls", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    const scroll = screen.getByTestId("explore-scroll") as HTMLElement
    scroll.scrollTop = INDEX_ROW_HEIGHT + 10
    fireEvent.scroll(scroll)
    expect(within(scroll).getByText("Cc")).toBeDefined()
    expect(within(scroll).getByText("1 palabra")).toBeDefined()
  })

  it("marks the current letter and disables empty letters in the rail", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: mockWords })
    )
    render(<ExploreSection onWordSelect={vi.fn()} />)
    expect(await screen.findByText("Agua")).toBeDefined()
    // Current letter (first group) carries aria-current on both rails
    for (const btn of screen.getAllByRole("button", { name: "Ir a la letra A" })) {
      expect(btn.getAttribute("aria-current")).toBe("true")
    }
    // A letter without words is disabled with aria-disabled
    for (const btn of screen.getAllByRole("button", { name: "Ir a la letra Z" })) {
      expect(btn.hasAttribute("disabled")).toBe(true)
      expect(btn.getAttribute("aria-disabled")).toBe("true")
    }
    // A letter with words but not current stays enabled without aria-current
    for (const btn of screen.getAllByRole("button", { name: "Ir a la letra C" })) {
      expect(btn.hasAttribute("disabled")).toBe(false)
      expect(btn.hasAttribute("aria-current")).toBe(false)
    }
  })
})
