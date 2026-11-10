import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WordCard } from "./word-card"

const baseWord = {
  id: "w1",
  spanish: "Agua",
  nasaYuwe: "Yu'",
  pronunciation: "yu'",
  category: "sustantivo",
  audioUrl: "/audio/yu.mp3",
}

function mockMedia() {
  window.HTMLMediaElement.prototype.play = vi
    .fn()
    .mockResolvedValue(undefined) as unknown as typeof window.HTMLMediaElement.prototype.play
  window.HTMLMediaElement.prototype.pause = vi.fn()
}

describe("WordCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMedia()
  })

  it("renders nasaYuwe, spanish, pronunciation and category", () => {
    render(<WordCard word={baseWord} variant="grid" onOpen={() => {}} />)

    expect(screen.getByText("Yu'")).toBeDefined()
    expect(screen.getByText("Agua")).toBeDefined()
    expect(screen.getByText("[yu']")).toBeDefined()
    expect(screen.getByText("sustantivo")).toBeDefined()
  })

  it("toggles play/pause on button click", async () => {
    const user = userEvent.setup()
    render(<WordCard word={baseWord} variant="grid" onOpen={() => {}} />)

    const playButton = screen.getByRole("button", {
      name: "Escuchar pronunciación de Yu'",
    })
    expect(playButton.getAttribute("aria-pressed")).toBe("false")

    await user.click(playButton)
    expect(
      screen.getByRole("button", { name: "Pausar" })
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: "Pausar" }).getAttribute("aria-pressed")
    ).toBe("true")

    await user.click(screen.getByRole("button", { name: "Pausar" }))
    expect(
      screen.getByRole("button", {
        name: "Escuchar pronunciación de Yu'",
      })
    ).toBeDefined()
  })

  it("clicking play does not open the word detail (stopPropagation)", async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<WordCard word={baseWord} variant="grid" onOpen={onOpen} />)

    await user.click(
      screen.getByRole("button", {
        name: "Escuchar pronunciación de Yu'",
      })
    )
    expect(onOpen).not.toHaveBeenCalled()
  })

  it("clicking the card opens the word detail", async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<WordCard word={baseWord} variant="grid" onOpen={onOpen} />)

    await user.click(
      screen.getByRole("button", { name: "Ver ficha de Yu'" })
    )
    expect(onOpen).toHaveBeenCalledWith("w1")
  })

  it("renders no play button without audioUrl", () => {
    render(
      <WordCard
        word={{ ...baseWord, audioUrl: null }}
        variant="grid"
        onOpen={() => {}}
      />
    )

    expect(
      screen.queryByRole("button", {
        name: /escuchar pronunciación/i,
      })
    ).toBeNull()
    // The card itself is still clickable
    expect(
      screen.getByRole("button", { name: "Ver ficha de Yu'" })
    ).toBeDefined()
  })

  it("notifies the parent about play state for single-audio control", async () => {
    const onPlayState = vi.fn()
    const user = userEvent.setup()
    render(
      <WordCard
        word={baseWord}
        variant="grid"
        onOpen={() => {}}
        onPlayState={onPlayState}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: "Escuchar pronunciación de Yu'",
      })
    )
    expect(onPlayState).toHaveBeenCalledWith("w1")

    await user.click(screen.getByRole("button", { name: "Pausar" }))
    expect(onPlayState).toHaveBeenCalledWith(null)
  })

  it("row variant renders compact single-line content with mini play", () => {
    render(<WordCard word={baseWord} variant="row" onOpen={() => {}} />)

    expect(screen.getByText("Yu'")).toBeDefined()
    expect(screen.getByText("Agua")).toBeDefined()
    expect(screen.getByText("sustantivo")).toBeDefined()
    const playButton = screen.getByRole("button", {
      name: "Escuchar pronunciación de Yu'",
    })
    expect(playButton.className).toContain("min-h-8")
    expect(
      screen.getByRole("button", { name: "Ver ficha de Yu'" }).className
    ).toContain("flex")
  })

  it("row variant without audioUrl renders no play button", () => {
    render(
      <WordCard
        word={{ ...baseWord, audioUrl: undefined }}
        variant="row"
        onOpen={() => {}}
      />
    )

    expect(
      screen.queryByRole("button", {
        name: /escuchar pronunciación/i,
      })
    ).toBeNull()
    expect(screen.getByText("Yu'")).toBeDefined()
  })
})
