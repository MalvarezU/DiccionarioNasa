import { it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { FlashcardGame } from "./flashcard-game"
it("dbg", async () => {
  const WORDS = Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, spanish: `Palabra${i}`, nasaYuwe: `Nasa${i}`, pronunciation: null }))
  global.fetch = vi.fn().mockResolvedValue(Response.json({ words: WORDS }) as never)
  render(<FlashcardGame />)
  try {
    console.log("ENCONTRADO:", (await screen.findByText("Palabra0", {}, { timeout: 2000 })).textContent)
  } catch {
    console.log("NO encontrado. fetch calls:", (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length)
    console.log("body tiene:", document.body.textContent?.slice(0, 200))
  }
})
