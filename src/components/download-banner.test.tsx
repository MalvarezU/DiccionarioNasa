import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}))

vi.mock("@/hooks/use-local-db", () => ({
  useLocalDB: vi.fn(),
}))

import { useOnlineStatus } from "@/hooks/use-online-status"
import { useLocalDB } from "@/hooks/use-local-db"
import type { MediaUsage } from "@/lib/media-sync"
import { DownloadBanner } from "./download-banner"

const defaultDBState = {
  isReady: false,
  isDownloading: false,
  downloadProgress: 0,
  localWordCount: 0,
  error: null as string | null,
  lastSync: null as string | null,
  startDownload: vi.fn(),
  forceResync: vi.fn(),
  refreshStats: vi.fn(),
  checkAndResume: vi.fn(),
  mediaUsage: null as MediaUsage | null,
  refreshMediaUsage: vi.fn(),
  clearMedia: vi.fn(),
}

function mockOnline(online: boolean) {
  vi.mocked(useOnlineStatus).mockReturnValue(online)
}

function mockDB(overrides: Partial<typeof defaultDBState>) {
  vi.mocked(useLocalDB).mockReturnValue({ ...defaultDBState, ...overrides })
}

describe("DownloadBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockOnline(true)
    mockDB({})
  })

  it("renders idle state with download button when online", () => {
    render(<DownloadBanner />)
    expect(screen.getByText("Descargar diccionario para uso sin conexión")).toBeDefined()
    expect(screen.getByRole("button", { name: /descargar/i })).toBeDefined()
  })

  it("does not render when offline and not ready", () => {
    mockOnline(false)
    const { container } = render(<DownloadBanner />)
    expect(container.innerHTML).toBe("")
  })

  it("shows progress during download with media budget cap", () => {
    mockDB({ isDownloading: true, downloadProgress: 42 })
    render(<DownloadBanner />)
    expect(screen.getByText(/descargando diccionario\.\.\. 42%/i)).toBeDefined()
    expect(screen.getByText(/tope 50 MB en medios/i)).toBeDefined()
  })

  it("shows completion state", () => {
    mockDB({ isReady: true })
    render(<DownloadBanner />)
    expect(screen.getByText(/diccionario listo para usar sin conexión/i)).toBeDefined()
  })

  it("shows media summary in completion state when measured", () => {
    mockDB({
      isReady: true,
      mediaUsage: { bytes: 8 * 1024 * 1024, quota: 100 * 1024 * 1024, audios: 343, illustrations: 12 },
    })
    render(<DownloadBanner />)
    expect(screen.getByText(/343 audios, 12 ilustraciones/i)).toBeDefined()
  })

  it("shows error state", () => {
    mockDB({ error: "Error de conexión" })
    render(<DownloadBanner />)
    expect(screen.getByText(/error al descargar/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeDefined()
  })

  it("hides when dismissed", async () => {
    const user = userEvent.setup()
    render(<DownloadBanner />)
    const closeBtn = screen.getByLabelText("Cerrar aviso")
    await user.click(closeBtn)

    expect(screen.queryByText("Descargar diccionario para uso sin conexión")).toBeNull()
  })

  it("triggers download on button click", async () => {
    const startDownload = vi.fn()
    mockDB({ startDownload })
    const user = userEvent.setup()
    render(<DownloadBanner />)

    await user.click(screen.getByRole("button", { name: /descargar/i }))
    expect(startDownload).toHaveBeenCalled()
  })

  it("triggers retry on error button click", async () => {
    const startDownload = vi.fn()
    mockDB({ error: "error", startDownload })
    const user = userEvent.setup()
    render(<DownloadBanner />)

    await user.click(screen.getByRole("button", { name: /reintentar/i }))
    expect(startDownload).toHaveBeenCalled()
  })

  it("does not show dismiss button during download", () => {
    mockDB({ isDownloading: true })
    render(<DownloadBanner />)
    expect(screen.queryByLabelText("Cerrar aviso")).toBeNull()
  })
})
