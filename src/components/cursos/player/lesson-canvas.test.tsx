import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LessonCanvas } from "./lesson-canvas"
import type { PlayerLesson } from "./types"

const EMPTY_CONTENT = { version: 2, blocks: [] }

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
    expect(screen.getByText("Se guarda solo en este navegador")).toBeDefined()
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
    expect(banner.textContent).toContain("Completá el Módulo 1")
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
})
