import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  collectMediaRefs,
  publicUrlToKey,
  refsToKeys,
  missingMediaKeys,
} from "./full-bundle"

const CDN = "https://cdn.test"
const OLD_BASE = process.env.R2_PUBLIC_BASE_URL

beforeEach(() => {
  process.env.R2_PUBLIC_BASE_URL = CDN
})

afterEach(() => {
  if (OLD_BASE === undefined) delete process.env.R2_PUBLIC_BASE_URL
  else process.env.R2_PUBLIC_BASE_URL = OLD_BASE
})

function blocks(...bs: Array<Record<string, unknown>>) {
  // Fixtures con forma runtime (incluyen bloques inválidos a propósito para
  // fijar el alcance del parser); el cast es intencional en tests.
  return bs as unknown as import("@/lib/courses/blocks").LessonBlock[]
}

describe("full-bundle [Fase B W3c]", () => {
  describe("publicUrlToKey", () => {
    it("URL bajo la base → clave (corta query string)", () => {
      expect(publicUrlToKey(`${CDN}/audios/w1/clip.mp3`)).toBe("audios/w1/clip.mp3")
      expect(publicUrlToKey(`${CDN}/images/x.png?v=2`)).toBe("images/x.png")
    })

    it("fuera de la base o insegura → null", () => {
      expect(publicUrlToKey("https://otra.cdn/audios/x.mp3")).toBeNull()
      expect(publicUrlToKey(`${CDN}/../etc/passwd`)).toBeNull()
      expect(publicUrlToKey("/api/media/abc123")).toBeNull()
    })

    it("base ausente → null (nunca lanza)", () => {
      delete process.env.R2_PUBLIC_BASE_URL
      expect(publicUrlToKey(`${CDN}/audios/x.mp3`)).toBeNull()
    })
  })

  describe("collectMediaRefs", () => {
    it("junta words + coverImage R2 + bloques image/audio/listening", () => {
      const refs = collectMediaRefs({
        words: [
          { audioUrl: `${CDN}/audios/w1.mp3`, illustrationUrl: `${CDN}/images/w1.png` },
          { audioUrl: null, illustrationUrl: null },
        ],
        courses: [{ coverImage: `${CDN}/images/cover.png` }],
        lessonBlocks: [
          blocks(
            { type: "image", url: `${CDN}/images/b1.png` },
            { type: "audio", media: { source: "upload", url: `${CDN}/audios/b2.mp3` } },
            { type: "listening", media: { source: "upload", url: `${CDN}/audios/b3.mp3` } },
          ),
        ],
      })
      expect(refs).toEqual([
        `${CDN}/audios/w1.mp3`,
        `${CDN}/images/w1.png`,
        `${CDN}/images/cover.png`,
        `${CDN}/images/b1.png`,
        `${CDN}/audios/b2.mp3`,
        `${CDN}/audios/b3.mp3`,
      ])
    })

    it("alcance del parser (§3.6.6): video.youtubeId y text.html no aportan refs", () => {
      const refs = collectMediaRefs({
        words: [],
        courses: [],
        lessonBlocks: [
          blocks(
            { type: "video", youtubeId: "dQw4w9WgXcQ" },
            { type: "text", html: '<p>Hola</p><img src="https://cdn.test/images/trampa.png">' },
            { type: "word", wordId: "w1" },
            { type: "vocabulary", wordIds: ["w1", "w2"] },
          ),
        ],
      })
      // video es YouTube (no R2), word/vocabulary no aportan medios, y el
      // <img> embebido en text.html NO se extrae: el sanitizador elimina
      // <img> antes de guardar, así que el HTML persistido nunca trae medios.
      expect(refs).toEqual([])
    })

    it("coverImage externa o legacy /api/media/<id> → excluida (E8)", () => {
      const refs = collectMediaRefs({
        words: [],
        courses: [
          { coverImage: "https://externa.com/portada.png" },
          { coverImage: "/api/media/abc123" },
          { coverImage: null },
        ],
        lessonBlocks: [[]],
      })
      expect(refs).toEqual([])
    })
  })

  describe("refsToKeys", () => {
    it("deduplica y deriva claves R2", () => {
      const keys = refsToKeys([
        `${CDN}/audios/w1.mp3`,
        `${CDN}/audios/w1.mp3`,
        `${CDN}/images/w1.png`,
      ])
      expect(keys).toEqual(["audios/w1.mp3", "images/w1.png"])
    })

    it("audio legacy Supabase y clave relativa se resuelven vía audioRefToKey", () => {
      const keys = refsToKeys([
        "https://xyz.supabase.co/storage/v1/object/public/audios/w1/clip.mp3",
        "audios/w2/clip.mp3",
      ])
      expect(keys).toEqual(["audios/w1/clip.mp3", "audios/w2/clip.mp3"])
    })

    it("imagen fuera de la base → excluida (sin derivación inventada)", () => {
      // Una clave relativa de imagen NO puede prefijarse como audio: evita
      // fabricar `audios/images/...` inexistentes.
      expect(refsToKeys(["images/huerfana.png"])).toEqual([])
      expect(refsToKeys(["https://externa.com/x.png"])).toEqual([])
      expect(refsToKeys(["/api/media/abc123"])).toEqual([])
    })
  })

  describe("missingMediaKeys (test de coherencia R3(b))", () => {
    const referenced = ["audios/w1.mp3", "images/cover.png"]

    it("reporta referencias sin fila o con sha256 NULL", () => {
      const present = [{ objectKey: "audios/w1.mp3", sha256: "ab".repeat(32) }]
      expect(missingMediaKeys(referenced, present)).toEqual(["images/cover.png"])
      expect(missingMediaKeys(referenced, [])).toEqual(referenced)
    })

    it("en verde: cero excluidos", () => {
      const present = referenced.map((objectKey) => ({
        objectKey, sha256: "cd".repeat(32),
      }))
      expect(missingMediaKeys(referenced, present)).toEqual([])
    })
  })
})
