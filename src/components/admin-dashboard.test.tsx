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

  it("muestra un skeleton con la silueta del panel mientras carga", () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    render(<AdminDashboard />)
    // El skeleton reemplaza al spinner: se afirma la estructura que se va a
    // ver, no un texto transitorio. Un spinner central colapsaria el layout
    // al llegar el dato.
    expect(screen.getByTestId("skeleton-admin-dashboard")).toBeDefined()
    expect(screen.getByTestId("skeleton-stats-grid")).toBeDefined()
    expect(screen.queryByText("Cargando estadísticas...")).toBeNull()
  })

  it("renders dashboard stats after loading", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText("Palabras")).toBeDefined()
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

  it("shows section links with routes", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText("Palabras")).toBeDefined()
    const links: Array<[string, string]> = [
      ["Palabras", "/admin/palabras"],
      ["Gestión de cursos", "/admin/cursos"],
      ["Ilustraciones", "/admin/ilustraciones"],
      ["Audios", "/admin/audios"],
      ["Usuarios", "/admin/usuarios"],
    ]
    for (const [texto, href] of links) {
      const el = screen.getByText(texto)
      expect(el.closest("a")?.getAttribute("href")).toBe(href)
    }
  })

  it("hides Usuarios link for editors", async () => {
    mockFetchStats()
    render(<AdminDashboard isAdmin={false} />)
    expect(await screen.findByText("Palabras")).toBeDefined()
    expect(screen.queryByText("Usuarios")).toBeNull()
  })

  it("shows pending items with links to resolving sections", async () => {
    mockFetchStats()
    render(<AdminDashboard />)
    expect(await screen.findByText("Pendientes")).toBeDefined()
    const borradores = screen.getByText("20 borradores por publicar")
    expect(borradores.closest("a")?.getAttribute("href")).toBe("/admin/palabras")
    const sinAudio = screen.getByText("10 publicadas sin audio")
    expect(sinAudio.closest("a")?.getAttribute("href")).toBe("/admin/audios")
  })

  it("shows todo-al-dia when nothing is pending", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ...mockStats, draftCount: 0, publishedWithoutAudio: 0 })
    )
    render(<AdminDashboard />)
    expect(await screen.findByText("Sin pendientes. Todo al día.")).toBeDefined()
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
  // FullAuditLogModal (se abre desde "Ver todo" de Actividad reciente)
  // ═══════════════════════════════════════

  it("opens FullAuditLogModal and fetches logs", async () => {
    mockFetchStats()
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(await screen.findByText("Ver todo")).toBeDefined()
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ logs: mockStats.recentAuditLogs, totalPages: 1, total: 1 })
    )
    await user.click(screen.getByText("Ver todo"))
    expect(await screen.findByText("Log de auditoría completo")).toBeDefined()
  })
})
