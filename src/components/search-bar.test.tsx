import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}))

vi.mock("@/hooks/use-debounce", () => ({
  useDebounce: (value: string) => value,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

vi.mock("@/lib/local-db", () => ({
  searchLocalWords: vi.fn().mockResolvedValue([]),
  isLocalDBReady: vi.fn().mockResolvedValue(false),
}))

vi.mock("./suggest-word-modal", () => ({
  SuggestWordModal: () => <div data-testid="suggest-modal" />,
}))

vi.mock("./word-detail-card", () => ({
  WordDetailCard: ({ wordId, open }: { wordId: string | null; open: boolean }) =>
    open && wordId ? <div data-testid="word-detail-card" /> : null,
}))

import { useOnlineStatus } from "@/hooks/use-online-status"
import { searchLocalWords, isLocalDBReady } from "@/lib/local-db"
import { SearchBar } from "./search-bar"

Element.prototype.scrollIntoView = vi.fn()

function mockDB() {
  vi.mocked(searchLocalWords).mockResolvedValue([])
  vi.mocked(isLocalDBReady).mockResolvedValue(false)
}

const mockResults = [
  { id: "1", spanish: "Sol", nasaYuwe: "atek", pronunciation: "a-tek", category: "naturaleza" },
  { id: "2", spanish: "Luna", nasaYuwe: "kiwe", pronunciation: "ki-we", category: "naturaleza" },
]

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    mockDB()
  })

  it("renders search input with placeholder", () => {
    render(<SearchBar />)
    expect(screen.getByPlaceholderText("Buscar en Nasa Yuwe o Español...")).toBeDefined()
  })

  it("shows dropdown with results after typing 2+ chars", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ results: mockResults })
    )
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByRole("combobox")
    await user.type(input, "so")

    expect(await screen.findByText("atek")).toBeDefined()
    expect(screen.getByText("— Sol")).toBeDefined()
  })

  it("does not show dropdown with 1 char", async () => {
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByRole("combobox")
    await user.type(input, "s")

    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("does not show results while loading", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByRole("combobox")
    await user.type(input, "so")

    // Results not shown while loading
    expect(screen.queryByText("atek")).toBeNull()
    expect(screen.queryByText("— Sol")).toBeNull()
  })

  it("shows suggest button when no results", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ results: [] })
    )
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByRole("combobox")
    await user.type(input, "xyz")

    expect(await screen.findByText("No encontramos")).toBeDefined()
    expect(screen.getByText(/sugerir/i)).toBeDefined()
  })

  it("searches locally when offline", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(isLocalDBReady).mockResolvedValue(true)
    vi.mocked(searchLocalWords).mockResolvedValue(mockResults)
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByRole("combobox")
    await user.type(input, "so")

    expect(await screen.findByText("atek")).toBeDefined()
    expect(searchLocalWords).toHaveBeenCalledWith("so", 50)
  })

  it("shows offline indicator below input", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<SearchBar />)
    expect(screen.getByText("Búsqueda local (sin conexión)")).toBeDefined()
  })

  it("navigates with arrow keys and selects with enter", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ results: mockResults })
    )
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByRole("combobox")
    await user.type(input, "so")
    expect(await screen.findByText("atek")).toBeDefined()

    await user.keyboard("{ArrowDown}")
    await user.keyboard("{Enter}")

    expect(await screen.findByTestId("word-detail-card")).toBeDefined()
  })

  it("closes dropdown on escape", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ results: mockResults })
    )
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByRole("combobox")
    await user.type(input, "so")
    expect(await screen.findByRole("listbox")).toBeDefined()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("opens suggest modal when suggest button is clicked", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ results: [] })
    )
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByRole("combobox")
    await user.type(input, "xyz")
    expect(await screen.findByText("No encontramos")).toBeDefined()

    await user.click(screen.getByRole("button", { name: /sugerir/i }))
    expect(screen.getByTestId("suggest-modal")).toBeDefined()
  })

  it("shows online indicator for hero variant", () => {
    render(<SearchBar variant="hero" />)
    expect(screen.getByText("Búsqueda en línea")).toBeDefined()
  })

  it("calls onWordSelect when result is clicked", async () => {
    const onWordSelect = vi.fn()
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ results: mockResults })
    )
    const user = userEvent.setup()
    render(<SearchBar onWordSelect={onWordSelect} />)

    const input = screen.getByRole("combobox")
    await user.type(input, "so")
    const item = await screen.findByText("atek")
    await user.click(item)

    expect(onWordSelect).toHaveBeenCalledWith("1")
  })
})
