import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}))

vi.mock("@/lib/admin-utils", () => ({
  formatDate: (iso: string) => iso,
  formatNumber: (n: number) => String(n),
  getActionLabel: (a: string) => a,
  getActionColor: () => "text-primary",
  getEntityLabel: (e: string) => e,
  getResponsible: () => "admin",
}))

import { AuditLogDetailDialog } from "./audit-log-detail-dialog"

const log = {
  id: "log1",
  action: "UPDATE",
  entity: "DictionaryWord",
  entityId: "w1",
  changes: JSON.stringify({ category: { before: "sustantivo", after: "verbo" }, responsable: "admin" }),
  userId: "admin1",
  createdAt: "2024-01-02T12:00:00Z",
}

describe("AuditLogDetailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renderiza el diff antes/después", () => {
    render(
      <AuditLogDetailDialog
        open={true}
        onOpenChange={() => {}}
        log={log as never}
        isAdmin={true}
        revertedIds={new Set()}
        onReverted={() => {}}
      />
    )
    expect(screen.getByText("category")).toBeDefined()
    expect(screen.getByText("sustantivo")).toBeDefined()
    expect(screen.getByText("verbo")).toBeDefined()
    expect(screen.getByText("Revertir cambio")).toBeDefined()
  })

  it("oculta el botón de revertir para no-admin", () => {
    render(
      <AuditLogDetailDialog
        open={true}
        onOpenChange={() => {}}
        log={log as never}
        isAdmin={false}
        revertedIds={new Set()}
        onReverted={() => {}}
      />
    )
    expect(screen.queryByText("Revertir cambio")).toBeNull()
    expect(screen.getByText(/Solo los administradores/)).toBeDefined()
  })

  it("muestra 'Ya revertido' si el id está en revertedIds", () => {
    render(
      <AuditLogDetailDialog
        open={true}
        onOpenChange={() => {}}
        log={log as never}
        isAdmin={true}
        revertedIds={new Set(["log1"])}
        onReverted={() => {}}
      />
    )
    expect(screen.getByText("Ya revertido")).toBeDefined()
    expect(screen.queryByText("Revertir cambio")).toBeNull()
  })

  it("no muestra botón para un log no reversible", () => {
    const del = { ...log, action: "DELETE", entity: "User", changes: JSON.stringify({ email: "x@y.com" }) }
    render(
      <AuditLogDetailDialog
        open={true}
        onOpenChange={() => {}}
        log={del as never}
        isAdmin={true}
        revertedIds={new Set()}
        onReverted={() => {}}
      />
    )
    expect(screen.queryByText("Revertir cambio")).toBeNull()
  })

  it("abre ConfirmDialog al pulsar Revertir y llama al endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true, message: "ok" }))
    const onReverted = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <AuditLogDetailDialog
        open={true}
        onOpenChange={onOpenChange}
        log={log as never}
        isAdmin={true}
        revertedIds={new Set()}
        onReverted={onReverted}
      />
    )
    fireEvent.click(screen.getByText("Revertir cambio"))
    expect(screen.getByText("¿Revertir este cambio?")).toBeDefined()
    fireEvent.click(screen.getByText("Revertir"))
    await new Promise((r) => setTimeout(r, 50))
    expect(fetch).toHaveBeenCalledWith("/api/admin/audit-logs/log1/revert", { method: "POST" })
    expect(onReverted).toHaveBeenCalled()
  })
})

