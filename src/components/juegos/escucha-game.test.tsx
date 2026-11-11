import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EscuchaGame } from "./escucha-game"
import { useOfflineAudio } from "@/hooks/use-offline-audio"
import * as gameSound from "@/lib/game-sound"
import type { GameWord } from "@/lib/game-words"

vi.mock("@/hooks/use-offline-audio", () => ({
  useOfflineAudio: vi.fn(),
}))

const WORDS: GameWord[] = Array.from({ length: 8 }, (_, i) => ({
  id: `e${i}`,
  spanish: `Palabra${i}`,
  nasaYuwe: `Nasa${i}`,
  pronunciation: null,
  illustrationUrl: null,
  audioUrl: `https://audio.test/e${i}.mp3`,
}))

/** La ronda actual se deduce del audioUrl que pide el juego al hook. */
function currentWord(): GameWord {
  const calls = vi.mocked(useOfflineAudio).mock.calls
  const url = calls[calls.length - 1]![0] as string
  const word = WORDS.find((w) => w.audioUrl === url)
  expect(word).toBeDefined()
  return word!
}

describe("escucha: escuchar y elegir en español [Fase 4]", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    sessionStorage.clear()
    vi.mocked(useOfflineAudio).mockImplementation((url) => ({
      audioSrc: url,
      isCached: false,
      isDownloading: false,
      downloadProgress: 0,
      downloadForOffline: async () => {},
      removeFromCache: async () => {},
      storageInfo: null,
    }))
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("responder bien suma, revela la palabra en grande y solo avanza con Siguiente", async () => {
    const user = userEvent.setup()
    render(<EscuchaGame words={WORDS} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    // Gesto del usuario habilita el audio; el botón tiene label propio
    expect(
      screen.getByRole("button", { name: "Reproducir audio en Nasa Yuwe" })
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Saltar palabra" })).toBeDefined()

    const word = currentWord()
    await user.click(screen.getByRole("button", { name: word.spanish }))

    // Feedback de juicio + tarjeta principal con la palabra en grande
    expect(await screen.findByText(/¡Correcto!/)).toBeDefined()
    const answer = screen.getByTestId("escucha-answer")
    expect(within(answer).getByText(word.nasaYuwe)).toBeDefined()
    expect(screen.getByLabelText("1 aciertos")).toBeDefined()

    // Escuchar sigue habilitado para re-escuchar tras responder
    expect(
      screen.getByRole("button", { name: "Reproducir audio en Nasa Yuwe" })
    ).toBeEnabled()

    // Sin auto-avance: tras 1.2s sigue en la ronda 1
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1200))
    })
    expect(screen.getByText("Ronda 1 de 8")).toBeDefined()

    // Avance manual con Siguiente
    await user.click(screen.getByRole("button", { name: "Siguiente" }))
    expect(await screen.findByText("Ronda 2 de 8", {}, { timeout: 3000 })).toBeDefined()
  })

  it("responder mal no suma, revela la palabra y avanza con Siguiente", async () => {
    const user = userEvent.setup()
    render(<EscuchaGame words={WORDS} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    const word = currentWord()
    // Cualquier opción visible que no sea la correcta de esta ronda
    const wrongBtn = screen
      .getAllByTestId("escucha-option")
      .find((el) => !(el.textContent ?? "").includes(word.spanish))!
    expect(wrongBtn).toBeDefined()
    fireEvent.click(wrongBtn)

    expect(await screen.findByText(/Casi:/)).toBeDefined()
    const answer = screen.getByTestId("escucha-answer")
    expect(within(answer).getByText(word.nasaYuwe)).toBeDefined()
    expect(screen.getByLabelText("0 aciertos")).toBeDefined()

    // Sin auto-avance: el avance es solo con Siguiente
    await user.click(screen.getByRole("button", { name: "Siguiente" }))
    expect(await screen.findByText("Ronda 2 de 8", {}, { timeout: 3000 })).toBeDefined()
  })

  it("saltar palabra no suma, la revela y avanza solo con Siguiente", async () => {
    const user = userEvent.setup()
    render(<EscuchaGame words={WORDS} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    const word = currentWord()
    await user.click(screen.getByRole("button", { name: "Saltar palabra" }))

    expect(await screen.findByText(/Palabra saltada/)).toBeDefined()
    const answer = screen.getByTestId("escucha-answer")
    expect(within(answer).getByText(word.nasaYuwe)).toBeDefined()
    expect(screen.getByLabelText("0 aciertos")).toBeDefined()
    // Sin auto-avance: sigue en ronda 1 hasta pulsar Siguiente
    expect(screen.getByText("Ronda 1 de 8")).toBeDefined()
    await user.click(screen.getByRole("button", { name: "Siguiente" }))
    expect(await screen.findByText("Ronda 2 de 8", {}, { timeout: 3000 })).toBeDefined()
  })

  it("completar las 8 rondas con Siguiente reporta game escucha y ofrece jugar de nuevo", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ saved: true }) as never)
    const onFinish = vi.fn()
    render(<EscuchaGame words={WORDS} onFinish={onFinish} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    for (let round = 0; round < 8; round++) {
      const word = currentWord()
      fireEvent.click(screen.getByRole("button", { name: word.spanish }))
      fireEvent.click(
        screen.getByRole("button", {
          name: round < 7 ? "Siguiente" : "Ver resultados",
        })
      )
    }

    expect(screen.getByText("Jugar de nuevo")).toBeDefined()
    expect(onFinish).toHaveBeenCalledWith({ correct: 8, total: 8 })
    expect(fetch).toHaveBeenCalledWith(
      "/api/games/result",
      expect.objectContaining({ method: "POST" })
    )
    const [, opts] = vi.mocked(fetch).mock.calls[0] as unknown as [
      string,
      { body: string },
    ]
    expect(JSON.parse(opts.body)).toMatchObject({
      game: "escucha",
      won: true,
      score: 80,
      streak: 8,
    })
  })

  it("sin audios suficientes cae al error real con Reintentar", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ words: [] }) as never)
    render(<EscuchaGame />)
    expect(
      await screen.findByText("No se pudieron cargar las palabras")
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined()
    expect(screen.getByRole("link", { name: "Volver a juegos" })).toBeDefined()
    expect(fetch).toHaveBeenCalledWith("/api/games/words?count=16&withAudio=1")
  })

  it("revelar la palabra no cambia la altura de la página (zona con altura reservada)", async () => {
    const user = userEvent.setup()
    render(<EscuchaGame words={WORDS} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    // La zona vive montada desde el inicio, con altura reservada y oculta a AT
    const answerBefore = screen.getByTestId("escucha-answer")
    expect(answerBefore).toHaveClass("min-h-28")
    expect(answerBefore).toHaveAttribute("aria-hidden", "true")
    expect(within(answerBefore).getByText("···")).toBeDefined()

    const card = document.querySelector("[data-question]") as HTMLElement
    expect(card).not.toBeNull()
    const scrollBefore = document.body.scrollHeight
    const cardScrollBefore = card.scrollHeight
    const cardRectBefore = card.getBoundingClientRect().height

    // Responder: el MISMO nodo intercambia placeholder por la palabra
    const word = currentWord()
    await user.click(screen.getByRole("button", { name: word.spanish }))
    expect(await screen.findByText(/¡Correcto!/)).toBeDefined()

    const answerAfter = screen.getByTestId("escucha-answer")
    expect(answerAfter).toBe(answerBefore)
    expect(answerAfter).toHaveClass("min-h-28")
    expect(answerAfter).toHaveAttribute("aria-hidden", "false")
    expect(within(answerAfter).getByText(word.nasaYuwe)).toBeDefined()

    // Altura de página y de tarjeta idénticas antes/después del reveal
    expect(document.body.scrollHeight).toBe(scrollBefore)
    expect(card.scrollHeight).toBe(cardScrollBefore)
    expect(card.getBoundingClientRect().height).toBe(cardRectBefore)

    // El botón Escuchar no cambia de tamaño ni de posición entre estados
    const listen = screen.getByRole("button", {
      name: "Reproducir audio en Nasa Yuwe",
    })
    expect(listen).toHaveClass("h-20")
  })

  it("el aviso de audio vive en un slot reservado (altura constante)", async () => {
    const user = userEvent.setup()
    render(<EscuchaGame words={WORDS} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    // Slot siempre montado, con altura reservada y aviso oculto sin desmontar
    const slot = screen.getByTestId("escucha-audio-slot")
    expect(slot).toHaveClass("min-h-6")
    expect(within(slot).getByRole("alert", { hidden: true })).toHaveClass(
      "invisible"
    )

    // El play falla → el MISMO nodo se vuelve visible, sin brinco de layout
    vi.mocked(window.HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new Error("no audio")
    )
    await user.click(
      screen.getByRole("button", { name: "Reproducir audio en Nasa Yuwe" })
    )
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("El audio no se pudo reproducir")
    expect(alert).not.toHaveClass("invisible")
    expect(screen.getByTestId("escucha-audio-slot")).toBe(slot)
    expect(slot).toHaveClass("min-h-6")
  })

  it("el resultado lista el vocabulario con acierto/fallo por ronda", async () => {
    const pronounced: GameWord[] = WORDS.map((w, i) => ({
      ...w,
      pronunciation: i % 2 === 0 ? `pro${i}` : null,
    }))
    vi.mocked(fetch).mockResolvedValue(Response.json({ saved: true }) as never)
    render(<EscuchaGame words={pronounced} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    for (let round = 0; round < 8; round++) {
      const word = currentWord()
      if (round % 2 === 0) {
        fireEvent.click(screen.getByRole("button", { name: word.spanish }))
      } else {
        const wrongBtn = screen
          .getAllByTestId("escucha-option")
          .find((el) => !(el.textContent ?? "").includes(word.spanish))!
        fireEvent.click(wrongBtn)
      }
      fireEvent.click(
        screen.getByRole("button", {
          name: round < 7 ? "Siguiente" : "Ver resultados",
        })
      )
    }

      expect(
        screen.getByText("Así se escriben las palabras que escuchaste:")
      ).toBeDefined()
      const items = screen.getAllByTestId("escucha-recap-item")
      expect(items).toHaveLength(8)
      // 4 acertadas (rondas pares) + 4 falladas, con Nasa Yuwe en serif bold
      expect(screen.getAllByText("acertada", { exact: true })).toHaveLength(4)
      expect(screen.getAllByText("fallada", { exact: true })).toHaveLength(4)
      for (const w of WORDS) {
        expect(screen.getByText(w.nasaYuwe)).toBeDefined()
        expect(screen.getByText(w.spanish)).toBeDefined()
      }
      // La pronunciación solo aparece cuando existe
      expect(screen.getByText("[pro0]")).toBeDefined()
      expect(screen.queryByText("[pro1]")).toBeNull()
  })

  it("el shimmer de racha suena solo al subir de tier", async () => {
    const tierSpy = vi.spyOn(gameSound, "playStreakTier")
    try {
      render(<EscuchaGame words={WORDS} />)
      expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

      // Racha 1 (tier 0): sin shimmer
      fireEvent.click(
        screen.getByRole("button", { name: currentWord().spanish })
      )
      expect(tierSpy).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }))

      // Racha 2 (tier 0 → 1): suena una vez con tier 1
      fireEvent.click(
        screen.getByRole("button", { name: currentWord().spanish })
      )
      expect(tierSpy).toHaveBeenCalledTimes(1)
      expect(tierSpy).toHaveBeenCalledWith(1)
    } finally {
      tierSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it("toggle de modo muestra el botón Escritura y cambia las opciones a Nasa Yuwe", async () => {
    const user = userEvent.setup()
    render(<EscuchaGame words={WORDS} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    const btnEscritura = screen.getByRole("button", { name: /escritura/i })
    expect(btnEscritura).toBeDefined()

    await user.click(btnEscritura)

    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    const word = currentWord()
    expect(screen.getByRole("button", { name: word.nasaYuwe })).toBeDefined()
  })

  it("el modo se persiste en localStorage", async () => {
    const user = userEvent.setup()
    render(<EscuchaGame words={WORDS} />)
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    await user.click(screen.getByRole("button", { name: /escritura/i }))
    expect(await screen.findByText("Ronda 1 de 8", {}, { timeout: 3000 })).toBeDefined()

    expect(localStorage.getItem("piiyaak:escucha:mode:v1")).toBe("escritura")
  })
})
