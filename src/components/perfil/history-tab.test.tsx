import { vi, describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HistoryTab } from "./history-tab"

const history = [
  {
    id: "hist-1",
    wordId: "word-2",
    createdAt: "2026-03-20T14:00:00.000Z",
    word: {
      id: "word-2",
      spanish: "sol",
      nasaYuwe: "ate",
      pronunciation: null,
      category: null,
      audioUrl: null,
    },
  },
]

const searches = [{ id: "s-1", query: "nasa", createdAt: "2026-03-20T13:00:00.000Z" }]

function renderTab(overrides = {}) {
  const props = {
    history,
    searches,
    loading: false,
    clearingHistory: false,
    clearingSearches: false,
    onClearHistory: vi.fn(),
    onClearSearches: vi.fn(),
    ...overrides,
  }
  render(<HistoryTab {...props} />)
  return props
}

describe("HistoryTab", () => {
  it("shows viewed words and the clear-all button", () => {
    renderTab()
    expect(screen.getByText("ate")).toBeDefined()
    expect(screen.getByRole("button", { name: /limpiar todo/i })).toBeDefined()
  })

  it("shows the recent searches subsection with its own clear button", () => {
    renderTab()
    expect(screen.getByText("Búsquedas recientes")).toBeDefined()
    expect(screen.getByText("nasa")).toBeDefined()
    expect(screen.getByRole("button", { name: /^limpiar$/i })).toBeDefined()
  })

  it("clears history and searches independently", async () => {
    const user = userEvent.setup()
    const props = renderTab()
    await user.click(screen.getByRole("button", { name: /limpiar todo/i }))
    expect(props.onClearHistory).toHaveBeenCalledOnce()
    await user.click(screen.getByRole("button", { name: /^limpiar$/i }))
    expect(props.onClearSearches).toHaveBeenCalledOnce()
  })

  it("shows empty states without clear buttons", () => {
    renderTab({ history: [], searches: [] })
    expect(screen.getByText("No tienes historial de consultas")).toBeDefined()
    expect(screen.getByText(/todavía no buscaste nada/i)).toBeDefined()
    expect(screen.queryByRole("button", { name: /limpiar/i })).toBeNull()
  })
})
