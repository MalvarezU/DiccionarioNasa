import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

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
  formatDate: (iso: string) => iso,
  formatNumber: (n: number) => String(n),
  getActionLabel: (a: string) => a,
  getActionColor: () => "text-primary",
  getEntityLabel: (e: string) => e,
  getResponsible: () => "admin",
}))

import { FullAuditLogModal } from "./FullAuditLogModal"

const mockLogs = [
  {
    id: "log1",
    action: "CREATE",
    entity: "DictionaryWord",
    entityId: "w1",
    changes: '{"spanish":"Casa"}',
    userId: "admin1",
    createdAt: "2024-01-01T10:00:00Z",
  },
  {
    id: "log2",
    action: "UPDATE",
    entity: "DictionaryWord",
    entityId: "w1",
    changes: '{"category":"verbo"}',
    userId: "admin1",
    createdAt: "2024-01-02T12:00:00Z",
  },
]

function renderModal() {
  const onOpenChange = vi.fn()
  render(<FullAuditLogModal open={true} onOpenChange={onOpenChange} />)
  return { onOpenChange }
}

describe("FullAuditLogModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renders dialog title", () => {
    renderModal()
    expect(screen.getByText(/audit/i)).toBeDefined()
  })

  it("shows loading state initially", () => {
    vi.mocked(global.fetch).mockImplementationOnce(() => new Promise(() => {}))
    renderModal()
    expect(document.querySelector(".animate-spin")).toBeTruthy()
  })

  it("renders logs after loading", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ logs: mockLogs, totalPages: 1 }) as never
    )
    renderModal()
    expect(await screen.findByText("CREATE")).toBeDefined()
    expect(screen.getByText("UPDATE")).toBeDefined()
  })

  it("shows empty state when no logs", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ logs: [], totalPages: 1 }) as never
    )
    renderModal()
    expect(await screen.findByText("Sin entradas en el log")).toBeDefined()
  })
})