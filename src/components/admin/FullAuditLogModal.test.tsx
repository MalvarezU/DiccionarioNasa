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

  it("muestra un skeleton de filas mientras carga", () => {
    vi.mocked(global.fetch).mockImplementationOnce(() => new Promise(() => {}))
    renderModal()
    // Filas fantasma con la forma de la tabla real: el modal no colapsa
    // cuando llegan los datos.
    expect(document.querySelector('[data-slot="skeleton-word-table"]')).toBeTruthy()
    expect(document.querySelectorAll('[data-slot="skeleton-table-row"]').length)
      .toBeGreaterThan(0)
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