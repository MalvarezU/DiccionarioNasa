import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProgressTab } from "./progress-tab"
import type { CourseProgressSummary } from "./types"

const courses: CourseProgressSummary[] = [
  {
    courseId: "c-1",
    title: "Nasa Yuwe básico",
    coverImage: null,
    lessonsTotal: 10,
    lessonsCompleted: 4,
    percent: 40,
    lastVisitedAt: "2026-03-20T14:00:00.000Z",
    lastLessonId: "l-5",
    lastLessonTitle: "Saludos",
  },
]

describe("ProgressTab", () => {
  it("shows one card per course with percent and continue link", () => {
    render(<ProgressTab courses={courses} loading={false} />)
    expect(screen.getByText("Nasa Yuwe básico")).toBeDefined()
    expect(screen.getByText("40%")).toBeDefined()
    expect(screen.getByText(/4 de 10/)).toBeDefined()
    expect(screen.getByText(/última: saludos/i)).toBeDefined()
    const link = screen.getByRole("link", { name: /continuar/i })
    expect(link.getAttribute("href")).toBe("/cursos/c-1")
  })

  it("shows the explore CTA when there are no courses", () => {
    render(<ProgressTab courses={[]} loading={false} />)
    expect(screen.getByText("Todavía no empezaste ningún curso")).toBeDefined()
    const link = screen.getByRole("link", { name: /explorar cursos/i })
    expect(link.getAttribute("href")).toBe("/cursos")
  })
})
