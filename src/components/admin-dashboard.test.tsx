import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

import { AdminDashboard } from "./admin-dashboard"

const mockStats = {
  totalWords: 100,
  draftCount: 20,
  publishedCount: 70,
  archivedCount: 10,
  wordsWithAudio: 60,
  publishedWithoutAudio: 10,
  totalUsers: 5,
  totalFavorites: 42,
  recentWords: 7,
  recentAuditLogs: [
    {
      id: "log-1",
      action: "CREATE",
      entity: "DictionaryWord",
      entityId: "word-1",
      changes: null,
      userId: "user-1",
      createdAt: new Date().toISOString(),
    },
  ],
}

function mockFetchStats() {
  vi.mocked(fetch).mockResolvedValue(Response.json(mockStats))
}

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  // ═══════════════════════════════════════
  // Main dashboard
  // ═══════════════════════════════════════

  it("shows loading state initially", () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    render(<AdminDashboard />)
    expect(screen.getByText("Cargando estadísticas...")).toBeDefined()
  })

  it("renders dashboard stats after loading", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText("Panel de Administración")).toBeDefined()
    const totals = screen.getAllByText("100")
    expect(totals.length).toBeGreaterThanOrEqual(1)
  })

  it("shows error state on fetch failure", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))
    render(<AdminDashboard />)
    expect(await screen.findByText("Error al cargar las estadísticas")).toBeDefined()
    expect(screen.getByText("Reintentar")).toBeDefined()
  })

  it("shows verify consistency badge", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText(/Coincide con el total/)).toBeDefined()
  })

  it("shows quick action buttons", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText("Nueva ficha")).toBeDefined()
    expect(screen.getByText("Gestionar fichas")).toBeDefined()
    expect(screen.getByText("Importar corpus")).toBeDefined()
    expect(screen.getByText("Ver log completo")).toBeDefined()
  })

  it("shows audio card", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText("Cobertura de audio — Publicadas")).toBeDefined()
  })

  it("shows recent activity section", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText("Actividad reciente")).toBeDefined()
    expect(screen.getByText("Creación")).toBeDefined()
  })

  it("shows refresh button", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText("Actualizar")).toBeDefined()
  })

  // ═══════════════════════════════════════
  // CreateWordModal
  // ═══════════════════════════════════════

  it("opens CreateWordModal and renders form fields", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Nueva ficha")).toBeDefined()
    await user.click(screen.getByText("Nueva ficha"))
    expect(screen.getByText("Crea una nueva entrada en el diccionario bilingüe")).toBeDefined()
    expect(screen.getByPlaceholderText("palabra en español")).toBeDefined()
    expect(screen.getByPlaceholderText("palabra en nasa yuwe")).toBeDefined()
  })

  it("CreateWordModal validates required fields", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Nueva ficha")).toBeDefined()
    await user.click(screen.getByText("Nueva ficha"))
    await user.click(screen.getByText("Guardar como borrador"))
    expect(screen.getByText(/El campo.*Español.*es obligatorio/)).toBeDefined()
    expect(screen.getByText(/El campo.*Nasa Yuwe.*es obligatorio/)).toBeDefined()
  })

  it("CreateWordModal submits and shows success", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Nueva ficha")).toBeDefined()
    await user.click(screen.getByText("Nueva ficha"))
    await user.type(screen.getByPlaceholderText("palabra en español"), "agua")
    await user.type(screen.getByPlaceholderText("palabra en nasa yuwe"), "yu'")
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "ok" }))
    await user.click(screen.getByText("Guardar como borrador"))
    expect(await screen.findByText("Ficha guardada como borrador")).toBeDefined()
  })

  it("CreateWordModal submits and publishes", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Nueva ficha")).toBeDefined()
    await user.click(screen.getByText("Nueva ficha"))
    await user.type(screen.getByPlaceholderText("palabra en español"), "sol")
    await user.type(screen.getByPlaceholderText("palabra en nasa yuwe"), "ate")
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "ok" }))
    await user.click(screen.getByText("Guardar y publicar"))
    expect(await screen.findByText("Ficha guardada y publicada")).toBeDefined()
  })

  // ═══════════════════════════════════════
  // ImportCorpusModal
  // ═══════════════════════════════════════

  it("opens ImportCorpusModal and shows format info", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Importar corpus")).toBeDefined()
    await user.click(screen.getByText("Importar corpus"))
    expect(await screen.findByText("Importa palabras al diccionario desde un archivo CSV")).toBeDefined()
    expect(screen.getByText(/Formato CSV requerido/)).toBeDefined()
  })

  it("ImportCorpusModal shows empty error", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Importar corpus")).toBeDefined()
    await user.click(screen.getByText("Importar corpus"))
    const importBtn = screen.getByRole("button", { name: "Importar" })
    expect((importBtn as HTMLButtonElement).disabled).toBe(true)
  })

  // ═══════════════════════════════════════
  // FullAuditLogModal
  // ═══════════════════════════════════════

  it("opens FullAuditLogModal and fetches logs", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Ver log completo")).toBeDefined()
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ logs: mockStats.recentAuditLogs, totalPages: 1, total: 1 })
    )
    await user.click(screen.getByText("Ver log completo"))
    expect(await screen.findByText("Log de auditoría completo")).toBeDefined()
  })

  // ═══════════════════════════════════════
  // WordListModal + EditWordModal flow
  // ═══════════════════════════════════════

  it("opens WordListModal and renders table", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Gestionar fichas")).toBeDefined()
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        words: [
          { id: "w1", spanish: "agua", nasaYuwe: "yu'", pronunciation: "", audioUrl: null, culturalContext: "", category: "sustantivo", status: "PUBLISHED" },
        ],
        totalPages: 1,
        total: 1,
      })
    )
    await user.click(screen.getByText("Gestionar fichas"))
    expect(await screen.findByText("Gestión de fichas")).toBeDefined()
    expect(screen.getByText("agua")).toBeDefined()
  })

  it("WordListModal to EditWordModal flow", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Gestionar fichas")).toBeDefined()
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        words: [
          { id: "w1", spanish: "agua", nasaYuwe: "yu'", pronunciation: "", audioUrl: null, culturalContext: "", category: "sustantivo", status: "PUBLISHED" },
        ],
        totalPages: 1,
        total: 1,
      })
    )
    await user.click(screen.getByText("Gestionar fichas"))
    expect(await screen.findByText("agua")).toBeDefined()
    await user.click(screen.getByText("Editar"))
    expect(await screen.findByText("Editar ficha")).toBeDefined()
    expect(screen.getByDisplayValue("agua")).toBeDefined()
    expect(screen.getByDisplayValue("yu'")).toBeDefined()
  })
})
