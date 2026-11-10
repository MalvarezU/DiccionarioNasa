import { describe, it, expect } from "vitest"
import { imageKeyFor, classifyAudioUrl } from "./migration"

const R2 = "https://cdn.test"

describe("imageKeyFor", () => {
  it("arma clave determinista por id y MIME", () => {
    expect(imageKeyFor("cmvhekgct0099ck5ebqu16sqs", "image/png")).toBe(
      "images/cmvhekgct0099ck5ebqu16sqs.png"
    )
    expect(imageKeyFor("abc", "image/jpeg")).toBe("images/abc.jpg")
  })

  it("null con MIME desconocido o id inseguro", () => {
    expect(imageKeyFor("abc", "image/gif")).toBeNull()
    expect(imageKeyFor("../x", "image/png")).toBeNull()
  })
})

describe("classifyAudioUrl", () => {
  it("R2 actual → r2-ok", () => {
    expect(classifyAudioUrl(`${R2}/audios/temp/f.mp3`, R2)).toEqual({
      kind: "r2-ok",
      key: "audios/temp/f.mp3",
    })
  })

  it("Supabase pública y firmada → supabase-migrate", () => {
    expect(
      classifyAudioUrl(
        "https://xyz.supabase.co/storage/v1/object/public/audios/temp/f.mp3",
        R2
      )
    ).toEqual({ kind: "supabase-migrate", key: "audios/temp/f.mp3" })
    expect(
      classifyAudioUrl(
        "https://xyz.supabase.co/storage/v1/object/sign/audios/temp/f.mp3?token=t",
        R2
      )
    ).toEqual({ kind: "supabase-migrate", key: "audios/temp/f.mp3" })
  })

  it("Supabase fuera del bucket audios → unresolvable", () => {
    expect(
      classifyAudioUrl("https://xyz.supabase.co/storage/v1/object/public/otros/f.mp3", R2)
    ).toEqual({ kind: "unresolvable", key: null })
  })

  it("relativas, externas y vacías → unresolvable", () => {
    expect(classifyAudioUrl("temp/f.mp3", R2)).toEqual({ kind: "unresolvable", key: null })
    expect(classifyAudioUrl("https://evil.com/a.mp3", R2)).toEqual({
      kind: "unresolvable",
      key: null,
    })
    expect(classifyAudioUrl(null, R2)).toEqual({ kind: "unresolvable", key: null })
    expect(classifyAudioUrl("", R2)).toEqual({ kind: "unresolvable", key: null })
  })
})
