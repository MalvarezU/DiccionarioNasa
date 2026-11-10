import { describe, it, expect } from "vitest"
import { detectAudioMime, isOpusOgg, expectedExtensions } from "./audio"

function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals)
}

function withAscii(prefix: string, extra: number[] = []): Uint8Array {
  const out = new Uint8Array(prefix.length + extra.length + 8)
  for (let i = 0; i < prefix.length; i++) out[i] = prefix.charCodeAt(i)
  extra.forEach((v, i) => (out[prefix.length + i] = v))
  return out
}

describe("detectAudioMime", () => {
  it("detecta MP3 con etiqueta ID3", () => {
    expect(detectAudioMime(withAscii("ID3", [4, 0, 0, 0, 0, 0]))).toBe("audio/mpeg")
  })

  it("detecta MP3 crudo por frame sync", () => {
    expect(detectAudioMime(bytes(0xff, 0xfb, 0x90, 0x00, 0x00))).toBe("audio/mpeg")
  })

  it("detecta WAV por RIFF+WAVE", () => {
    const b = withAscii("RIFF....WAVE", [0, 0])
    expect(detectAudioMime(b)).toBe("audio/wav")
  })

  it("detecta Ogg (Vorbis u Opus) por OggS", () => {
    expect(detectAudioMime(withAscii("OggS", [0, 2]))).toBe("audio/ogg")
  })

  it("rechaza contenido que no es audio y vacíos", () => {
    expect(detectAudioMime(new TextEncoder().encode("fake"))).toBeNull()
    expect(detectAudioMime(new Uint8Array(0))).toBeNull()
    expect(detectAudioMime(bytes(1, 2, 3))).toBeNull()
  })
})

describe("isOpusOgg", () => {
  it("reconoce Ogg Opus por OpusHead", () => {
    const head = new TextEncoder().encode("OggS............OpusHead")
    expect(isOpusOgg(head)).toBe(true)
  })

  it("rechaza Ogg sin OpusHead", () => {
    const head = new TextEncoder().encode("OggS............OpusTags")
    expect(isOpusOgg(head)).toBe(false)
  })
})

describe("expectedExtensions", () => {
  it("mapea cada MIME a su extensión", () => {
    expect(expectedExtensions("audio/mpeg")).toEqual([".mp3"])
    expect(expectedExtensions("audio/wav")).toEqual([".wav"])
    expect(expectedExtensions("audio/ogg")).toEqual([".ogg"])
  })
})
