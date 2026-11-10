import { describe, it, expect } from "vitest"
import {
  isCourseFinished,
  selectCourseSuggestions,
} from "./course-completion"
import type { PlayerCourse } from "./types"
import type { CourseSummary } from "@/components/cursos/course-card"

const lesson = (id: string) => ({ id, title: `L-${id}`, lessonNumber: null, content: null })

const courseTwoLessons: PlayerCourse = {
  id: "c1",
  title: "Curso 1",
  description: null,
  sequential: true,
  modules: [
    { id: "m1", title: "M1", lessons: [lesson("l1"), lesson("l2")] },
  ],
}

const courseCrossModule: PlayerCourse = {
  id: "c2",
  title: "Curso 2",
  description: null,
  sequential: true,
  modules: [
    { id: "m1", title: "M1", lessons: [lesson("a")] },
    { id: "m2", title: "M2", lessons: [lesson("b")] },
  ],
}

const emptyCourse: PlayerCourse = {
  id: "c0",
  title: "Vacío",
  description: null,
  sequential: false,
  modules: [{ id: "m0", title: "M0", lessons: [] }],
}

describe("isCourseFinished", () => {
  it("true: última lección activa, sin siguiente, completada", () => {
    expect(
      isCourseFinished({
        course: courseTwoLessons,
        activeLessonId: "l2",
        next: null,
        completedIds: new Set(["l1", "l2"]),
      })
    ).toBe(true)
  })

  it("true: acepta array en vez de Set", () => {
    expect(
      isCourseFinished({
        course: courseTwoLessons,
        activeLessonId: "l2",
        next: null,
        completedIds: ["l2"],
      })
    ).toBe(true)
  })

  it("false: hay siguiente (no es la última)", () => {
    expect(
      isCourseFinished({
        course: courseTwoLessons,
        activeLessonId: "l1",
        next: { id: "l2" },
        completedIds: new Set(["l1", "l2"]),
      })
    ).toBe(false)
  })

  it("false: última activa pero NO completada", () => {
    expect(
      isCourseFinished({
        course: courseTwoLessons,
        activeLessonId: "l2",
        next: null,
        completedIds: new Set(["l1"]),
      })
    ).toBe(false)
  })

  it("false: curso null", () => {
    expect(
      isCourseFinished({ course: null, activeLessonId: "l2", next: null, completedIds: ["l2"] })
    ).toBe(false)
  })

  it("false: curso sin lecciones", () => {
    expect(
      isCourseFinished({ course: emptyCourse, activeLessonId: "x", next: null, completedIds: ["x"] })
    ).toBe(false)
  })

  it("false: sin lección activa", () => {
    expect(
      isCourseFinished({ course: courseTwoLessons, activeLessonId: null, next: null, completedIds: [] })
    ).toBe(false)
  })

  it("true: última lección cruzando módulos", () => {
    expect(
      isCourseFinished({
        course: courseCrossModule,
        activeLessonId: "b",
        next: null,
        completedIds: ["a", "b"],
      })
    ).toBe(true)
  })

  it("true: curso de 1 sola lección completada", () => {
    const single: PlayerCourse = {
      ...courseTwoLessons,
      modules: [{ id: "m1", title: "M1", lessons: [lesson("solo")] }],
    }
    expect(
      isCourseFinished({ course: single, activeLessonId: "solo", next: null, completedIds: ["solo"] })
    ).toBe(true)
  })
})

const summary = (over: Partial<CourseSummary> & { id: string }): CourseSummary => ({
  title: over.id,
  description: null,
  modules: 1,
  lessons: 2,
  progressPct: null,
  ...over,
})

describe("selectCourseSuggestions", () => {
  const catalog = [
    summary({ id: "actual", status: "PUBLISHED" }),
    summary({ id: "nuevo", status: "PUBLISHED", progressPct: null }),
    summary({ id: "encurso", status: "PUBLISHED", progressPct: 25 }),
    summary({ id: "casi", status: "PUBLISHED", progressPct: 90 }),
    summary({ id: "borrador", status: "DRAFT" }),
    summary({ id: "archivado", status: "ARCHIVED" }),
    summary({ id: "vacio", status: "PUBLISHED", lessons: 0 }),
  ]

  it("excluye el actual, borradores, archivados y sin lecciones", () => {
    const ids = selectCourseSuggestions(catalog, "actual").map((c) => c.id)
    expect(ids).not.toContain("actual")
    expect(ids).not.toContain("borrador")
    expect(ids).not.toContain("archivado")
    expect(ids).not.toContain("vacio")
    expect(ids.sort()).toEqual(["casi", "encurso", "nuevo"])
  })

  it("ordena sin progreso primero y corta a 3", () => {
    const many = [
      summary({ id: "actual", status: "PUBLISHED" }),
      ...[1, 2, 3, 4, 5].map((n) =>
        summary({ id: `c${n}`, status: "PUBLISHED", progressPct: n * 10 })
      ),
    ]
    const ids = selectCourseSuggestions(many, "actual").map((c) => c.id)
    expect(ids).toEqual(["c1", "c2", "c3"])
  })

  it("vacío cuando no hay otros publicados", () => {
    expect(selectCourseSuggestions([summary({ id: "actual", status: "PUBLISHED" })], "actual")).toEqual([])
    expect(selectCourseSuggestions([], "actual")).toEqual([])
  })
})
