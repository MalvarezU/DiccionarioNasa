import { describe, it, expect } from "vitest"
import {
  parseLessonContent,
  isInteractive,
  isSafeMediaUrl,
  createBlock,
  BLOCK_TYPES,
  LIMITS,
  extraerYoutubeId,
  type LessonBlock,
} from "./blocks"

const doc = (blocks: unknown[]) => ({ version: 2, blocks })

const textoValido: LessonBlock = { id: "b1", type: "text", html: "Hola" }
const imagenValida: LessonBlock = {
  id: "b2",
  type: "image",
  url: "https://x.supabase.co/storage/v1/object/public/images/a.png",
  alt: "Una foto",
}
const quizValido: LessonBlock = {
  id: "b3",
  type: "quiz",
  passScore: 70,
  questions: [
    {
      prompt: "¿Cómo se dice agua?",
      options: [
        { text: "yu", correct: true },
        { text: "kwe", correct: false },
      ],
    },
  ],
}

describe("parseLessonContent — acepta lo válido", () => {
  it("un documento mínimo", () => {
    const r = parseLessonContent(doc([textoValido]))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.content.blocks).toHaveLength(1)
  })

  it("un documento vacío (lección sin contenido)", () => {
    const r = parseLessonContent(doc([]))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.content.blocks).toEqual([])
  })

  it("todos los tipos de bloque", () => {
    const blocks: LessonBlock[] = [
      textoValido,
      imagenValida,
      { id: "b4", type: "audio", media: { source: "upload", url: "https://x/a.mp3" } },
      { id: "b6", type: "video", youtubeId: "dQw4w9WgXcQ", title: "Saludo" },
      { id: "b7", type: "word", wordId: "w1" },
      { id: "b8", type: "vocabulary", wordIds: ["w1", "w2"] },
      quizValido,
      {
        id: "b9",
        type: "listening",
        media: { source: "upload", url: "https://x/a.mp3" },
        question: "¿Qué palabra escuchaste?",
        options: [
          { text: "yu", correct: true },
          { text: "kwe", correct: false },
        ],
      },
    ]
    const r = parseLessonContent(doc(blocks))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.content.blocks).toHaveLength(blocks.length)
  })

  it("normaliza: recorta espacios y completa los valores por defecto", () => {
    const r = parseLessonContent(
      doc([
        { id: "b1", type: "text", html: "  Hola  " },
        {
          id: "b3",
          type: "quiz",
          questions: [
            {
              prompt: "  ¿Agua?  ",
              options: [
                { text: "  yu  ", correct: true },
                { text: "kwe", correct: false },
              ],
            },
          ],
        },
      ])
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [t, q] = r.content.blocks
    expect(t).toMatchObject({ html: "Hola" })
    expect(q).toMatchObject({ passScore: 70 })
    if (q?.type === "quiz") expect(q.questions[0]!.prompt).toBe("¿Agua?")
  })
})

describe("parseLessonContent — rechaza lo inválido", () => {
  const casos: Array<[string, unknown]> = [
    ["no es objeto", "hola"],
    ["es un array", []],
    ["blocks no es lista", { version: 2, blocks: "x" }],
    ["bloque sin tipo", doc([{ id: "b1" }])],
    ["tipo desconocido", doc([{ id: "b1", type: "hack" }])],
    ["bloque no objeto", doc(["x"])],
    ["id vacío", doc([{ id: "", type: "text", html: "a" }])],
    ["id con caracteres raros", doc([{ id: "a/b", type: "text", html: "a" }])],
    ["ids repetidos", doc([textoValido, { ...textoValido }])],
    ["versión no soportada", { version: 99, blocks: [textoValido] }],
    ["texto vacío", doc([{ id: "b1", type: "text", html: "   " }])],
    ["text sin campo html", doc([{ id: "b1", type: "text" }])],
    ["versión 1 rechazada (legacy markdown)", { version: 1, blocks: [textoValido] }],
    ["html demasiado largo", doc([{ id: "b1", type: "text", html: "x".repeat(LIMITS.maxHtml + 1) }])],
    ["texto demasiado largo", doc([{ id: "b1", type: "text", html: "x".repeat(LIMITS.maxHtml + 1) }])],
    ["imagen sin alt", doc([{ id: "b1", type: "image", url: "https://x/a.png" }])],
    ["demasiados bloques", doc(Array.from({ length: LIMITS.maxBlocks + 1 }, (_, i) => ({ id: `b${i}`, type: "text", html: "a" })))],
    ["word sin wordId", doc([{ id: "b1", type: "word" }])],
    ["vocabulario vacío", doc([{ id: "b1", type: "vocabulary", wordIds: [] }])],
    ["vocabulario repetido", doc([{ id: "b1", type: "vocabulary", wordIds: ["w1", "w1"] }])],
    ["media sin source", doc([{ id: "b1", type: "audio", media: { url: "https://x/a.mp3" } }])],
    ["media source inválido", doc([{ id: "b1", type: "audio", media: { source: "ftp", url: "https://x/a" } }])],
    ["quiz sin preguntas", doc([{ id: "b1", type: "quiz", questions: [] }])],
    ["quiz con una sola opción", doc([{ id: "b1", type: "quiz", questions: [{ prompt: "p", options: [{ text: "a", correct: true }] }] }])],
    ["quiz con 7 opciones", doc([{ id: "b1", type: "quiz", questions: [{ prompt: "p", options: Array.from({ length: 7 }, (_, i) => ({ text: `o${i}`, correct: i === 0 })) }] }])],
    ["quiz sin ninguna correcta", doc([{ id: "b1", type: "quiz", questions: [{ prompt: "p", options: [{ text: "a", correct: false }, { text: "b", correct: false }] }] }])],
    ["quiz con dos correctas", doc([{ id: "b1", type: "quiz", questions: [{ prompt: "p", options: [{ text: "a", correct: true }, { text: "b", correct: true }] }] }])],
    ["quiz passScore fuera de rango", doc([{ id: "b1", type: "quiz", passScore: 150, questions: quizValido.type === "quiz" ? quizValido.questions : [] }])],
    ["escucha sin opciones", doc([{ id: "b1", type: "listening", media: { source: "upload", url: "https://x/a.mp3" }, question: "q" }])],
    ["audio de YouTube queda rechazado (solo archivo subido)", doc([{ id: "b1", type: "audio", media: { source: "youtube", youtubeId: "dQw4w9WgXcQ" } }])],
    ["video sin título", doc([{ id: "b1", type: "video", youtubeId: "dQw4w9WgXcQ" }])],
  ]

  it.each(casos)("rechaza: %s", (_nombre, entrada) => {
    const r = parseLessonContent(entrada)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
  })

  it("acumula varios errores con la ruta de cada uno", () => {
    const r = parseLessonContent(
      doc([
        { id: "b1", type: "text", html: "  " },
        { id: "b2", type: "image", url: "https://x/a.png" },
      ])
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith("blocks[0].html"))).toBe(true)
      expect(r.errors.some((e) => e.startsWith("blocks[1].alt"))).toBe(true)
    }
  })
})

describe("seguridad de URLs — corta vectores de XSS", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "//evil.example.com/a.png",
    "https://x/a b.png",
  ])("rechaza %s", (url) => {
    expect(isSafeMediaUrl(url)).toBe(false)
  })

  it.each([
    "https://x.supabase.co/storage/v1/object/public/images/a.png",
    "/ybc.jpg",
  ])("acepta %s", (url) => {
    expect(isSafeMediaUrl(url)).toBe(true)
  })

  it("el validador aplica la regla a los bloques de imagen", () => {
    for (const url of ["javascript:alert(1)", "data:image/png;base64,AAA", "//evil.com/a.png"]) {
      const r = parseLessonContent(doc([{ id: "b1", type: "image", url, alt: "x" }]))
      expect(r.ok, `debería rechazar ${url}`).toBe(false)
    }
  })
})

describe("isInteractive", () => {
  it("marca los bloques que exigen acción del estudiante", () => {
    expect(isInteractive({ id: "b1", type: "text", html: "a" })).toBe(false)
    expect(isInteractive({ id: "b2", type: "image", url: "/a.png", alt: "a" })).toBe(false)
    expect(isInteractive({ id: "b3", type: "vocabulary", wordIds: ["w1"] })).toBe(false)
    expect(isInteractive(quizValido)).toBe(true)
  })
})

describe("juegos fuera de lecciones (guardas)", () => {
  it("BLOCK_TYPES ya no incluye game", () => {
    expect(BLOCK_TYPES as readonly string[]).not.toContain("game")
  })

  it("createBlock no tiene rama para game", () => {
    expect(createBlock("game" as never)).toBeUndefined()
  })

  it("un bloque type game se rechaza al parsear", () => {
    const r = parseLessonContent(doc([{ id: "b1", type: "game", game: "memory", wordIds: ["w1"] }]))
    expect(r.ok).toBe(false)
  })

  it("isInteractive no incluye game", () => {
    expect(isInteractive({ id: "b1", type: "text", html: "a" })).toBe(false)
  })
})

describe("createBlock", () => {
  it("devuelve el tipo pedido para todos los tipos", () => {
    for (const type of BLOCK_TYPES) {
      const b = createBlock(type)
      expect(b.type, `createBlock("${type}")`).toBe(type)
      expect(b.id.length).toBeGreaterThan(0)
    }
  })

  it("genera ids únicos", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createBlock("text").id))
    expect(ids.size).toBe(200)
  })

  it("sus ids son aceptados por el validador", () => {
    // El editor depende de esto: si el id de fábrica no validara, no se
    // podría guardar ningún bloque nuevo.
    for (const type of BLOCK_TYPES) {
      const b = createBlock(type)
      const r = parseLessonContent(doc([{ ...b, __soloId: true }]))
      // Falla por campos vacíos, pero NUNCA por el id.
      if (!r.ok) {
        expect(r.errors.some((e) => e.includes(".id:")), `id de ${type} rechazado`).toBe(false)
      }
    }
  })
})

describe("extraerYoutubeId", () => {
  it("devuelve el ID pelado tal cual", () => {
    expect(extraerYoutubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extrae de watch, youtu.be, shorts y embed", () => {
    expect(extraerYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(extraerYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ")
    expect(extraerYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(extraerYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(extraerYoutubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("tolera espacios y devuelve el texto si no hay ID", () => {
    expect(extraerYoutubeId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ")
    expect(extraerYoutubeId("no-es-youtube")).toBe("no-es-youtube")
  })
})
