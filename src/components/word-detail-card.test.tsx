import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

vi.mock("@/components/audio-player", () => ({
  AudioPlayer: ({ src, wordLabel, isCached }: any) =>
    src ? <div data-testid="audio-player" /> : <div data-testid="audio-player" />,
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="auth-modal" /> : null,
}))

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}))

vi.mock("@/hooks/use-offline-audio", () => ({
  useOfflineAudio: vi.fn(),
}))

vi.mock("@/lib/local-db", () => ({
  getLocalWord: vi.fn(),
  isLocalDBReady: vi.fn(),
}))

import { useSession } from "next-auth/react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { useIsMobile } from "@/hooks/use-mobile"
import { useOfflineAudio } from "@/hooks/use-offline-audio"
import { getLocalWord, isLocalDBReady } from "@/lib/local-db"
import { WordDetailCard } from "./word-detail-card"

const mockWord = {
  id: "word-1",
  spanish: "agua",
  nasaYuwe: "yu'",
  pronunciation: "yuʔ",
  audioUrl: "/audio/yu.mp3",
  culturalContext: "El agua es esencial en la cultura Nasa",
  category: "sustantivo",
  examples: [
    { spanish: "El agua es vida", nasaYuwe: "Yu' çxhab wesx" },
  ],
}

function mockOfflineAudio(overrides?: Record<string, unknown>) {
  vi.mocked(useOfflineAudio).mockReturnValue({
    audioSrc: "/audio/yu.mp3",
    isCached: false,
    isDownloading: false,
    downloadProgress: 0,
    downloadForOffline: vi.fn().mockResolvedValue(undefined),
    removeFromCache: vi.fn().mockResolvedValue(undefined),
    storageInfo: null,
    ...overrides,
  })
}

function renderCard(options?: { wordId?: string | null; open?: boolean }) {
  const onOpenChange = vi.fn()
  const result = render(
    <WordDetailCard
      wordId={options?.wordId ?? "word-1"}
      open={options?.open ?? true}
      onOpenChange={onOpenChange}
    />
  )
  return { onOpenChange }
}

describe("WordDetailCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      status: "authenticated",
      update: vi.fn(),
    })
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(useIsMobile).mockReturnValue(false)
    mockOfflineAudio()
    vi.mocked(getLocalWord).mockResolvedValue(null)
    vi.mocked(isLocalDBReady).mockResolvedValue(false)
  })

  it("shows loading spinner initially", () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    renderCard()
    expect(document.querySelector(".animate-spin")).toBeTruthy()
  })

  it("shows word after loading from API", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(await screen.findByText("yu'")).toBeDefined()
    expect(screen.findByText("agua")).toBeDefined()
    expect(screen.getByText("[yuʔ]")).toBeDefined()
    expect(screen.getByText("El agua es esencial en la cultura Nasa")).toBeDefined()
  })

  it("shows 'no encontrada' when API returns error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
    renderCard()
    expect(await screen.findByText("No se encontró la palabra")).toBeDefined()
  })

  it("loads from local DB when offline", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(isLocalDBReady).mockResolvedValue(true)
    const localWord = { ...mockWord, examples: JSON.stringify(mockWord.examples) }
    vi.mocked(getLocalWord).mockResolvedValue(localWord as any)
    renderCard()
    expect(await screen.findByText("yu'")).toBeDefined()
    const wordFetches = vi.mocked(fetch).mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("/api/dictionary/words/")
    )
    expect(wordFetches.length).toBe(0)
  })

  it("shows loading when offline and no local DB", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(isLocalDBReady).mockResolvedValue(false)
    renderCard()
    expect(await screen.findByText("No se encontró la palabra")).toBeDefined()
  })

  it("renders nothing when closed", () => {
    renderCard({ open: false })
    expect(screen.queryByText("yu'")).toBeNull()
    expect(screen.queryByText("agua")).toBeNull()
  })

  it("renders nothing when wordId is null", () => {
    renderCard({ wordId: null })
    expect(screen.queryByText("agua")).toBeNull()
  })

  it("shows dialog on desktop", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(await screen.findByText("yu'")).toBeDefined()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
  })

  it("shows sheet on mobile", async () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(await screen.findByText("yu'")).toBeDefined()
    const sheets = document.querySelectorAll('[role="dialog"]')
    expect(sheets.length).toBeGreaterThan(0)
  })

  it("shows category badges", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(await screen.findByText("Sustantivo")).toBeDefined()
  })

  it("shows no pronunciation section when missing", async () => {
    const wordWithoutPron = { ...mockWord, pronunciation: null }
    vi.mocked(fetch).mockResolvedValue(Response.json(wordWithoutPron))
    renderCard()
    expect(await screen.findByText("Pronunciación no disponible")).toBeDefined()
  })

  it("shows audio player", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(await screen.findByTestId("audio-player")).toBeDefined()
  })

  it("shows favorite button", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockWord))
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ isFavorite: false })
    )
    renderCard()
    expect(await screen.findByText("Guardar en favoritos")).toBeDefined()
  })

  it("toggles favorite when button clicked", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ isFavorite: false })
    )
    renderCard()
    const btn = await screen.findByText("Guardar en favoritos")
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ isFavorite: true })
    )
    await userEvent.setup().click(btn)
    expect(fetch).toHaveBeenCalledWith(
      "/api/dictionary/favorites",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("shows login hint when not authenticated", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    })
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(
      await screen.findByText("Inicia sesión para guardar favoritos")
    ).toBeDefined()
  })

  it("renders correctly with multiple categories", async () => {
    const wordWithMultiCat = {
      ...mockWord,
      category: "sustantivo, verbo",
    }
    vi.mocked(fetch).mockResolvedValue(Response.json(wordWithMultiCat))
    renderCard()
    expect(await screen.findByText("Sustantivo")).toBeDefined()
    expect(screen.getByText("Verbo")).toBeDefined()
  })

  it("shows cached status in audio section", async () => {
    mockOfflineAudio({ isCached: true })
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(
      await screen.findByText("Audio disponible sin conexión")
    ).toBeDefined()
  })

  it("shows download progress in audio section", async () => {
    mockOfflineAudio({ isDownloading: true, downloadProgress: 60 })
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(
      await screen.findByText("Descargando audio para uso sin conexión...")
    ).toBeDefined()
  })

  it("shows storage warning when >50% used", async () => {
    mockOfflineAudio({
      storageInfo: { usedMB: 25, quotaMB: 50, percentUsed: 50.1 },
    })
    vi.mocked(fetch).mockResolvedValue(Response.json(mockWord))
    renderCard()
    expect(await screen.findByText(/Almacenamiento/)).toBeDefined()
  })

  it("shows offline audio message", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(isLocalDBReady).mockResolvedValue(true)
    const localWord = { ...mockWord, examples: JSON.stringify(mockWord.examples) }
    vi.mocked(getLocalWord).mockResolvedValue(localWord as any)
    renderCard()
    expect(await screen.findByText("yu'")).toBeDefined()
    expect(
      screen.getByText(/Audio disponible solo en línea/)
    ).toBeDefined()
  })
})
