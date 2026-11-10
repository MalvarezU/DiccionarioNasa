import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}))

vi.mock("@/lib/admin-utils", () => ({
  formatDate: (iso: string) => iso,
}))

vi.mock("./CreateWordModal", () => ({
  CreateWordModal: () => null,
}))

import { toast } from "@/hooks/use-toast"
import { SuggestionsManager } from "./suggestions-manager"

const pendiente = {
  id: "log1",
  action: "SUGGEST",
  entity: "DictionaryWord",
  entityId: "suggestion",
  changes: JSON.stringify({
    term: "casa",
    comment: "vivienda",
    source: "community",
    status: "PENDING",
  }),
  userId: null,
  createdAt: "2026-01-02T12:00:00Z",
}

const atendida = {
  id: "log2",
  action: "SUGGEST",
  entity: "DictionaryWord",
  entityId: "suggestion",
  changes: JSON.stringify({
    term: "sol",
    comment: null,
    source: "community",
    status: "DONE",
    decidedAt: "2026-01-03T12:00:00Z",
    decidedBy: "admin",
  }),
  userId: null,
  createdAt: "2026-01-01T12:00:00Z",
}

function fetchLogs(logs: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/api/admin/audit-logs")) {
      return { ok: true, json: async () => ({ logs, total: logs.length }) }
    }
    throw new Error(`fetch inesperado: ${url}`)
  })
}

describe("SuggestionsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renderiza tabs con contadores y solo las pendientes por defecto", async () => {
    global.fetch = fetchLogs([pendiente, atendida]) as never

    render(<SuggestionsManager />)

    // Carga terminada: la card pendiente es visible…
    expect(await screen.findByText("casa")).toBeDefined()
    // …y la atendida no aparece en la tab por defecto.
    expect(screen.queryByText("sol")).toBeNull()
    // Contadores por tab.
    expect(screen.getByRole("tab", { name: /Pendientes/ }).textContent).toContain("1")
    expect(screen.getByRole("tab", { name: /Atendidas/ }).textContent).toContain("1")
    expect(screen.getByRole("tab", { name: /Archivadas/ }).textContent).toContain("0")
  })

  it("decisión exitosa hace PATCH y recarga la lista, sin toast", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/admin/audit-logs")) {
        return { ok: true, json: async () => ({ logs: [pendiente] }) }
      }
      if (url.includes("/api/admin/suggestions/")) {
        return { ok: true, json: async () => ({ success: true }) }
      }
      throw new Error(`fetch inesperado: ${url}`)
    })
    global.fetch = fetchMock as never

    render(<SuggestionsManager />)
    expect(await screen.findByText("casa")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Atendida" }))

    // load inicial + PATCH + recarga post-decisión
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const patchCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/api/admin/suggestions/")
    )
    expect(patchCall?.[1]?.method).toBe("PATCH")
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ action: "DONE" })
    expect(toast).not.toHaveBeenCalled()
  })

  it("PATCH fallido muestra toast destructivo y deja la card como estaba", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/admin/audit-logs")) {
        return { ok: true, json: async () => ({ logs: [pendiente] }) }
      }
      if (url.includes("/api/admin/suggestions/")) {
        return { ok: false, status: 500, json: async () => ({ message: "boom" }) }
      }
      throw new Error(`fetch inesperado: ${url}`)
    })
    global.fetch = fetchMock as never

    render(<SuggestionsManager />)
    expect(await screen.findByText("casa")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Atendida" }))

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      )
    )
    // Sin recarga: la lista no muta y el admin reintenta.
    expect(screen.getByText("casa")).toBeDefined()
  })
})
