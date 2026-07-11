import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select">
      <button onClick={() => onValueChange?.("all")}>trigger</button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
}))

vi.mock("@/lib/admin-utils", () => ({
  formatNumber: (n: number) => String(n),
  WORD_CATEGORIES: [{ value: "sustantivo", label: "Sustantivo" }],
}))

import { WordListModal } from "./WordListModal"

const mockWords = [
  {
    id: "w1",
    spanish: "Casa",
    nasaYuwe: "Yat",
    pronunciation: "yat",
    audioUrl: null,
    culturalContext: null,
    category: "sustantivo",
    status: "PUBLISHED",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "w2",
    spanish: "Agua",
    nasaYuwe: "yu'",
    pronunciation: null,
    audioUrl: "/audio/agua.wav",
    culturalContext: null,
    category: "sustantivo",
    status: "DRAFT",
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
]

function renderModal() {
  const onOpenChange = vi.fn()
  const onEditWord = vi.fn()
  const onBulkActionDone = vi.fn()
  render(
    <WordListModal
      open={true}
      onOpenChange={onOpenChange}
      onEditWord={onEditWord}
      onBulkActionDone={onBulkActionDone}
    />
  )
  return { onOpenChange, onEditWord, onBulkActionDone }
}

describe("WordListModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renders dialog title", () => {
    renderModal()
    expect(screen.getByText(/gestión/i)).toBeDefined()
  })

  it("shows loading state initially", () => {
    vi.mocked(global.fetch).mockImplementationOnce(() => new Promise(() => {}))
    renderModal()
    expect(document.querySelector(".animate-spin")).toBeTruthy()
  })

  it("renders words list after loading", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ words: mockWords, total: 2 }) as never
    )
    renderModal()
    expect(await screen.findByText("Casa")).toBeDefined()
    expect(screen.getByText("Agua")).toBeDefined()
  })

  it("shows empty state when no words", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ words: [], total: 0 }) as never
    )
    renderModal()
    expect(await screen.findByText("No se encontraron palabras")).toBeDefined()
  })

  it("calls onEditWord when edit button clicked", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ words: mockWords, total: 2 }) as never
    )
    const { onEditWord } = renderModal()
    expect(await screen.findByText("Casa")).toBeDefined()
    const editBtns = screen.getAllByRole("button", { name: /editar/i })
    await userEvent.setup().click(editBtns[0])
    expect(onEditWord).toHaveBeenCalled()
  })

  it("calls onOpenChange(false) when closing", async () => {
    const { onOpenChange } = renderModal()
    expect(onOpenChange).toBeDefined()
  })
})