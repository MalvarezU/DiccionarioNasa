import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CourseOutline } from "./course-outline"
import { LessonCanvas } from "./lesson-canvas"
import { PlayerShell } from "./player-shell"
import { ResumeBand } from "../resume-band"
import { FeaturedCourseCard } from "../featured-course-card"
import { CourseCatalogCard } from "../course-catalog-card"
import type { PlayerCourse, PlayerLesson } from "./types"
import type { CourseSummary } from "../course-card"

// Motion CSS-only: jsdom no computa keyframes ni media queries, así que el
// contrato temporal (duraciones, delays, gating) se verifica sobre el fuente
// de globals.css y el resto sobre clases/atributos del DOM renderizado.
const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8")
const playerCss = css.slice(css.indexOf("F4 — motion"), css.indexOf("/* F5"))

const LONG_TITLE = "We'we fxi'zenxi u'juy'sawe'sx fiy len'i' pta'nzxi dxi'j nxuna'"

const outlineCourse: PlayerCourse = {
  id: "c1",
  title: "Nasa Yuwe básico",
  description: null,
  sequential: true,
  modules: [
    {
      id: "m1",
      title: "Saludos y presentaciones en la tulpa",
      lessons: [
        { id: "l11", title: LONG_TITLE, lessonNumber: 1, content: null },
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

function outlineProps(overrides: Partial<Parameters<typeof CourseOutline>[0]> = {}) {
  return {
    course: outlineCourse,
    activeLessonId: "l11" as string | null,
    completedIds: new Set<string>(),
    lastVisitedLessonId: null as string | null,
    onSelect: vi.fn(),
    ...overrides,
  }
}

function canvasLesson(overrides: Partial<PlayerLesson> = {}): PlayerLesson {
  return {
    id: "l11",
    title: LONG_TITLE,
    lessonNumber: 1,
    content: { version: 2, blocks: [] },
    ...overrides,
  }
}

function canvasProps(overrides: Partial<Parameters<typeof LessonCanvas>[0]> = {}) {
  return {
    lesson: canvasLesson(),
    moduleTitle: "Saludos",
    moduleIndex: 1,
    words: new Map(),
    prev: {
      id: "l10",
      title: "Intro",
      number: 1,
      moduleIndex: 1,
      locked: false,
    } as Parameters<typeof LessonCanvas>[0]["prev"],
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

const summaryCourse: CourseSummary = {
  id: "c1",
  title: "Nasa Yuwe básico",
  description: "Curso inicial",
  status: "PUBLISHED",
  modules: 2,
  lessons: 4,
  progressPct: 72,
}

describe("player-motion (F4)", () => {
  it("motion tras no-preference explícito; reduce neutraliza; sin motion-safe:", () => {
    const noPref = css.indexOf("@media (prefers-reduced-motion: no-preference)")
    expect(noPref).toBeGreaterThan(-1)
    expect(css.indexOf("@keyframes player-reveal", noPref)).toBeGreaterThan(noPref)
    expect(css.indexOf("@keyframes check-pop", noPref)).toBeGreaterThan(noPref)
    // Las clases custom no usan la variante motion-safe: (Tailwind no genera
    // nada para ellas); todo el gating es @media explícito.
    expect(css).not.toContain("motion-safe:")
    // Fallback reduce ("nada", alternativa aceptada por §H frente al crossfade).
    const reduceIdx = css.indexOf("@media (prefers-reduced-motion: reduce)")
    expect(reduceIdx).toBeGreaterThan(-1)
    expect(css.slice(reduceIdx)).toContain("animation-duration: 0.01ms")
  })

  it("stagger limitado a 5 bloques, +60ms hasta 240ms, easing único", () => {
    expect(playerCss).toContain("nth-child(-n + 5)")
    expect(playerCss).not.toContain("nth-child(6)")
    const delays = [...playerCss.matchAll(/animation-delay:\s*(\d+)ms/g)].map((m) =>
      Number(m[1])
    )
    expect(delays).toEqual([60, 120, 180, 240])
    expect(playerCss).toContain("player-reveal 200ms cubic-bezier(0.22, 1, 0.36, 1)")
    expect(playerCss).toContain("check-pop 180ms cubic-bezier(0.22, 1, 0.36, 1)")
  })

  it("hit areas ≥44px en outline, índice móvil, prev/next, requerida y continuar", () => {
    const { unmount: u1 } = render(<CourseOutline {...outlineProps()} />)
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("min-h-[44px]")
    }
    u1()

    const { unmount: u2 } = render(
      <PlayerShell outline={<div>Índice</div>} canvas={<div>Lección</div>} />
    )
    expect(
      screen.getByRole("button", { name: "Índice del curso" }).className
    ).toContain("min-h-[44px]")
    u2()

    const { unmount: u3 } = render(<LessonCanvas {...canvasProps()} />)
    expect(screen.getByRole("button", { name: /Intro/ }).className).toContain(
      "min-h-[44px]"
    )
    expect(screen.getByRole("button", { name: /Adiós/ }).className).toContain(
      "min-h-[44px]"
    )
    u3()

    const { unmount: u4 } = render(
      <LessonCanvas
        {...canvasProps({
          moduleIndex: 2,
          locked: true,
          requiredLesson: { id: "l12", title: "Adiós", number: 2 },
        })}
      />
    )
    expect(
      screen.getByRole("button", { name: /Ir a la lección requerida/ }).className
    ).toContain("min-h-[44px]")
    u4()

    render(
      <ResumeBand
        course={summaryCourse}
        nextLesson={{ id: "l7", title: "Saludos", moduleIndex: 2, lessonNumber: 3 }}
        progressPct={72}
      />
    )
    expect(screen.getByText("Continuar").closest("a")?.className).toContain(
      "min-h-[44px]"
    )

    // "Marcar como completada" vive dentro del child intacto: el canvas lo
    // garantiza por CSS sin tocar el componente.
    expect(playerCss).toMatch(
      /\[data-testid="lesson-content"\] > button \{\s*min-height: 44px;\s*\}/
    )
  })

  it("tabular-nums en conteos y porcentajes (outline, canvas, bandas, tarjetas)", () => {
    const { unmount: u1 } = render(<CourseOutline {...outlineProps()} />)
    expect(screen.getByText(/0\/3/).closest(".tabular-nums")).not.toBeNull()
    expect(screen.getByText("0%").closest(".tabular-nums")).not.toBeNull()
    expect(screen.getByText("0/2").closest(".tabular-nums")).not.toBeNull()
    u1()

    const { unmount: u2 } = render(<LessonCanvas {...canvasProps()} />)
    expect(screen.getByText("1.1").className).toContain("tabular-nums")
    u2()

    const { unmount: u3 } = render(
      <ResumeBand
        course={summaryCourse}
        nextLesson={{ id: "l7", title: "Saludos", moduleIndex: 1, lessonNumber: 1 }}
        progressPct={72}
      />
    )
    expect(screen.getByText("72% completado").className).toContain("tabular-nums")
    u3()

    const { unmount: u4 } = render(<FeaturedCourseCard course={summaryCourse} />)
    expect(screen.getByText("72% completado").className).toContain("tabular-nums")
    u4()

    render(<CourseCatalogCard course={summaryCourse} />)
    // F-E1: el chip de estado vive ahora sobre la portada (vidrio, sup-izq).
    expect(screen.getByText("En curso").closest("[class*='bg-background/85']")).not.toBeNull()
    expect(screen.getByText("2 módulos · 4 lecciones").className).toContain(
      "tabular-nums"
    )
    expect(screen.getByText("72% completado").className).toContain("tabular-nums")
  })

  it("foco visible: outline con anillo oliva, canvas con anillo del sistema", () => {
    const { unmount: u1 } = render(<CourseOutline {...outlineProps()} />)
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("focus-oliva")
    }
    u1()

    const { unmount: u2 } = render(<LessonCanvas {...canvasProps()} />)
    expect(screen.getByRole("button", { name: /Adiós/ }).className).toContain(
      "focus-visible:"
    )
    u2()

    render(
      <PlayerShell outline={<div>Índice</div>} canvas={<div>Lección</div>} />
    )
    expect(
      screen.getByRole("button", { name: "Índice del curso" }).className
    ).toContain("focus-visible:")
  })

  it("títulos largos: outline trunca 1 línea con title nativo; canvas envuelve a 2", () => {
    const { unmount: u1 } = render(<CourseOutline {...outlineProps()} />)
    const lessonButton = screen.getByTitle(LONG_TITLE)
    expect(lessonButton.tagName).toBe("BUTTON")
    expect(lessonButton.querySelector(".truncate")).not.toBeNull()
    expect(screen.getByTitle("Saludos y presentaciones en la tulpa")).not.toBeNull()
    u1()

    render(<LessonCanvas {...canvasProps()} />)
    const h2 = screen.getByRole("heading", { level: 2, name: LONG_TITLE })
    expect(h2.className).toContain("line-clamp-2")
  })
})
