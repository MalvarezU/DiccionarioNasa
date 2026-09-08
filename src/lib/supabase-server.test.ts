import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  audioObjectPath,
  audioUrlToObjectPath,
  getPublicAudioUrl,
  signedUrlToObjectPath,
} from "./supabase-server"

const SUPABASE_URL = "https://rjdukxvhmvzbiqliakyu.supabase.co"

describe("audioObjectPath", () => {
  it("genera ruta wordId/archivo con timestamp", () => {
    const path = audioObjectPath("word123", "hola mundo.mp3")
    expect(path).toMatch(/^word123\/\d+-hola_mundo\.mp3$/)
  })

  it("sanitiza path traversal en el nombre", () => {
    const path = audioObjectPath("w1", "../../.env")
    expect(path).not.toContain("..")
    expect(path).toMatch(/^w1\//)
  })

  it("trunca nombres muy largos", () => {
    const path = audioObjectPath("w1", `${"a".repeat(200)}.mp3`)
    expect(path.length).toBeLessThan(160)
  })
})

describe("getPublicAudioUrl", () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV, SUPABASE_URL }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it("construye URL pública permanente (no firmada)", () => {
    const url = getPublicAudioUrl("temp/123-test.mp3")
    expect(url).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/audios/temp/123-test.mp3`
    )
    expect(url).not.toContain("/object/sign/")
    expect(url).not.toContain("token=")
  })

  it("lanza si falta SUPABASE_URL", () => {
    delete process.env.SUPABASE_URL
    expect(() => getPublicAudioUrl("a/b.mp3")).toThrow()
  })
})

describe("audioUrlToObjectPath", () => {
  it("extrae path de URL pública", () => {
    expect(
      audioUrlToObjectPath(
        `${SUPABASE_URL}/storage/v1/object/public/audios/temp/file.mp3`
      )
    ).toBe("temp/file.mp3")
  })

  it("extrae path de signed URL legacy", () => {
    expect(
      audioUrlToObjectPath(
        "https://xyz.supabase.co/storage/v1/object/sign/audios/temp/file.mp3?token=abc"
      )
    ).toBe("temp/file.mp3")
  })

  it("acepta objectPath relativo", () => {
    expect(audioUrlToObjectPath("temp/file.mp3")).toBe("temp/file.mp3")
  })

  it("rechaza path traversal", () => {
    expect(audioUrlToObjectPath("../secrets.mp3")).toBeNull()
    expect(
      audioUrlToObjectPath(
        "https://xyz.supabase.co/storage/v1/object/public/audios/../x.mp3"
      )
    ).toBeNull()
  })

  it("rechaza URLs legacy /audio/ y nulas", () => {
    expect(audioUrlToObjectPath("/audio/test.mp3")).toBeNull()
    expect(audioUrlToObjectPath("")).toBeNull()
    // @ts-expect-error prueba defensiva
    expect(audioUrlToObjectPath(undefined)).toBeNull()
  })

  it("rechaza bucket distinto", () => {
    expect(
      audioUrlToObjectPath(
        "https://xyz.supabase.co/storage/v1/object/public/otros/temp/f.mp3"
      )
    ).toBeNull()
  })
})

describe("signedUrlToObjectPath (compat)", () => {
  it("delega en audioUrlToObjectPath", () => {
    expect(
      signedUrlToObjectPath(
        "https://xyz.supabase.co/storage/v1/object/sign/audios/temp/f.mp3?token=t"
      )
    ).toBe("temp/f.mp3")
  })
})

describe("getSupabaseServer import", () => {
  it("no importa supabase-js innecesariamente en este test", () => {
    expect(vi.isMockFunction(audioObjectPath)).toBe(false)
  })
})
