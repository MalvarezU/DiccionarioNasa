import { vi } from "vitest"

/**
 * Helpers compartidos de los tests de `CourseManager`.
 *
 * El archivo original (`course-manager.test.tsx`) tenía 1124 líneas y 12 bloques
 * `describe` en un solo archivo; era el que fallaba de forma intermitente en la
 * suite paralela. Se partió en 4 archivos por tema (básico, guard, estructura,
 * editorial) y este helper concentra el setup puro que comparten.
 *
 * Acá NO van `vi.mock` ni `vi.hoisted`: el hoisting de Vitest es por archivo, así
 * que cada test file declara sus propios mocks de `next/navigation` y
 * `use-toast`.
 */

export const COURSES = [
  { id: "c1", title: "Básico", description: "d", status: "PUBLISHED", modules: 2, lessons: 4 },
  { id: "c2", title: "Intermedio", description: null, status: "DRAFT", modules: 0, lessons: 0 },
]

export const DETAIL_C1 = {
  id: "c1",
  title: "Básico",
  description: "d",
  status: "PUBLISHED",
  sequential: true,
  modules: [
    {
      id: "m1",
      title: "M1",
      order: 0,
      lessons: [{ id: "l1", title: "L1", order: 0, lessonNumber: 1 }],
    },
  ],
}

export const DETAIL_C2 = {
  id: "c2",
  title: "Intermedio",
  description: null,
  status: "DRAFT",
  sequential: true,
  modules: [],
}

export interface NavMock {
  push: ReturnType<typeof vi.fn>
  replace: ReturnType<typeof vi.fn>
  curso: string
  q: string
}

export function resetNavState(nav: NavMock) {
  nav.push.mockClear()
  nav.replace.mockClear()
  nav.curso = ""
  nav.q = ""
}

/** Respuestas base: lista + detalles + escrituras OK. */
export function mockBase() {
  vi.mocked(fetch).mockImplementation(async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    if (method !== "GET") {
      if (method === "POST" && url === "/api/courses") return Response.json({ course: { id: "c3" } })
      return Response.json({ ok: true, success: true })
    }
    if (url.startsWith("/api/courses?")) return Response.json({ courses: COURSES })
    if (url === "/api/courses/c1") return Response.json({ course: DETAIL_C1 })
    if (url === "/api/courses/c2") return Response.json({ course: DETAIL_C2 })
    if (url === "/api/courses/c3") return Response.json({ course: { ...DETAIL_C2, id: "c3", title: "Nuevo" } })
    return Response.json({})
  })
}

export function detailCalls(id: string) {
  return vi.mocked(fetch).mock.calls.filter(([u]) => String(u) === `/api/courses/${id}`)
}

/** jsdom no implementa pointer capture: Radix Select lo exige al abrir el menú. */
export function installJsdomPolyfills() {
  if (typeof Element !== "undefined") {
    const proto = Element.prototype as unknown as Record<string, unknown>
    if (typeof proto.hasPointerCapture !== "function") {
      proto.hasPointerCapture = () => false
      proto.setPointerCapture = () => {}
      proto.releasePointerCapture = () => {}
    }
    if (typeof proto.scrollIntoView !== "function") {
      proto.scrollIntoView = () => {}
    }
  }
}