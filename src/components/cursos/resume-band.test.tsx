import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ResumeBand } from "./resume-band"
import type { CourseSummary } from "./course-card"

const course: CourseSummary = {
  id: "c1",
  title: "Nasa Yuwe básico",
  description: "d",
  modules: 2,
  lessons: 4,
  progressPct: 25,
}

describe("ResumeBand", () => {
  it("enlaza a la próxima lección con ?leccion=", () => {
    render(
      <ResumeBand
        course={course}
        nextLesson={{ id: "l7", title: "Saludos", moduleIndex: 2, lessonNumber: 3 }}
        progressPct={25}
      />
    )
    expect(screen.getByText(/Módulo 2 · sigue con 2\.3 Saludos/)).toBeDefined()
    const cta = screen.getByText("Continuar")
    expect(cta.closest("a")?.getAttribute("href")).toBe("/cursos/c1?leccion=l7")
  })

  it("muestra % con tabular-nums y barra con aria-label", () => {
    const { container } = render(
      <ResumeBand
        course={course}
        nextLesson={{ id: "l7", title: "Saludos", moduleIndex: 1, lessonNumber: 1 }}
        progressPct={72}
      />
    )
    expect(screen.getByText("72% completado")).toBeDefined()
    expect(container.querySelector(".tabular-nums")).not.toBeNull()
    expect(screen.getByLabelText("Avance: 72%")).toBeDefined()
  })

  it("sin próxima lección ofrece repasar hacia el curso", () => {
    render(<ResumeBand course={course} nextLesson={null} progressPct={100} />)
    expect(screen.getByText(/Curso completado/)).toBeDefined()
    const cta = screen.getByText("Repasar")
    expect(cta.closest("a")?.getAttribute("href")).toBe("/cursos/c1")
  })

  it("lección legacy sin número muestra solo título", () => {
    render(
      <ResumeBand
        course={course}
        nextLesson={{ id: "l1", title: "Intro", moduleIndex: 1, lessonNumber: null }}
        progressPct={10}
      />
    )
    expect(screen.getByText(/Módulo 1 · sigue con Intro/)).toBeDefined()
  })
})
