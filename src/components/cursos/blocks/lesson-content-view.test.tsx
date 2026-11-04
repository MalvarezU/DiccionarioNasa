import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

  it("lección vacía en modo estudiante ofrece completar a mano", async () => {
    const user = userEvent.setup()
    const onCompleta = vi.fn()
    render(
      <LessonContentView content={contenido([])} words={new Map()} onCompleta={onCompleta} />
    )
    expect(screen.getByText(/no tiene contenido/i)).toBeDefined()
    await user.click(screen.getByRole("button", { name: /Marcar como completada/i }))
    expect(onCompleta).toHaveBeenCalledWith(null)
  })

  it("lección vacía en vista previa (admin) no ofrece acción", () => {
    const onCompleta = vi.fn()
    render(
      <LessonContentView
        content={contenido([])}
        words={new Map()}
        interactive={false}
        onCompleta={onCompleta}
      />
    )
    expect(screen.getByText(/no tiene contenido/i)).toBeDefined()
    expect(screen.queryByRole("button", { name: /Marcar como completada/i })).toBeNull()
  })
})

describe("bloque text — HTML sanitizado", () => {
  it("renderiza título, párrafos, lista, negrita y cursiva", () => {
    render(
      <LessonContentView
        content={contenido([
          {
            id: "b1",
            type: "text",
            html: "<h2>Título</h2><p>Párrafo con <strong>negrita</strong> y <em>cursiva</em>.</p><ul><li>uno</li><li>dos</li></ul>",
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

  it("html vacío no renderiza nada", () => {
    const { container } = render(
      <LessonContentView content={contenido([{ id: "b1", type: "text", html: "" }])} words={new Map()} />
    )
    // el bloque de texto con html vacío no deja ningún elemento
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

describe("bloque text — marcas combinadas", () => {
  it("negrita+cursiva (***) renderiza em dentro de strong", () => {
    render(
      <LessonContentView
        content={contenido([{ id: "b1", type: "text", html: "Hola <strong><em>yuwe</em></strong> mundo" }])}
        words={new Map()}
      />
    )
    const elemento = screen.getByText("yuwe") as HTMLElement
    expect(elemento.closest("strong")).toBeTruthy()
    expect(elemento.closest("em")).toBeTruthy()
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

  it("audio con fuente legacy de YouTube avisa en vez de embeber", () => {
    // YouTube quedó exclusivo del bloque video: un audio viejo con youtubeId
    // ya no renderiza iframe, muestra el aviso de falta de fuente.
    render(
      <LessonContentView
        content={contenido([
          { id: "b1", type: "audio", media: { source: "youtube", youtubeId: "dQw4w9WgXcQ" } },
        ])}
        words={new Map()}
      />
    )
    expect(screen.queryByTitle("Audio de la lección")).toBeNull()
    expect(screen.getByText(/aún no tiene fuente/i)).toBeDefined()
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

  it("imagen sin url avisa y no renderiza <img> con src vacío", () => {
    // Un <img src=""> hace que el browser re-descargue la página; el bloque
    // incompleto (recién creado) debe generar aviso, no elemento roto.
    render(
      <LessonContentView
        content={contenido([{ id: "b1", type: "image", url: "", alt: "algo" }])}
        words={new Map()}
      />
    )
    expect(screen.getByText(/no tiene fuente/i)).toBeDefined()
    expect(document.querySelector("img")).toBeNull()
  })

  it("video sin youtubeId avisa y no renderiza iframe con src vacío", () => {
    render(
      <LessonContentView
        content={contenido([{ id: "b1", type: "video", youtubeId: "", title: "Clase" }])}
        words={new Map()}
      />
    )
    expect(screen.getByText(/no tiene fuente/i)).toBeDefined()
    expect(document.querySelector("iframe")).toBeNull()
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

  it("quiz muestra cantidad y puntaje de aprobación (vista previa)", () => {
    render(<LessonContentView content={contenido([quiz])} words={new Map()} interactive={false} />)
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

  it("listening muestra su panel (vista previa)", () => {
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
        ])}
        words={new Map()}
        interactive={false}
      />
    )
    expect(screen.getByText(/Ejercicio de escucha/)).toBeDefined()
    expect(screen.getByText(/Ejercicio de escucha/)).toBeDefined()
  })
})

describe("modo estudiante — los interactivos son jugables", () => {
  const quiz = {
    id: "b1",
    type: "quiz",
    passScore: 80,
    questions: [
      { prompt: "¿Cómo se dice agua?", options: [{ text: "yu", correct: true }, { text: "kwe", correct: false }] },
      { prompt: "¿Y sol?", options: [{ text: "sok", correct: true }, { text: "pa", correct: false }] },
    ],
  }

  it("responder bien y revisar aprueba y notifica a la lección", async () => {
    const user = userEvent.setup()
    const onCompleta = vi.fn()
    render(
      <LessonContentView content={contenido([quiz])} words={new Map()} onCompleta={onCompleta} />
    )

    await user.click(screen.getByLabelText("Opción 1 de la pregunta 1")) // yu (correcta)
    await user.click(screen.getByLabelText("Opción 1 de la pregunta 2")) // sok (correcta)
    await user.click(screen.getByRole("button", { name: "Revisar" }))

    expect(screen.getByText(/Aprobaste con 100%/)).toBeDefined()
    await waitFor(() => expect(onCompleta).toHaveBeenCalledWith(100))
  })

  it("fallar muestra el puntaje y permite reintentar; no notifica", async () => {
    const user = userEvent.setup()
    const onCompleta = vi.fn()
    render(
      <LessonContentView content={contenido([quiz])} words={new Map()} onCompleta={onCompleta} />
    )

    await user.click(screen.getByLabelText("Opción 2 de la pregunta 1")) // kwe (incorrecta)
    await user.click(screen.getByLabelText("Opción 1 de la pregunta 2")) // sok (correcta)
    await user.click(screen.getByRole("button", { name: "Revisar" }))

    expect(screen.getByText(/50%/)).toBeDefined()
    expect(onCompleta).not.toHaveBeenCalled()

    // Reintentar limpia las respuestas
    await user.click(screen.getByRole("button", { name: /Reintentar/ }))
    expect(screen.getByRole("button", { name: "Revisar" }).hasAttribute("disabled")).toBe(true)
  })

  it("no se puede revisar hasta responder todo", async () => {
    const user = userEvent.setup()
    render(
      <LessonContentView content={contenido([quiz])} words={new Map()} />
    )
    await user.click(screen.getByLabelText("Opción 1 de la pregunta 1"))
    expect(screen.getByRole("button", { name: "Revisar" }).hasAttribute("disabled")).toBe(true)
  })

  it("lección sin actividad muestra el botón manual y notifica", async () => {
    const user = userEvent.setup()
    const onCompleta = vi.fn()
    render(
      <LessonContentView
        content={contenido([{ id: "b9", type: "text", html: "Solo lectura" }])}
        words={new Map()}
        onCompleta={onCompleta}
      />
    )
    await user.click(screen.getByRole("button", { name: /Marcar como completada/i }))
    expect(onCompleta).toHaveBeenCalledWith(null)
  })
})
