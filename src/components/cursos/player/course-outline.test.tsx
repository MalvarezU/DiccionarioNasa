import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CourseOutline } from "./course-outline"
import type { PlayerCourse } from "./types"

const course: PlayerCourse = {
  id: "c1",
  title: "Nasa Yuwe básico",
  description: null,
  sequential: true,
  modules: [
    {
      id: "m1",
      title: "Saludos",
      lessons: [
        { id: "l11", title: "Hola", lessonNumber: 1, content: null },
        { id: "l12", title: "Adiós", lessonNumber: 2, content: null },
      ],
    },
    {
      id: "m2",
      title: "Familia",
      lessons: [{ id: "l21", title: "Madre", lessonNumber: 1, content: null }],
    },
  ],
}

function props(overrides: Partial<Parameters<typeof CourseOutline>[0]> = {}) {
  return {
    course,
    activeLessonId: "l11" as string | null,
    completedIds: new Set<string>(),
    lastVisitedLessonId: null as string | null,
    onSelect: vi.fn(),
    ...overrides,
  }
}

function lessonButton(name: string | RegExp): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement
}

describe("CourseOutline", () => {
  it("headers de módulo son labels estáticos: no focusables, con pill done/total", () => {
    render(<CourseOutline {...props()} />)
    const nav = screen.getByRole("navigation", { name: /Contenido de/ })
    // Los títulos de módulo son headings, no botones
    const heading = within(nav).getByRole("heading", { name: /Saludos/ })
    expect(heading.tagName).toBe("H3")
    expect(heading.textContent).toContain("1 ·")
    // Pill tabular del módulo
    expect(within(nav).getByText("0/2")).toBeDefined()
    expect(within(nav).getByText("0/1")).toBeDefined()
    // Ningún header es un tab stop
    for (const h of within(nav).getAllByRole("heading")) {
      expect(h.hasAttribute("tabindex")).toBe(false)
    }
  })

  it("lista todas las lecciones siempre expandidas (sin acordeón)", () => {
    render(<CourseOutline {...props()} />)
    expect(lessonButton(/Hola/)).toBeDefined()
    expect(lessonButton(/Adiós/)).toBeDefined()
    expect(lessonButton(/Madre/)).toBeDefined()
  })

  it("estados done/current/locked con data-lesson-state y aria-current", () => {
    render(
      <CourseOutline
        {...props({
          activeLessonId: "l12",
          completedIds: new Set(["l11"]),
        })}
      />
    )
    const done = lessonButton(/Hola/)
    const current = lessonButton(/Adiós/)
    const locked = lessonButton(/Madre/)
    expect(done).toHaveAttribute("data-lesson-state", "done")
    expect(current).toHaveAttribute("data-lesson-state", "current")
    expect(current).toHaveAttribute("aria-current", "true")
    expect(locked).toHaveAttribute("data-lesson-state", "locked")
    expect(done).not.toHaveAttribute("aria-current")
  })

  it("bloqueada: nunca botón disabled — aria-disabled + mensaje + click igual navega", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CourseOutline {...props({ onSelect })} />)
    const locked = lessonButton(/Madre/)
    expect(locked).not.toBeDisabled()
    expect(locked).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByText("Completá el Módulo 1 para desbloquear este módulo")
    ).toBeDefined()
    await user.click(locked)
    expect(onSelect).toHaveBeenCalledWith("l21")
  })

  it("un solo tab stop en el outline (roving tabindex sobre la activa)", () => {
    render(<CourseOutline {...props({ activeLessonId: "l12" })} />)
    const buttons = screen.getAllByRole("button")
    const tabbable = buttons.filter((b) => (b as HTMLButtonElement).tabIndex === 0)
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toHaveAttribute("aria-current", "true")
  })

  it("teclado: flechas mueven el foco lineal, Home/End a los extremos", async () => {
    const user = userEvent.setup()
    render(<CourseOutline {...props({ activeLessonId: "l11" })} />)
    const first = lessonButton(/Hola/)
    first.focus()
    expect(first).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(lessonButton(/Adiós/)).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(lessonButton(/Madre/)).toHaveFocus()

    await user.keyboard("{ArrowUp}")
    expect(lessonButton(/Adiós/)).toHaveFocus()

    await user.keyboard("{Home}")
    expect(lessonButton(/Hola/)).toHaveFocus()

    await user.keyboard("{End}")
    expect(lessonButton(/Madre/)).toHaveFocus()
  })

  it("Enter activa la lección enfocada", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CourseOutline {...props({ onSelect, activeLessonId: "l11" })} />)
    lessonButton(/Hola/).focus()
    await user.keyboard("{ArrowDown}")
    await user.keyboard("{Enter}")
    expect(onSelect).toHaveBeenCalledWith("l12")
  })

  it("muestra numeración serif 2.3 y marca la última visitada", () => {
    render(
      <CourseOutline
        {...props({ activeLessonId: "l12", lastVisitedLessonId: "l11" })}
      />
    )
    expect(screen.getByText(/1\.1/)).toBeDefined()
    expect(screen.getByLabelText("Última lección visitada")).toBeDefined()
  })

  it("sin sequential no hay bloqueos ni mensajes de lock", () => {
    render(
      <CourseOutline
        {...props({ course: { ...course, sequential: false }, activeLessonId: "l11" })}
      />
    )
    const madre = lessonButton(/Madre/)
    expect(madre).toHaveAttribute("data-lesson-state", "todo")
    expect(madre).not.toHaveAttribute("aria-disabled")
    expect(screen.queryByText(/para desbloquear este módulo/)).toBeNull()
  })
})
