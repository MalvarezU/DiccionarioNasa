import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  audioKey,
  audioRefToKey,
  isAllowedCoverImageUrl,
  r2PublicBase,
} from "./storage"

const R2_BASE = "https://cdn.test"

describe("audioKey", () => {
  it("arma la clave con prefijo audios y timestamp", () => {
    const key = audioKey("temp", "hola mundo.mp3")
    expect(key).toMatch(/^audios\/temp\/\d+-hola_mundo\.mp3$/)
  })

  it("sanea nombres peligrosos", () => {
    expect(audioKey("w1", "../../.env")).toMatch(/^audios\/w1\/\d+-____\.env$/)
  })
})

describe("audioRefToKey", () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = R2_BASE
  })
  afterEach(() => {
    delete process.env.R2_PUBLIC_BASE_URL
  })

  it("recorta la base pública R2", () => {
    expect(audioRefToKey(`${R2_BASE}/audios/temp/f.mp3`)).toBe("audios/temp/f.mp3")
  })

  it("rechaza traversal en URL R2", () => {
    expect(audioRefToKey(`${R2_BASE}/audios/../x.mp3`)).toBeNull()
  })

  it("mapea URL legacy pública de Supabase con prefijo audios/", () => {
    expect(
      audioRefToKey("https://xyz.supabase.co/storage/v1/object/public/audios/temp/f.mp3")
    ).toBe("audios/temp/f.mp3")
  })

  it("mapea URL legacy firmada de Supabase", () => {
    expect(
      audioRefToKey("https://xyz.supabase.co/storage/v1/object/sign/audios/temp/f.mp3?token=t")
    ).toBe("audios/temp/f.mp3")
  })

  it("rechaza legacy fuera del bucket audios", () => {
    expect(
      audioRefToKey("https://xyz.supabase.co/storage/v1/object/public/otros/temp/f.mp3")
    ).toBeNull()
  })

  it("normaliza clave relativa con prefijo", () => {
    expect(audioRefToKey("temp/file.mp3")).toBe("audios/temp/file.mp3")
    expect(audioRefToKey("audios/temp/file.mp3")).toBe("audios/temp/file.mp3")
  })

  it("rechaza traversal, prefijo legacy y vacíos", () => {
    expect(audioRefToKey("../secrets.mp3")).toBeNull()
    expect(audioRefToKey("/audio/test.mp3")).toBeNull()
    expect(audioRefToKey("")).toBeNull()
    expect(audioRefToKey(undefined)).toBeNull()
    expect(audioRefToKey("https://otro.com/audios/f.mp3")).toBeNull()
  })
})

describe("isAllowedCoverImageUrl", () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = R2_BASE
  })
  afterEach(() => {
    delete process.env.R2_PUBLIC_BASE_URL
  })

  it("acepta legacy /api/media y base R2", () => {
    expect(isAllowedCoverImageUrl("/api/media/abc123")).toBe(true)
    expect(isAllowedCoverImageUrl(`${R2_BASE}/images/a.png`)).toBe(true)
  })

  it("rechaza externas, javascript: y con espacios", () => {
    expect(isAllowedCoverImageUrl("https://evil.com/a.png")).toBe(false)
    expect(isAllowedCoverImageUrl("javascript:alert(1)")).toBe(false)
    expect(isAllowedCoverImageUrl(`${R2_BASE}/a b.png`)).toBe(false)
  })
})

describe("r2PublicBase", () => {
  it("devuelve null sin env", () => {
    delete process.env.R2_PUBLIC_BASE_URL
    expect(r2PublicBase()).toBeNull()
  })

  it("normaliza trailing slash", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.test/"
    expect(r2PublicBase()).toBe("https://cdn.test")
    delete process.env.R2_PUBLIC_BASE_URL
  })
})
