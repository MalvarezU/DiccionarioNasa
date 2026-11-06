import { vi, describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FavoritesTab } from "./favorites-tab"
import type { PerfilFavorite } from "./types"

const favorites: PerfilFavorite[] = [
  {
    id: "fav-1",
    wordId: "word-1",
    createdAt: "2026-03-15T10:00:00.000Z",
    word: {
      id: "word-1",
      spanish: "agua",
      nasaYuwe: "yu'",
      pronunciation: "yuʔ",
      category: "sustantivo",
      audioUrl: null,
    },
  },
]

describe("FavoritesTab", () => {
  it("shows the server word list with remove action", () => {
    const onRemove = vi.fn()
    render(
      <FavoritesTab favorites={favorites} loading={false} removingId={null} onRemove={onRemove} />
    )
    expect(screen.getByText("yu'")).toBeDefined()
    expect(screen.getByText("agua")).toBeDefined()
    expect(screen.getByRole("button", { name: /quitar yu' de favoritas/i })).toBeDefined()
  })

  it("links the word to the dictionary deep-link", () => {
    render(
      <FavoritesTab favorites={favorites} loading={false} removingId={null} onRemove={vi.fn()} />
    )
    const link = screen.getByText("yu'").closest("a")
    expect(link?.getAttribute("href")).toBe("/diccionario?palabra=word-1")
  })

  it("removes with one click", async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(
      <FavoritesTab favorites={favorites} loading={false} removingId={null} onRemove={onRemove} />
    )
    await user.click(screen.getByRole("button", { name: /quitar yu' de favoritas/i }))
    expect(onRemove).toHaveBeenCalledWith("word-1")
  })

  it("shows the empty state", () => {
    render(<FavoritesTab favorites={[]} loading={false} removingId={null} onRemove={vi.fn()} />)
    expect(screen.getByText("No tienes palabras favoritas")).toBeDefined()
  })
})
