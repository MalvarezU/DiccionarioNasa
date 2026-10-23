import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { compressToOpus } from "@/lib/audio/compress-audio"
import { useWordAudio } from "./use-word-audio"

vi.mock("@/lib/audio/compress-audio", () => ({
  compressToOpus: vi.fn(),
}))

const realCreateObjectURL = globalThis.URL.createObjectURL
const realRevokeObjectURL = globalThis.URL.revokeObjectURL

describe("useWordAudio con compresion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview") as never
    globalThis.URL.revokeObjectURL = vi.fn()
    global.fetch = vi.fn().mockResolvedValue(
      Response.json({ audioUrl: "https://cdn.test/audios/x.ogg" }) as never
    )
  })

  afterEach(() => {
    globalThis.URL.createObjectURL = realCreateObjectURL
    globalThis.URL.revokeObjectURL = realRevokeObjectURL
  })

  async function selectFile(
    res: { ok: true; file: File; originalBytes: number; opusBytes: number },
    name = "voz.mp3"
  ) {
    const { result } = renderHook(() => useWordAudio())
    vi.mocked(compressToOpus).mockResolvedValue(res)
    const file = new File(["fake"], name, { type: "audio/mpeg" })
    await act(async () => {
      await result.current.handleAudioSelect(file)
    })
    return { result, file }
  }

  it("sube el archivo comprimido (.ogg), no el original", async () => {
    const ogg = new File(["ogg-bytes"], "voz.ogg", { type: "audio/ogg" })
    const { result } = await selectFile({ ok: true, file: ogg, originalBytes: 1000, opusBytes: 100 })

    const fd = vi.mocked(global.fetch).mock.calls[0]?.[1] as { body: FormData } | undefined
    const sent = fd?.body.get("file") as File
    expect(sent.name).toBe("voz.ogg")
    expect(result.current.audioUrl).toBe("https://cdn.test/audios/x.ogg")
    expect(result.current.audioChanged).toBe(true)
  })

  it("si la compresion falla, sube el original sin bloquear", async () => {
    const original = new File(["fake"], "voz.wav", { type: "audio/wav" })
    const { result } = renderHook(() => useWordAudio())
    vi.mocked(compressToOpus).mockResolvedValue({ ok: false, file: original, reason: "x" })
    await act(async () => {
      await result.current.handleAudioSelect(original)
    })

    const fd = vi.mocked(global.fetch).mock.calls[0]?.[1] as { body: FormData } | undefined
    expect((fd?.body.get("file") as File).name).toBe("voz.wav")
    expect(result.current.audioUrl).toBe("https://cdn.test/audios/x.ogg")
  })

  it("clearAudio deja en null y marca cambio (para borrar al guardar)", async () => {
    const { result } = renderHook(() => useWordAudio())
    act(() => {
      result.current.resetAudio("https://cdn.test/audios/viejo.ogg")
    })
    act(() => {
      result.current.clearAudio()
    })
    expect(result.current.audioUrl).toBeNull()
    expect(result.current.audioChanged).toBe(true)
  })
})
