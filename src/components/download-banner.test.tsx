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
import { DownloadBanner } from "./download-banner"

const defaultDBState = {
  isReady: false,
  isDownloading: false,
  downloadProgress: 0,
  error: null,
  startDownload: vi.fn(),
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

  it("shows progress during download", () => {
    mockDB({ isDownloading: true, downloadProgress: 42 })
    render(<DownloadBanner />)
    expect(screen.getByText("Descargando diccionario... 42%")).toBeDefined()
  })

  it("shows completion state", () => {
    mockDB({ isReady: true })
    render(<DownloadBanner />)
    expect(screen.getByText("Diccionario listo para usar sin conexión")).toBeDefined()
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
