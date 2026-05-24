import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}))

import { useOnlineStatus } from "@/hooks/use-online-status"
import { AudioPlayer } from "./audio-player"

describe("AudioPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
  })

  it("shows 'no disponible' when src is null", () => {
    render(<AudioPlayer src={null} wordLabel="atek" />)
    expect(screen.getByText("Audio no disponible")).toBeDefined()
  })

  it("renders play button when audio is available", () => {
    render(<AudioPlayer src="https://example.com/audio.mp3" wordLabel="atek" />)
    expect(screen.getByLabelText("Reproducir audio")).toBeDefined()
    expect(screen.getByText(/pronunciación en nasa yuwe/i)).toBeDefined()
    expect(screen.getByText("atek")).toBeDefined()
  })

  it("shows offline badge when cached", () => {
    render(
      <AudioPlayer
        src="https://example.com/audio.mp3"
        wordLabel="atek"
        isCached={true}
      />
    )
    expect(screen.getByText("Offline")).toBeDefined()
  })

  it("shows offline message when offline and not cached", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(
      <AudioPlayer src="https://example.com/audio.mp3" wordLabel="atek" />
    )
    expect(screen.getByText(/audio disponible solo en línea/i)).toBeDefined()
  })

  it("play button is disabled when offline and not cached", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<AudioPlayer src="https://example.com/audio.mp3" wordLabel="atek" />)
    expect(screen.getByLabelText("Reproducir audio")).toBeDisabled()
  })
})
