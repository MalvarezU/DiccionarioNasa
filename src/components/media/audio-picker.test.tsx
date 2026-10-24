import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AudioPicker } from "./audio-picker"
import { compressToOpus } from "@/lib/audio/compress-audio"

vi.mock("@/lib/audio/compress-audio", () => ({
  compressToOpus: vi.fn(),
  OPUS_BITRATE_KBPS: 24,
}))

describe("AudioPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue(
      Response.json({ audioUrl: "https://cdn.test/audios/x.ogg", objectKey: "audios/x.ogg" }) as never
    )
  })

  function pickFile(name = "voz.mp3") {
    const input = screen.getByLabelText("Elegir archivo de audio") as HTMLInputElement
    const file = new File(["fake-audio"], name, { type: "audio/mpeg" })
    fireEvent.change(input, { target: { files: [file] } })
    return file
  }

  it("input oculto + boton Elegir (sin input visible duplicado)", () => {
    render(<AudioPicker onSubida={() => {}} />)
    const input = screen.getByLabelText("Elegir archivo de audio")
    // jsdom no aplica CSS: se aserta la clase que lo oculta
    expect(input.className).toMatch(/(^|\s)hidden(\s|$)/)
    expect(screen.getByRole("button", { name: /elegir/i })).toBeTruthy()
  })

  it("comprime, sube y devuelve la URL con el ahorro", async () => {
    const compressed = new File(["ogg"], "voz.ogg", { type: "audio/ogg" })
    Object.defineProperty(compressed, "size", { value: 9 * 1024 })
    vi.mocked(compressToOpus).mockResolvedValue({
      ok: true,
      file: compressed,
      originalBytes: 2 * 1024 * 1024,
      opusBytes: 9 * 1024,
    })
    const onSubida = vi.fn()
    render(<AudioPicker onSubida={onSubida} />)

    pickFile()

    await waitFor(() => expect(onSubida).toHaveBeenCalled())
    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/admin/upload-audio",
      expect.objectContaining({ method: "POST" })
    )
    const [url, meta] = onSubida.mock.calls[0] as [string, { objectKey?: string }]
    expect(url).toBe("https://cdn.test/audios/x.ogg")
    expect(meta?.objectKey).toBe("audios/x.ogg")
    expect(await screen.findByText(/2\.0 MB → 9 KB/)).toBeTruthy()
  })

  it("si la subida falla muestra el error del server", async () => {
    vi.mocked(compressToOpus).mockResolvedValue({
      ok: false,
      file: new File(["x"], "v.mp3", { type: "audio/mpeg" }),
      reason: "sin soporte",
    })
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ message: "Formato no soportado" }, { status: 400 }) as never
    )
    render(<AudioPicker onSubida={() => {}} />)

    pickFile()

    expect(await screen.findByText("Formato no soportado")).toBeTruthy()
  })
})
