import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FlashcardGame } from "./flashcard-game"
import { MemoryGame } from "./memory-game"
import { CompleteWordGame } from "./complete-word-game"
import type { GameWord } from "@/lib/game-words"

const WORDS: GameWord[] = Array.from({ length: 12 }, (_, i) => ({
  id: `w${i}`,
  spanish: `Palabra${i}`,
  nasaYuwe: `Nasa${i}`,
  pronunciation: null,
}))

describe("juegos con palabras reales [B2.1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    sessionStorage.clear()
  })

  it("flashcards: responde con feedback y cambia de dirección", async () => {
    const user = userEvent.setup()
    render(
      <FlashcardGame
        questions={[
          { word: { id: "w1", spanish: "Casa", nasaYuwe: "Yat", pronunciation: "yat", category: "sustantivo" }, options: ["Yat", "Yu", "Ate", "Alku"], correctIndex: 0 },
          { word: { id: "w2", spanish: "Agua", nasaYuwe: "Yu", pronunciation: "yu", category: "sustantivo" }, options: ["Yu", "Yat", "Ate", "Alku"], correctIndex: 0 },
        ]}
      />
    )
    expect(screen.getByText("Casa")).toBeDefined()
    await user.click(screen.getByRole("button", { name: "Yat" }))
    expect(await screen.findByText("Siguiente")).toBeDefined()

    await user.click(screen.getByRole("button", { name: /Nasa Yuwe → Español/ }))
    expect(screen.getByText("¿Qué significa en español?")).toBeDefined()
  })

  it("flashcards: carga palabras del backend", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        words: WORDS.slice(0, 8).map((w) => ({ ...w, pronunciation: null })),
      }) as never
    )
    render(<FlashcardGame />)
    expect(await screen.findByText(/Pregunta 1 de 8/, {}, { timeout: 3000 })).toBeDefined()
    expect(fetch).toHaveBeenCalledWith("/api/games/words?count=12")
  })

  it("memoria: tablero según dificultad", async () => {
    const user = userEvent.setup()
    render(<MemoryGame words={WORDS} />)
    // 6 parejas = 12 cartas tapadas
    expect((await screen.findAllByLabelText(/Carta tapada/)).length).toBe(12)

    await user.click(screen.getByRole("button", { name: /Medio \(8\)/ }))
    // 8 parejas = 16 cartas
    expect((await screen.findAllByLabelText(/Carta tapada/)).length).toBe(16)
  })

  it("completar: niveles funcionales y preguntas reales", async () => {
    const user = userEvent.setup()
    render(<CompleteWordGame words={WORDS.slice(0, 5)} />)
    expect(await screen.findByRole("group", { name: "Dificultad" })).toBeDefined()
    await user.click(screen.getByRole("button", { name: "Fácil" }))
    // Tras cambiar de nivel sigue habiendo inputs de letras
    const inputs = await screen.findAllByRole("textbox")
    expect(inputs.length).toBeGreaterThan(0)
  })
})
