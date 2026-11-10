import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LessonCanvas } from "./lesson-canvas"
import type { PlayerLesson } from "./types"

const EMPTY_CONTENT = { version: 2, blocks: [] }

const QUIZ_CONTENT = {
  version: 2,
  blocks: [
    {
      id: "q1",
      type: "quiz",
      passScore: 50,
      questions: [
        {
          prompt: "¿Cómo se saluda?",
          options: [
            { text: "¡Bien!", correct: true },
            { text: "Mal", correct: false },
          ],
        },
      ],
    },
  ],
} as const

const AUDIO_CONTENT = {
  version: 2,
  blocks: [
    { id: "a1", type: "audio", media: { source: "upload", url: "/audio/hola.mp3" }, title: "Escuchá" },
  ],
} as const

function lesson(overrides: Partial<PlayerLesson> = {}): PlayerLesson {
  return {
    id: "l11",
    title: "Hola",
    lessonNumber: 1,
    content: EMPTY_CONTENT,
    ...overrides,
  }
}

function props(overrides: Partial<Parameters<typeof LessonCanvas>[0]> = {}) {
  return {
    lesson: lesson(),
    moduleTitle: "Saludos",
    moduleIndex: 1,
    words: new Map(),
    prev: null as Parameters<typeof LessonCanvas>[0]["prev"],
    next: {
      id: "l12",
      title: "Adiós",
      number: 2,
      moduleIndex: 1,
      locked: false,
    } as Parameters<typeof LessonCanvas>[0]["next"],
    completed: false,
    locked: false,
    requiredLesson: null as Parameters<typeof LessonCanvas>[0]["requiredLesson"],
    anonymous: false,
    onRequireAuth: vi.fn(),
    onComplete: vi.fn(),
    onNavigate: vi.fn(),
    onGoRequired: vi.fn(),
    ...overrides,
  }
}

describe("LessonCanvas", () => {
  it("header: número serif + título + breadcrumb + badge En curso", () => {
    render(<LessonCanvas {...props()} />)
    expect(screen.getByText("Módulo 1 · Saludos")).toBeDefined()
    expect(screen.getByRole("heading", { level: 2, name: "Hola" })).toBeDefined()
    expect(screen.getByText("1.1")).toBeDefined()
    expect(screen.getByText("En curso")).toBeDefined()
  })

  it("badge Completada y badge anónimo cuando corresponde", () => {
    render(<LessonCanvas {...props({ completed: true, anonymous: true })} />)
    expect(screen.getByText("Completada")).toBeDefined()
    expect(screen.getByText("Inicia sesión para guardar tu avance")).toBeDefined()
  })

  it("delega el completar al child: lección sin interactivos ofrece marcar completa", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<LessonCanvas {...props({ onComplete })} />)
    await user.click(screen.getByRole("button", { name: /Marcar como completada/ }))
    expect(onComplete).toHaveBeenCalledWith("l11", null)
  })

  it("foco al h2 al cambiar de lección", () => {
    const { rerender } = render(<LessonCanvas {...props()} />)
    const first = screen.getByRole("heading", { level: 2, name: "Hola" })
    expect(first).not.toHaveFocus()
    rerender(
      <LessonCanvas
        {...props({ lesson: lesson({ id: "l12", title: "Adiós", lessonNumber: 2 }) })}
      />
    )
    expect(screen.getByRole("heading", { level: 2, name: "Adiós" })).toHaveFocus()
  })

  it("footer: prev ausente deja espacio, next navega", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<LessonCanvas {...props({ onNavigate })} />)
    const next = screen.getByRole("button", { name: /Adiós/ })
    expect(next).toBeEnabled()
    await user.click(next)
    expect(onNavigate).toHaveBeenCalledWith("l12")
  })

  it("footer: vecino bloqueado va disabled nativo", () => {
    render(
      <LessonCanvas
        {...props({
          next: { id: "l21", title: "Madre", number: 1, moduleIndex: 2, locked: true },
        })}
      />
    )
    expect(screen.getByRole("button", { name: /Madre/ })).toBeDisabled()
  })

  it("bloqueada: banner con CTA a la requerida y sin contenido", async () => {
    const user = userEvent.setup()
    const onGoRequired = vi.fn()
    render(
      <LessonCanvas
        {...props({
          moduleIndex: 2,
          locked: true,
          requiredLesson: { id: "l12", title: "Adiós", number: 2 },
          onGoRequired,
        })}
      />
    )
    const banner = screen.getByRole("status")
    expect(banner.textContent).toContain("Completa el Módulo 1")
    await user.click(screen.getByRole("button", { name: /Ir a la lección requerida/ }))
    expect(onGoRequired).toHaveBeenCalledWith("l12")
    // El contenido no se monta en estado bloqueado
    expect(screen.queryByRole("button", { name: /Marcar como completada/ })).toBeNull()
  })

  it("lessonNumber null (legacy): título sin número, sin 'null' visible", () => {
    const { container } = render(
      <LessonCanvas {...props({ lesson: lesson({ lessonNumber: null }) })} />
    )
    expect(screen.getByRole("heading", { level: 2, name: "Hola" })).toBeDefined()
    expect(container.textContent).not.toMatch(/null/)
    // Sin badge numérico serif: el h2 es el único titular
    expect(container.querySelector(".font-serif.text-xl")).toBeNull()
  })

  it("bloques audio/video sin fuente no dejan img/audio/iframe rotos", () => {
    const { container } = render(
      <LessonCanvas
        {...props({
          lesson: lesson({
            content: {
              version: 2,
              blocks: [
                { id: "b-a", type: "audio", media: { source: "upload" } },
                { id: "b-v", type: "video", youtubeId: "", title: "Clase" },
                { id: "b-i", type: "image", url: "", alt: "Foto" },
              ],
            },
          }),
        })}
      />
    )
    expect(container.querySelector("audio")).toBeNull()
    expect(container.querySelector("iframe")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
    // Sin errores de consola por src vacío
    expect(container.querySelector('[src=""]')).toBeNull()
  })

  it("título larguísimo sin espacios: wrap en 2 líneas, sin overflow", () => {
    const longTitle = "nasa".repeat(50)
    const { container } = render(
      <LessonCanvas {...props({ lesson: lesson({ title: longTitle }) })} />
    )
    const h2 = screen.getByRole("heading", { level: 2 })
    expect(h2.className).toMatch(/line-clamp-2/)
    expect(h2.textContent).toBe(longTitle)
    expect(container.textContent).not.toMatch(/null/)
  })

  // ------------------------------------------------ H1: gate anónimo ---
  describe("gate de sesión (H1) — captura antes de los handlers del child", () => {
    it("anónimo: click en radio del quiz se captura — no marca y pide sesión", async () => {
      const user = userEvent.setup()
      const onRequireAuth = vi.fn()
      const onComplete = vi.fn()
      render(
        <LessonCanvas
          {...props({
            anonymous: true,
            onRequireAuth,
            onComplete,
            lesson: lesson({ content: QUIZ_CONTENT }),
          })}
        />
      )
      const radio = screen.getByRole("radio", { name: /Opción 1 de la pregunta 1/ })
      await user.click(radio)
      // El click no llegó al onClick del radio: sigue sin elegir
      expect(radio).toHaveAttribute("aria-checked", "false")
      expect(screen.queryByRole("button", { name: "Revisar" })).toBeDisabled()
      expect(onComplete).not.toHaveBeenCalled()
      expect(onRequireAuth).toHaveBeenCalledTimes(1)
    })

    it("anónimo: 'Revisar' sigue deshabilitado — la respuesta interceptada no registrió", async () => {
      const user = userEvent.setup()
      const onRequireAuth = vi.fn()
      const onComplete = vi.fn()
      render(
        <LessonCanvas
          {...props({
            anonymous: true,
            onRequireAuth,
            onComplete,
            lesson: lesson({ content: QUIZ_CONTENT }),
          })}
        />
      )
      const revisar = screen.getByRole("button", { name: "Revisar" })
      expect(revisar).toBeDisabled()
      // Sin respuesta registrada no hay estado de revisión posible (la
      // elección fue capturada por el gate) y el bloque queda como pregunta.
      revisar.focus()
      await user.keyboard("{Enter}")
      expect(screen.queryByText(/Aprobaste con/)).toBeNull()
      expect(onComplete).not.toHaveBeenCalled()
      expect(screen.getByRole("radio", { name: /Opción 1/ })).toBeEnabled()
    })

    it("anónimo: 'Marcar como completada' se captura — no completa y pide sesión", async () => {
      const user = userEvent.setup()
      const onRequireAuth = vi.fn()
      const onComplete = vi.fn()
      render(
        <LessonCanvas
          {...props({ anonymous: true, onRequireAuth, onComplete })}
        />
      )
      await user.click(screen.getByRole("button", { name: /Marcar como completada/ }))
      expect(onComplete).not.toHaveBeenCalled()
      expect(onRequireAuth).toHaveBeenCalledTimes(1)
    })

    it("anónimo: el audio nativo no se captura (contenido pasivo)", async () => {
      const user = userEvent.setup()
      const onRequireAuth = vi.fn()
      const { container } = render(
        <LessonCanvas
          {...props({
            anonymous: true,
            onRequireAuth,
            lesson: lesson({ content: AUDIO_CONTENT }),
          })}
        />
      )
      const audio = container.querySelector("audio")
      expect(audio).not.toBeNull()
      expect(audio).toHaveAttribute("src", "/audio/hola.mp3")
      // Click sobre el reproductor: no es un <button>, el gate no interviene
      await user.click(audio!)
      expect(onRequireAuth).not.toHaveBeenCalled()
    })

    it("autenticado: cero capturas — radio se marca y el quiz aprueba", async () => {
      const user = userEvent.setup()
      const onRequireAuth = vi.fn()
      const onComplete = vi.fn()
      render(
        <LessonCanvas
          {...props({
            anonymous: false,
            onRequireAuth,
            onComplete,
            lesson: lesson({ content: QUIZ_CONTENT }),
          })}
        />
      )
      const radio = screen.getByRole("radio", { name: /Opción 1 de la pregunta 1/ })
      await user.click(radio)
      expect(radio).toHaveAttribute("aria-checked", "true")
      expect(onRequireAuth).not.toHaveBeenCalled()
      await user.click(screen.getByRole("button", { name: "Revisar" }))
      expect(screen.getByText(/Aprobaste con 100%/)).toBeDefined()
      expect(onComplete).toHaveBeenCalledWith("l11", 100)
    })

    it("anónimo módulo 2+: banner de sesión con CTA al modal (no banner secuencial)", async () => {
      const user = userEvent.setup()
      const onRequireAuth = vi.fn()
      render(
        <LessonCanvas
          {...props({
            anonymous: true,
            moduleIndex: 2,
            locked: true,
            requiredLesson: { id: "l12", title: "Adiós", number: 2 },
            onRequireAuth,
          })}
        />
      )
      const banner = screen.getByRole("status")
      expect(banner.textContent).toContain("requiere sesión")
      expect(banner.textContent).toContain("módulo 2")
      expect(banner.textContent).not.toContain("Completa el Módulo")
      // Sin CTA de secuencial: para anónimo no hay lección requerida a la que ir
      expect(screen.queryByRole("button", { name: /Ir a la lección requerida/ })).toBeNull()
      await user.click(screen.getByRole("button", { name: "Iniciar sesión" }))
      expect(onRequireAuth).toHaveBeenCalledTimes(1)
    })

    it("autenticado módulo 2 bloqueada por secuencial: CTA requerida intacta (regresión)", () => {
      render(
        <LessonCanvas
          {...props({
            moduleIndex: 2,
            locked: true,
            requiredLesson: { id: "l12", title: "Adiós", number: 2 },
          })}
        />
      )
      expect(screen.getByRole("status").textContent).toContain("Completa el Módulo 1")
      expect(screen.queryByRole("button", { name: "Iniciar sesión" })).toBeNull()
    })
  })
})
