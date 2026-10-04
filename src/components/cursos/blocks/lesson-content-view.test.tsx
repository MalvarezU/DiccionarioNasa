import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LessonContentView } from "./lesson-content-view"
import type { LessonBlock } from "@/lib/courses/blocks"
import type { CourseWordData } from "@/lib/courses/word-data"

function words(entries: Array<[string, Partial<CourseWordData>]>): Map<string, CourseWordData> {
  return new Map(
    entries.map(([id, w]) => [
      id,
      {
        id,
        spanish: w.spanish ?? "agua",
        nasaYuwe: w.nasaYuwe ?? "yu",
        pronunciation: w.pronunciation ?? null,
        audioUrl: w.audioUrl ?? null,
        culturalContext: w.culturalContext ?? null,
        category: w.category ?? null,
      },
    ])
  )
}

function contenido(blocks: unknown[], version = 1) {
  return { version, blocks } as never
}

const PNG_URL = "https://x.supabase.co/storage/v1/object/public/images/a.png"

describe("LessonContentView — vista general", () => {
  it("sin contenido avisa y no explota", () => {
    render(<LessonContentView content={null} words={new Map()} />)
    expect(screen.getByText(/no tiene contenido/i)).toBeDefined()
  })

  it("con bloques vacíos muestra el mismo aviso", () => {
    render(<LessonContentView content={contenido([])} words={new Map()} />)
    expect(screen.getByText(/no tiene contenido/i)).toBeDefined()
  })
})

describe("bloque text — markdown restringido", () => {
  it("renderiza título, párrafos, lista, negrita y cursiva", () => {
    render(
      <LessonContentView
        content={contenido([
          {
            id: "b1",
            type: "text",
            markdown: "# Título\n\nPárrafo con **negrita** y *cursiva*.\n\n- uno\n- dos",
          },
        ])}
        words={new Map()}
      />
    )
    expect(screen.getByRole("heading", { level: 2, name: "Título" })).toBeDefined()
    // la negrita/cursiva son elementos reales, no HTML sin escapar
    expect(screen.getByRole("heading", { name: "Título" }).querySelector("strong")).toBeNull()
    expect(screen.getByText("negrita").tagName).toBe("STRONG")
    expect(screen.getByText("cursiva").tagName).toBe("EM")
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(items[0]!.textContent).toBe("uno")
  })

  it("markdown vacío no renderiza nada", () => {
    const { container } = render(
      <LessonContentView content={contenido([{ id: "b1", type: "text", markdown: "" }])} words={new Map()} />
    )
    // el bloque de texto con markdown vacío no deja ningún elemento
    expect(container.querySelector("[data-testid='lesson-content']")!.children).toHaveLength(0)
    expect(screen.queryByRole("heading")).toBeNull()
  })
})

describe("bloque image", () => {
  it("renderiza la imagen con su alt y la leyenda", () => {
    render(
      <LessonContentView
        content={contenido([
          { id: "b1", type: "image", url: PNG_URL, alt: "Casa tradicional", caption: "Piye" },
        ])}
        words={new Map()}
      />
    )
    expect(screen.getByAltText("Casa tradicional")).toBeDefined()
    expect(screen.getByText("Piye")).toBeDefined()
  })
})

describe("bloques de audio y video", () => {
  it("audio subido renderiza el reproductor", () => {
    render(
      <LessonContentView
        content={contenido([
          { id: "b1", type: "audio", media: { source: "upload", url: "https://x/narracion.mp3" }, title: "Narración" },
        ])}
        words={new Map()}
      />
    )
    const audio = screen.getByLabelText("Narración") as HTMLAudioElement
    expect(audio.src).toContain("narracion.mp3")
  })

  it("audio de YouTube renderiza embebido nocookie", () => {
    render(
      <LessonContentView
        content={contenido([
          { id: "b1", type: "audio", media: { source: "youtube", youtubeId: "dQw4w9WgXcQ" } },
        ])}
        words={new Map()}
      />
    )
    const iframe = screen.getByTitle("Audio de la lección") as HTMLIFrameElement
    expect(iframe.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ")
  })

  it("video de YouTube", () => {
    render(
      <LessonContentView
        content={contenido([{ id: "b1", type: "video", youtubeId: "dQw4w9WgXcQ", title: "Clase en video" }])}
        words={new Map()}
      />
    )
    const iframe = screen.getByTitle("Clase en video") as HTMLIFrameElement
    expect(iframe.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ")
  })

  it("audio sin fuente avisa en vez de quedar mudo", () => {
    render(
      <LessonContentView
        content={contenido([{ id: "b1", type: "audio", media: { source: "upload" } }])}
        words={new Map()}
      />
    )
    expect(screen.getByText(/aún no tiene fuente/i)).toBeDefined()
  })
})

describe("bloques de palabra y vocabulario", () => {
  it("word resuelve la palabra del mapa", () => {
    render(
      <LessonContentView
        content={contenido([{ id: "b1", type: "word", wordId: "w1" }])}
        words={words([["w1", { spanish: "agua", nasaYuwe: "yu" }]])}
      />
    )
    expect(screen.getByText("yu")).toBeDefined()
    expect(screen.getByText(/agua/)).toBeDefined()
  })

  it("word con palabra inexistente muestra fallback sin romper", () => {
    render(
      <LessonContentView
        content={contenido([{ id: "b1", type: "word", wordId: "borrada" }])}
        words={new Map()}
      />
    )
    expect(screen.getByText(/no está disponible/i)).toBeDefined()
  })

  it("vocabulary renderiza la lista completa", () => {
    render(
      <LessonContentView
        content={contenido([
          { id: "b1", type: "vocabulary", wordIds: ["w1", "w2"] },
        ])}
        words={words([
          ["w1", { spanish: "agua", nasaYuwe: "yu", audioUrl: "https://x/yu.mp3" }],
          ["w2", { spanish: "sol", nasaYuwe: "sok" }],
        ])}
      />
    )
    expect(screen.getByTestId("vocabulary-list").children).toHaveLength(2)
    expect(screen.getByText("yu")).toBeDefined()
    expect(screen.getByText("sok")).toBeDefined()
  })
})

describe("bloques interactivos en vista previa y estudiante", () => {
  const quiz = {
    id: "b1",
    type: "quiz",
    passScore: 80,
    questions: [
      { prompt: "¿Cómo se dice agua?", options: [{ text: "yu", correct: true }, { text: "kwe", correct: false }] },
      { prompt: "¿Y sol?", options: [{ text: "sok", correct: true }, { text: "pa", correct: false }] },
    ],
  }

  it("quiz muestra cantidad y puntaje de aprobación", () => {
    render(<LessonContentView content={contenido([quiz])} words={new Map()} />)
    expect(screen.getByText(/2 preguntas/)).toBeDefined()
    expect(screen.getByText(/80%/)).toBeDefined()
  })

  it("en modo vista previa lista las preguntas", () => {
    render(<LessonContentView content={contenido([quiz])} words={new Map()} interactive={false} />)
    expect(screen.getByText("¿Cómo se dice agua?")).toBeDefined()
    expect(screen.getByText("¿Y sol?")).toBeDefined()
  })

  it("en modo estudiante NO lista las preguntas (no se filtraría la resp)", () => {
    render(<LessonContentView content={contenido([quiz])} words={new Map()} interactive={true} />)
    expect(screen.queryByText("¿Cómo se dice agua?")).toBeNull()
  })

  it("listening y game muestran su panel", () => {
    render(
      <LessonContentView
        content={contenido([
          {
            id: "b2",
            type: "listening",
            media: { source: "upload", url: "https://x/a.mp3" },
            question: "¿Qué escuchaste?",
            options: [{ text: "yu", correct: true }, { text: "kwe", correct: false }],
          },
          { id: "b3", type: "game", game: "memory", wordIds: ["w1", "w2"], difficulty: "easy" },
        ])}
        words={new Map()}
      />
    )
    expect(screen.getByText(/Ejercicio de escucha/)).toBeDefined()
    expect(screen.getByText(/2 palabras/)).toBeDefined()
  })

  it("bloques legacy muestran su resumen", () => {
    render(
      <LessonContentView
        content={contenido([
          { id: "b4", type: "legacy-quiz-words", words: ["a", "b"] },
          { id: "b5", type: "legacy-complete-word", wordId: "w1" },
        ])}
        words={new Map()}
      />
    )
    expect(screen.getByText(/Quiz con palabras/)).toBeDefined()
    expect(screen.getByText(/completa la palabra/i)).toBeDefined()
  })
})
