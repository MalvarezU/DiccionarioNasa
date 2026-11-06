import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useLessonNavigation } from "./use-lesson-navigation"
import type { PlayerCourse } from "./types"

const course: PlayerCourse = {
  id: "c1",
  title: "Curso",
  description: null,
  sequential: true,
  modules: [
    {
      id: "m1",
      title: "Módulo uno",
      lessons: [
        { id: "l11", title: "Lección 1.1", lessonNumber: 1, content: null },
        { id: "l12", title: "Lección 1.2", lessonNumber: 2, content: null },
      ],
    },
    {
      id: "m2",
      title: "Módulo dos",
      lessons: [
        { id: "l21", title: "Lección 2.1", lessonNumber: 1, content: null },
        { id: "l22", title: "Lección 2.2", lessonNumber: 2, content: null },
      ],
    },
  ],
}

function setUrl(query: string): void {
  window.history.replaceState(null, "", `/cursos/c1${query}`)
}

describe("useLessonNavigation", () => {
  beforeEach(() => {
    setUrl("")
  })
  afterEach(() => {
    setUrl("")
    vi.restoreAllMocks()
  })

  it("resuelve ?leccion= explícito aunque esté bloqueada (el canvas muestra el banner)", () => {
    setUrl("?leccion=l21")
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: null })
    )
    expect(result.current.activeLessonId).toBe("l21")
  })

  it("sin param usa lastVisited", () => {
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: "l12" })
    )
    expect(result.current.activeLessonId).toBe("l12")
  })

  it("sin param ni visita usa la primera desbloqueada", () => {
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: null })
    )
    expect(result.current.activeLessonId).toBe("l11")
  })

  it("lección inválida/borrada cae en silencio a lastVisited", () => {
    setUrl("?leccion=no-existe")
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: "l12" })
    )
    expect(result.current.activeLessonId).toBe("l12")
  })

  it("lección inválida sin lastVisited cae a la primera desbloqueada", () => {
    setUrl("?leccion=no-existe")
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: null })
    )
    expect(result.current.activeLessonId).toBe("l11")
  })

  it("el init usa replaceState (no push) y normaliza la URL", () => {
    const replace = vi.spyOn(window.history, "replaceState")
    const push = vi.spyOn(window.history, "pushState")
    setUrl("")
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: "l12" })
    )
    expect(result.current.activeLessonId).toBe("l12")
    expect(replace).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(new URL(window.location.href).searchParams.get("leccion")).toBe("l12")
  })

  it("selectLesson navega con push (el back funciona)", () => {
    const push = vi.spyOn(window.history, "pushState")
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: null })
    )
    act(() => {
      result.current.selectLesson("l12")
    })
    expect(result.current.activeLessonId).toBe("l12")
    expect(push).toHaveBeenCalled()
    expect(new URL(window.location.href).searchParams.get("leccion")).toBe("l12")
  })

  it("popstate actualiza la lección activa (back/forward)", () => {
    setUrl("?leccion=l11")
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: null })
    )
    expect(result.current.activeLessonId).toBe("l11")
    act(() => {
      window.history.replaceState(null, "", "/cursos/c1?leccion=l12")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    expect(result.current.activeLessonId).toBe("l12")
  })

  it("prev/next cruzan módulos", () => {
    setUrl("?leccion=l12")
    const { result } = renderHook(() =>
      useLessonNavigation({
        course,
        completedIds: new Set(["l11", "l12"]),
        lastVisited: null,
      })
    )
    expect(result.current.next?.id).toBe("l21")
    expect(result.current.next?.locked).toBe(false)
    expect(result.current.prev?.id).toBe("l11")
  })

  it("prev es null en la primera y next es null en la última", () => {
    setUrl("?leccion=l11")
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(), lastVisited: null })
    )
    expect(result.current.prev).toBeNull()
    expect(result.current.next?.id).toBe("l12")
  })

  it("canAccess bloquea el módulo siguiente en secuencial", () => {
    setUrl("")
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(["l11"]), lastVisited: null })
    )
    expect(result.current.canAccess("l12")).toBe(true)
    expect(result.current.canAccess("l21")).toBe(false)
  })

  it("requiredLessonFor apunta a la primera incompleta del módulo anterior", () => {
    const { result } = renderHook(() =>
      useLessonNavigation({ course, completedIds: new Set(["l11"]), lastVisited: null })
    )
    expect(result.current.requiredLessonFor("l21")).toEqual({
      id: "l12",
      title: "Lección 1.2",
      number: 2,
    })
    expect(result.current.requiredLessonFor("l11")).toBeNull()
  })

  it("sin sequential todo está abierto", () => {
    const libre = { ...course, sequential: false }
    const { result } = renderHook(() =>
      useLessonNavigation({ course: libre, completedIds: new Set(), lastVisited: null })
    )
    expect(result.current.canAccess("l22")).toBe(true)
    expect(result.current.next).not.toBeNull()
  })
})
