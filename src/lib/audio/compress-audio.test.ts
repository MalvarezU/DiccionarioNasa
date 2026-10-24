import { vi, describe, it, expect, beforeEach } from "vitest"
import {
  downmixToMono,
  concatChunks,
  opusFileName,
  compressToOpus,
  OPUS_BITRATE_KBPS,
} from "./compress-audio"

const mockEncode = vi.fn()
const mockFlush = vi.fn()
const mockFree = vi.fn()
const mockCreateEncoder = vi.fn()

vi.mock("@audio/encode-opus", () => ({
  default: (...args: unknown[]) => mockCreateEncoder(...args),
}))

function stubAudioContext(pcm: Float32Array[], sampleRate = 44100) {
  const decodeAudioData = vi.fn(async () => ({
    numberOfChannels: pcm.length,
    length: pcm[0]?.length ?? 0,
    sampleRate,
    getChannelData: (c: number) => pcm[c]!,
  }))
  const close = vi.fn(async () => {})
  function AudioContextStub(this: unknown) {
    return { decodeAudioData, close }
  }
  ;(globalThis as Record<string, unknown>).AudioContext = vi.fn(AudioContextStub) as never
  return { decodeAudioData, close }
}

describe("downmixToMono", () => {
  it("promedia estéreo a mono", () => {
    const out = downmixToMono([new Float32Array([2, 4]), new Float32Array([4, 8])])
    expect(Array.from(out)).toEqual([3, 6])
  })

  it("mono pasa igual (misma referencia)", () => {
    const m = new Float32Array([1, 2, 3])
    expect(downmixToMono([m])).toBe(m)
  })

  it("vacío no lanza", () => {
    expect(downmixToMono([])).toHaveLength(0)
  })
})

describe("concatChunks", () => {
  it("concatena en orden", () => {
    expect(Array.from(concatChunks([new Uint8Array([1, 2]), new Uint8Array([3])]))).toEqual([1, 2, 3])
  })
})

describe("opusFileName", () => {
  it("cambia la extensión a .ogg", () => {
    expect(opusFileName("palabra.mp3")).toBe("palabra.ogg")
    expect(opusFileName("sin-extension")).toBe("sin-extension.ogg")
  })
})

describe("compressToOpus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (globalThis as Record<string, unknown>).AudioContext
  })

  it("encodea a Ogg mono 24kbps y reporta tamaños", async () => {
    stubAudioContext([new Float32Array([0.1, 0.2]), new Float32Array([0.3, 0.4])], 44100)
    mockCreateEncoder.mockResolvedValue({ encode: mockEncode, flush: mockFlush, free: mockFree })
    mockEncode.mockReturnValue(new Uint8Array([1, 2, 3]))
    mockFlush.mockReturnValue(new Uint8Array([4]))

    const file = new File(["fake"], "voz.mp3", { type: "audio/mpeg" })
    const res = await compressToOpus(file)

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(mockCreateEncoder).toHaveBeenCalledWith(
      expect.objectContaining({ sampleRate: 44100, channels: 1, bitrate: OPUS_BITRATE_KBPS })
    )
    // downmix: ([0.1+0.3, 0.2+0.4] / 2), con error de punto flotante
    const passed: Float32Array[] = mockEncode.mock.calls[0]![0] as Float32Array[]
    expect(passed[0]![0]).toBeCloseTo(0.2, 5)
    expect(passed[0]![1]).toBeCloseTo(0.3, 5)
    expect(res.file.name).toBe("voz.ogg")
    expect(res.file.type).toBe("audio/ogg")
    expect(res.originalBytes).toBe(file.size)
    expect(res.opusBytes).toBe(4)
    expect(mockFree).toHaveBeenCalled()
  })

  it("ante fallo del encoder devuelve el original sin bloquear", async () => {
    stubAudioContext([new Float32Array([0.1])])
    mockCreateEncoder.mockRejectedValueOnce(new Error("wasm roto"))

    const file = new File(["fake"], "voz.wav", { type: "audio/wav" })
    const res = await compressToOpus(file)
    expect(res.ok).toBe(false)
    expect(res.file).toBe(file)
  })

  it("sin AudioContext devuelve el original", async () => {
    const file = new File(["fake"], "voz.mp3", { type: "audio/mpeg" })
    const res = await compressToOpus(file)
    expect(res.ok).toBe(false)
    expect(res.file).toBe(file)
  })
})
