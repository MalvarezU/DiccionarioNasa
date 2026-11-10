import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FlashcardGame } from "./flashcard-game"
import { MemoryGame } from "./memory-game"
import { CompleteWordGame } from "./complete-word-game"
import { OrdenaGame } from "./ordena-game"
import { RelacionarGame } from "./relacionar-game"
import { tokenizeOrdena } from "@/lib/ordena-tokenizer"
import type { GameWord } from "@/lib/game-words"

const WORDS: GameWord[] = Array.from({ length: 12 }, (_, i) => ({
  id: `w${i}`,
  spanish: `Palabra${i}`,
  nasaYuwe: `Nasa${i}`,
  pronunciation: null,
  illustrationUrl: null,
  audioUrl: null,
}))

const ORDENA_WORDS: GameWord[] = [
  { id: "o1", spanish: "Casa", nasaYuwe: "Açxa", pronunciation: null, illustrationUrl: null, audioUrl: null },
  { id: "o2", spanish: "Rana", nasaYuwe: "Sxib", pronunciation: null, illustrationUrl: null, audioUrl: null },
  { id: "o3", spanish: "Perro", nasaYuwe: "Alku", pronunciation: null, illustrationUrl: null, audioUrl: null },
  { id: "o4", spanish: "Rojo", nasaYuwe: "Beh", pronunciation: null, illustrationUrl: null, audioUrl: null },
  { id: "o5", spanish: "Fuego", nasaYuwe: "Tek", pronunciation: null, illustrationUrl: null, audioUrl: null },
]

const REL_WORDS: GameWord[] = [
  { id: "r1", spanish: "Casa", nasaYuwe: "Yat", pronunciation: null, illustrationUrl: null, audioUrl: "https://audio.test/yat.mp3" },
  { id: "r2", spanish: "Agua", nasaYuwe: "Yu", pronunciation: null, illustrationUrl: null, audioUrl: null },
  { id: "r3", spanish: "Sol", nasaYuwe: "Ate", pronunciation: null, illustrationUrl: null, audioUrl: null },
  { id: "r4", spanish: "Perro", nasaYuwe: "Alku", pronunciation: null, illustrationUrl: null, audioUrl: null },
  { id: "r5", spanish: "Fuego", nasaYuwe: "Tek", pronunciation: null, illustrationUrl: null, audioUrl: null },
]

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

  it("ordena: arma la palabra ficha por ficha y avanza", async () => {
    const user = userEvent.setup()
    render(<OrdenaGame words={ORDENA_WORDS} />)
    expect(
      await screen.findByText(/Palabra 1 de 5/, {}, { timeout: 3000 })
    ).toBeDefined()
    expect(await screen.findByTestId("ordena-bank")).toBeDefined()
    // La ronda es aleatoria: se lee el prompt y se responde en orden
    const shown = ORDENA_WORDS.find((w) => screen.queryByText(w.spanish))
    expect(shown).toBeDefined()
    for (const token of tokenizeOrdena(shown!.nasaYuwe)) {
      await user.click(screen.getByRole("button", { name: `Ficha ${token}` }))
    }
    await user.click(screen.getByRole("button", { name: "Comprobar" }))
    expect(await screen.findByText("¡Correcto!")).toBeDefined()
    expect(
      await screen.findByText(/Palabra 2 de 5/, {}, { timeout: 3000 })
    ).toBeDefined()
  })

  it("ordena: error recuperable si hay pocas palabras elegibles", async () => {
    render(
      <OrdenaGame
        words={[
          { id: "x1", spanish: "Sol", nasaYuwe: "Ah", pronunciation: null, illustrationUrl: null, audioUrl: null },
        ]}
      />
    )
    expect(
      await screen.findByText("No se pudieron cargar las palabras")
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined()
    expect(screen.getByRole("link", { name: "Volver a juegos" })).toBeDefined()
  })
})

describe("anti-brinco reserve-then-fill + memoria con ilustración", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    sessionStorage.clear()
  })

  it("flashcards: Siguiente vive en contenedor reservado antes y después de responder", async () => {
    const user = userEvent.setup()
    render(
      <FlashcardGame
        questions={[
          { word: { id: "w1", spanish: "Casa", nasaYuwe: "Yat", pronunciation: "yat", category: "sustantivo" }, options: ["Yat", "Yu", "Ate", "Alku"], correctIndex: 0 },
          { word: { id: "w2", spanish: "Agua", nasaYuwe: "Yu", pronunciation: "yu", category: "sustantivo" }, options: ["Yu", "Yat", "Ate", "Alku"], correctIndex: 0 },
        ]}
      />
    )
    // Reservado antes de responder: altura min-h, botón oculto sin desmontar
    const slot = screen.getByTestId("flash-next")
    expect(slot).toHaveClass("min-h-10")
    const hiddenBtn = within(slot).getByRole("button", { hidden: true, name: "Siguiente" })
    expect(hiddenBtn).toHaveClass("invisible")
    expect(hiddenBtn).toBeDisabled()
    expect(screen.getByTestId("flash-streak-slot")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Yat" }))
    // Mismo nodo tras responder: visible, habilitado, sin remontar
    expect(screen.getByTestId("flash-next")).toBe(slot)
    const shownBtn = screen.getByRole("button", { name: "Siguiente" })
    expect(shownBtn).not.toHaveClass("invisible")
    expect(shownBtn).toBeEnabled()
  })

  it("ordena: pista y feedback reservan su espacio y el feedback se vuelve visible", async () => {
    const user = userEvent.setup()
    render(<OrdenaGame words={ORDENA_WORDS} />)
    expect(
      await screen.findByText(/Palabra 1 de 5/, {}, { timeout: 3000 })
    ).toBeDefined()
    const hint = screen.getByTestId("ordena-hint")
    const feedback = screen.getByTestId("ordena-feedback")
    expect(hint).toHaveClass("min-h-6")
    expect(feedback).toHaveClass("min-h-8")
    expect(hint.firstChild).toHaveClass("invisible")
    expect(feedback.firstChild).toHaveClass("invisible")

    const shown = ORDENA_WORDS.find((w) => screen.queryByText(w.spanish))
    expect(shown).toBeDefined()
    for (const token of tokenizeOrdena(shown!.nasaYuwe)) {
      await user.click(screen.getByRole("button", { name: `Ficha ${token}` }))
    }
    await user.click(screen.getByRole("button", { name: "Comprobar" }))
    // Mismo nodo de feedback, ahora visible: responder no cambia la altura
    expect(await screen.findByText("¡Correcto!")).toBeDefined()
    expect(screen.getByTestId("ordena-feedback")).toBe(feedback)
    expect(feedback.firstChild).not.toHaveClass("invisible")
  })

  it("completar: la fila de acción mantiene su altura reservada", async () => {
    render(<CompleteWordGame words={WORDS.slice(0, 5)} />)
    const inputs = await screen.findAllByRole("textbox")
    expect(inputs.length).toBeGreaterThan(0)
    expect(screen.getByTestId("complete-action")).toHaveClass("min-h-10")
  })

  it("memoria: carta con ilustración muestra imagen + palabra debajo", async () => {
    const illustrated: GameWord[] = [
      { id: "m1", spanish: "Casa", nasaYuwe: "Yat", pronunciation: null, illustrationUrl: "https://ejemplo.test/casa.jpg", audioUrl: null },
      { id: "m2", spanish: "Agua", nasaYuwe: "Yu", pronunciation: null, illustrationUrl: null, audioUrl: null },
      { id: "m3", spanish: "Sol", nasaYuwe: "Sek", pronunciation: null, illustrationUrl: null, audioUrl: null },
      { id: "m4", spanish: "Luna", nasaYuwe: "Ate", pronunciation: null, illustrationUrl: null, audioUrl: null },
    ]
    render(<MemoryGame words={illustrated} />)
    const img = await screen.findByAltText("Casa")
    expect(img).toHaveAttribute("src", "https://ejemplo.test/casa.jpg")
    expect(img).toHaveAttribute("loading", "lazy")
    expect(img.closest("button")).toHaveTextContent("Casa")
    // Caption de idioma se mantiene
    expect(img.closest("button")).toHaveTextContent("Español")
  })

  it("memoria: sin ilustración cae al texto centrado sin <img>", async () => {
    const { container } = render(<MemoryGame words={WORDS.slice(0, 4)} />)
    expect((await screen.findAllByLabelText(/Carta tapada/)).length).toBeGreaterThan(0)
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText("Palabra0")).toBeDefined()
  })
})

describe("relacionar: unir parejas ES ↔ NY [Fase 1+2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    sessionStorage.clear()
  })

  it("emparejar una pareja suma un acierto y la deja fija", async () => {
    const user = userEvent.setup()
    render(<RelacionarGame words={REL_WORDS} />)
    expect(await screen.findByText("Ronda 1 de 1", {}, { timeout: 3000 })).toBeDefined()
    expect(screen.getByRole("group", { name: "Español: elige una palabra" })).toBeDefined()
    expect(screen.getByRole("group", { name: "Nasa Yuwe: elige su pareja" })).toBeDefined()

    await user.click(screen.getByRole("button", { name: "Casa" }))
    await user.click(screen.getByRole("button", { name: "Yat" }))

    expect(await screen.findByText(/¡Correcto! Casa es Yat/)).toBeDefined()
    expect(screen.getByLabelText("1 aciertos")).toBeDefined()
    // Pareja fija: ambos botones quedan deshabilitados
    expect(screen.getByRole("button", { name: "Casa" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Yat" })).toBeDisabled()
  })

  it("el error no suma, avisa y permite reintentar", async () => {
    const user = userEvent.setup()
    render(<RelacionarGame words={REL_WORDS} />)
    expect(await screen.findByText("Ronda 1 de 1", {}, { timeout: 3000 })).toBeDefined()

    await user.click(screen.getByRole("button", { name: "Casa" }))
    await user.click(screen.getByRole("button", { name: "Yu" }))

    expect(await screen.findByText("No son pareja, intenta de nuevo")).toBeDefined()
    expect(screen.getByLabelText("0 aciertos")).toBeDefined()

    // Tras el shake se puede reintentar y acertar
    await waitFor(
      () => expect(screen.getByRole("button", { name: "Casa" })).toBeEnabled(),
      { timeout: 2000 }
    )
    await user.click(screen.getByRole("button", { name: "Casa" }))
    await user.click(screen.getByRole("button", { name: "Yat" }))
    expect(await screen.findByText(/¡Correcto! Casa es Yat/)).toBeDefined()
    expect(screen.getByLabelText("1 aciertos")).toBeDefined()
  })

  it("completar la ronda reporta el resultado y ofrece jugar de nuevo", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue(Response.json({ saved: true }) as never)
    const onFinish = vi.fn()
    render(<RelacionarGame words={REL_WORDS} onFinish={onFinish} />)
    expect(await screen.findByText("Ronda 1 de 1", {}, { timeout: 3000 })).toBeDefined()

    for (const [es, ny] of [["Casa", "Yat"], ["Agua", "Yu"], ["Sol", "Ate"], ["Perro", "Alku"], ["Fuego", "Tek"]]) {
      await user.click(screen.getByRole("button", { name: es }))
      await user.click(screen.getByRole("button", { name: ny }))
    }

    await user.click(await screen.findByRole("button", { name: "Ver resultados" }))
    expect(await screen.findByText("Jugar de nuevo", {}, { timeout: 3000 })).toBeDefined()
    expect(onFinish).toHaveBeenCalledWith({ correct: 5, total: 5 })
    expect(fetch).toHaveBeenCalledWith(
      "/api/games/result",
      expect.objectContaining({ method: "POST" })
    )
    const [, opts] = vi.mocked(fetch).mock.calls[0] as unknown as [string, { body: string }]
    expect(JSON.parse(opts.body)).toMatchObject({ game: "relacionar", won: true })
  })

  it("dificultades: Fácil es el default y Medio/Difícil cambian el tablero", async () => {
    const user = userEvent.setup()
    const MANY: GameWord[] = Array.from({ length: 32 }, (_, i) => ({
      id: `d${i}`,
      spanish: `Esp${i}`,
      nasaYuwe: `Nasa${i}`,
      pronunciation: null,
      illustrationUrl: null,
      audioUrl: null,
    }))
    render(<RelacionarGame words={MANY} />)
    // Default Fácil: 3 rondas × 5 parejas
    expect(await screen.findByText("Ronda 1 de 3", {}, { timeout: 3000 })).toBeDefined()
    expect(screen.getByRole("group", { name: "Dificultad" })).toBeDefined()
    expect(screen.getByRole("button", { name: /Fácil/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    )

    // Medio: 4 rondas × 6 parejas
    await user.click(screen.getByRole("button", { name: /Medio/ }))
    expect(await screen.findByText("Ronda 1 de 4", {}, { timeout: 3000 })).toBeDefined()
    expect(screen.getByRole("button", { name: /Medio/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    )

    // Difícil: 4 rondas × 8 parejas
    await user.click(screen.getByRole("button", { name: /Difícil/ }))
    expect(await screen.findByText("Ronda 1 de 4", {}, { timeout: 3000 })).toBeDefined()
    expect(screen.getByRole("button", { name: /Difícil/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })
})
