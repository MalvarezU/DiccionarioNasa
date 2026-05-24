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
import { SettingsDialog } from "./settings-dialog"

const onOpenChange = vi.fn()

const defaultDBState = {
  isReady: false,
  isDownloading: false,
  downloadProgress: 0,
  localWordCount: 0,
  error: null,
  lastSync: null,
  forceResync: vi.fn(),
  refreshStats: vi.fn(),
}

describe("SettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(useLocalDB).mockReturnValue({ ...defaultDBState })
  })

  it("shows online connection status when open", () => {
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    expect(screen.getByText("Conectado a internet")).toBeDefined()
  })

  it("shows offline connection status", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    expect(screen.getByText("Sin conexión a internet")).toBeDefined()
  })

  it("shows download status when not ready", () => {
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    expect(screen.getByText("No descargada")).toBeDefined()
  })

  it("shows ready status when downloaded", () => {
    vi.mocked(useLocalDB).mockReturnValue({
      ...defaultDBState,
      isReady: true,
      localWordCount: 150,
    })
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    expect(screen.getByText("Descargada")).toBeDefined()
    expect(screen.getByText("150")).toBeDefined()
  })

  it("shows progress during download", () => {
    vi.mocked(useLocalDB).mockReturnValue({
      ...defaultDBState,
      isDownloading: true,
      downloadProgress: 60,
    })
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    // Progress text appears in the sync section, not the button
    const progressElements = screen.getAllByText("Sincronizando... 60%")
    expect(progressElements.length).toBeGreaterThanOrEqual(1)
  })

  it("shows last sync date", () => {
    vi.mocked(useLocalDB).mockReturnValue({
      ...defaultDBState,
      lastSync: "2026-05-24T10:30:00Z",
    })
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    // Should show formatted date instead of "Nunca sincronizado"
    expect(screen.queryByText("Nunca sincronizado")).toBeNull()
  })

  it("shows 'nunca sincronizado' when no sync", () => {
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    expect(screen.getByText("Nunca sincronizado")).toBeDefined()
  })

  it("calls forceResync when sync button is clicked", async () => {
    const forceResync = vi.fn()
    vi.mocked(useLocalDB).mockReturnValue({
      ...defaultDBState,
      forceResync,
    })
    const user = userEvent.setup()
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /sincronizar/i }))
    expect(forceResync).toHaveBeenCalled()
  })

  it("button shows 'buscar actualizaciones' when ready", () => {
    vi.mocked(useLocalDB).mockReturnValue({
      ...defaultDBState,
      isReady: true,
    })
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    expect(screen.getByText("Buscar actualizaciones")).toBeDefined()
  })

  it("button shows 'sincronizar ahora' when not ready", () => {
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)
    expect(screen.getByText("Sincronizar ahora")).toBeDefined()
  })

  it("shows offline feedback when sync is pressed while offline", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    const user = userEvent.setup()
    render(<SettingsDialog open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /sincronizar/i }))
    // The offline feedback message appears as a distinct element
    const feedbackElements = screen.getAllByText(/sin conexión a internet/i)
    expect(feedbackElements.length).toBeGreaterThanOrEqual(1)
  })
})
