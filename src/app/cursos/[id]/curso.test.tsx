import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, configure } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CursoDetailPage from "./page"

// Bajo suite completa en paralelo, jsdom + mocks tardan más de los 1000ms
// por defecto: se sube el timeout de las queries async solo en este archivo
// (flake conocido F4: lock bajo carga).
configure({ asyncUtilTimeout: 5000 })

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null })),
  signIn: vi.fn(),
}))

// El Toaster vive en el layout (no en la page): para asserts de toast nos
// quedamos con el hook mockeado, igual que los tests de AuthModal.
const toastMocks = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMocks.toast, toasts: [], dismiss: toastMocks.toast }),
}))

const AUTHED_SESSION = {
  data: { user: { id: "u1" } as never, expires: "2099-01-01T00:00:00Z" },
  status: "authenticated" as const,
  update: vi.fn(),
}

const ANON_SESSION = { data: null, status: "unauthenticated" as const, update: vi.fn() }

import { useSession } from "next-auth/react"

// Helper local: activa sesión autenticada en el mock de arriba.
function mockAuthed(): void {
  vi.mocked(useSession).mockReturnValue(AUTHED_SESSION)
}

vi.mock("@/components/navbar", () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

const MANIFEST = {
  courseId: "c1",
  title: "Básico",
  description: "d",
  sequential: true,
  modules: [
    {
      id: "m1",
      title: "M1",
      order: 0,
      lessons: [
        { id: "l1", title: "L1", lessonNumber: 1, interactiveCount: 0 },
        { id: "l2", title: "L2", lessonNumber: 2, interactiveCount: 0 },
      ],
    },
    {
      id: "m2",
      title: "M2",
      order: 1,
      lessons: [{ id: "l3", title: "L3", lessonNumber: 1, interactiveCount: 0 }],
    },
  ],
}

const LESSON_CONTENT: Record<string, { html: string; moduleId: string }> = {
  l1: { html: "Hola", moduleId: "m1" },
  l2: { html: "Mundo", moduleId: "m1" },
  l3: { html: "Tres", moduleId: "m2" },
}

const FLAT = ["l1", "l2", "l3"]

function lessonPayload(id: string) {
  const idx = FLAT.indexOf(id)
  const meta = LESSON_CONTENT[id]!
  const title = MANIFEST.modules.flatMap((m) => m.lessons).find((l) => l.id === id)!
  return {
    lesson: {
      id,
      title: title.title,
      lessonNumber: title.lessonNumber,
      content: { version: 2, blocks: [{ id: `b-${id}`, type: "text", html: meta.html }] },
      moduleId: meta.moduleId,
    },
    words: [],
    nav: {
      prevId: idx > 0 ? FLAT[idx - 1] : null,
      prevTitle: idx > 0 ? `L${idx}` : null,
      prevNumber: idx > 0 ? idx : null,
      nextId: idx < FLAT.length - 1 ? FLAT[idx + 1] : null,
      nextTitle: idx < FLAT.length - 1 ? `L${idx + 2}` : null,
      nextNumber: idx < FLAT.length - 1 ? idx + 2 : null,
      moduleTitle: meta.moduleId === "m1" ? "M1" : "M2",
      moduleIndex: meta.moduleId === "m1" ? 1 : 2,
    },
  }
}

describe("/cursos/[id] player", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    window.history.replaceState(null, "", "/cursos/c1")
    // mockReturnValue persiste entre tests (clearAllMocks no borra
    // implementaciones): anónimo explícito como base de cada test.
    vi.mocked(useSession).mockReturnValue(ANON_SESSION)
  })

  function mockCourse() {
    // F3: el player pide el manifest ligero + cada lección on-demand.
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes("/manifest")) return Response.json(MANIFEST) as never
      const m = u.match(/\/lessons\/([^/?]+)/)
      if (m) return Response.json(lessonPayload(m[1])) as never
      return Response.json({ completedIds: [], lastVisitedLessonId: null, pct: 0 }) as never
    })
  }

  /** mockCourse con la lección L1 armada con quiz (para tests de gate). */
  function mockCourseQuiz() {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes("/manifest")) return Response.json(MANIFEST) as never
      const m = u.match(/\/lessons\/([^/?]+)/)
      if (m) {
        const base = lessonPayload(m[1])
        if (m[1] === "l1") {
          return Response.json({
            ...base,
            lesson: {
              ...base.lesson,
              content: {
                version: 2,
                blocks: [
                  ...base.lesson.content.blocks,
                  {
                    id: "q-l1",
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
              },
            },
          }) as never
        }
        return Response.json(base) as never
      }
      return Response.json({ completedIds: [], lastVisitedLessonId: null, pct: 0 }) as never
    })
  }

  it("bloquea el módulo 2 hasta completar el 1 (secuencial, con sesión)", async () => {
    mockAuthed()
    mockCourse()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByRole("heading", { name: "Básico" })).toBeDefined()
    // El outline marca L3 como bloqueada sin deshabilitarla
    const outline = screen.getByRole("navigation", { name: /Contenido de/ })
    expect(outline.textContent).toContain("Completa el Módulo 1")
    const l3 = outline.querySelector('[data-lesson-state="locked"]')
    expect(l3).not.toBeNull()
    expect(l3).not.toBeDisabled()
    expect(l3).toHaveAttribute("aria-disabled", "true")
    // El canvas abre en la primera desbloqueada
    expect(await screen.findByRole("heading", { level: 2, name: "L1" })).toBeDefined()
    // El conteo vive solo en el resumen del outline (el header ya no duplica %)
    expect(screen.getAllByText("0/3 lecciones")).toHaveLength(1)
  })

  it("deep-link a bloqueada secuencial muestra el banner con CTA (con sesión)", async () => {
    mockAuthed()
    mockCourse()
    window.history.replaceState(null, "", "/cursos/c1?leccion=l3")
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByRole("heading", { level: 2, name: "L3" })).toBeDefined()
    const banner = await screen.findByRole("status")
    expect(banner.textContent).toContain("Completa el Módulo 1")
    expect(
      screen.getByRole("button", { name: /Ir a la lección requerida/ })
    ).toBeDefined()
  })

  // -------------------------------------- gate de sesión (H1/H2/H3) ---
  describe("gate de sesión para anónimos", () => {
    it("anónimo: click en radio del quiz abre modal + toast, sin marcar ni escribir progreso", async () => {
      mockCourseQuiz()
      const user = userEvent.setup()
      render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      const radio = await screen.findByRole("radio", { name: /Opción 1 de la pregunta 1/ })
      await user.click(radio)
      const dialog = await screen.findByRole("dialog")
      expect(dialog).toBeDefined()
      expect(screen.getByRole("heading", { name: /Iniciar sesión/ })).toBeDefined()
      expect(toastMocks.toast).toHaveBeenCalledWith({
        title: "Inicia sesión para interactuar con los cursos",
      })
      // El click no alcanzó al radio del quiz
      expect(radio).toHaveAttribute("aria-checked", "false")
      // H3: cero escrituras de progreso anónimas
      expect(localStorage.getItem("piiyaak:course:anon:v1:c1")).toBeNull()
    })

    it("anónimo: 'Marcar como completada' pide sesión y no escribe progreso", async () => {
      mockCourse()
      const user = userEvent.setup()
      render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      await user.click(await screen.findByRole("button", { name: /Marcar como completada/ }))
      expect(await screen.findByRole("dialog")).toBeDefined()
      expect(toastMocks.toast).toHaveBeenCalledWith({
        title: "Inicia sesión para interactuar con los cursos",
      })
      expect(localStorage.getItem("piiyaak:course:anon:v1:c1")).toBeNull()
      const progressPosts = vi
        .mocked(fetch)
        .mock.calls.filter(([u]) => String(u).includes("/api/progress"))
      expect(progressPosts).toHaveLength(0)
    })

    it("anónimo: click 'Revisar' no llega a revisar (sin respuestas registradas)", async () => {
      mockCourseQuiz()
      const user = userEvent.setup()
      render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      await screen.findByRole("heading", { level: 2, name: "L1" })
      const revisar = screen.getByRole("button", { name: "Revisar" })
      expect(revisar).toBeDisabled()
    })

    it("anónimo: deep-link a módulo 2 → banner de sesión con CTA que abre el modal", async () => {
      mockCourse()
      window.history.replaceState(null, "", "/cursos/c1?leccion=l3")
      const user = userEvent.setup()
      render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      expect(await screen.findByRole("heading", { level: 2, name: "L3" })).toBeDefined()
      const banner = await screen.findByRole("status")
      expect(banner.textContent).toContain("requiere sesión")
      expect(banner.textContent).toContain("módulo 2")
      expect(banner.textContent).not.toContain("Completa el Módulo")
      // Sin contenido y sin CTA secuencial para anónimo
      expect(screen.queryByRole("button", { name: /Marcar como completada/ })).toBeNull()
      expect(screen.queryByRole("button", { name: /Ir a la lección requerida/ })).toBeNull()
      await user.click(screen.getByRole("button", { name: "Iniciar sesión" }))
      expect(await screen.findByRole("dialog")).toBeDefined()
      expect(banner.textContent).toContain("requiere sesión")
    })

    it("anónimo: outline del módulo 2 pide sesión y no navega", async () => {
      mockCourse()
      const user = userEvent.setup()
      render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      await screen.findByRole("heading", { level: 2, name: "L1" })
      const outline = screen.getByRole("navigation", { name: /Contenido de/ })
      expect(outline.textContent).toContain(
        "Inicia sesión para acceder a partir del módulo 2"
      )
      const l3 = outline.querySelector('[data-lesson-state="locked"]')
      expect(l3).not.toBeNull()
      expect(l3).toHaveAttribute("aria-disabled", "true")
      await user.click(l3 as HTMLElement)
      expect(await screen.findByRole("dialog")).toBeDefined()
      // No se navega: la lección activa sigue siendo L1 (el canvas queda
      // aria-hidden detrás del modal: hidden:true) y la URL no cambia.
      expect(
        screen.getByRole("heading", { level: 2, name: "L1", hidden: true })
      ).toBeDefined()
      expect(window.location.search).toBe("?leccion=l1")
    })

    it("autenticado: el gate no aplica — radio se marca y el quiz reporta progreso", async () => {
      mockAuthed()
      mockCourseQuiz()
      const user = userEvent.setup()
      render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      const radio = await screen.findByRole("radio", { name: /Opción 1 de la pregunta 1/ })
      await user.click(radio)
      expect(radio).toHaveAttribute("aria-checked", "true")
      expect(toastMocks.toast).not.toHaveBeenCalled()
      await user.click(screen.getByRole("button", { name: "Revisar" }))
      expect(await screen.findByText(/Aprobaste con 100%/)).toBeDefined()
      await waitFor(() => {
        const post = vi
          .mocked(fetch)
          .mock.calls.find(
            ([u, init]) =>
              String(u).includes("/api/progress") &&
              (init as RequestInit | undefined)?.method === "POST"
          )
        expect(post).toBeDefined()
        expect(String((post as [unknown, RequestInit])[1]?.body)).toContain('"lessonId":"l1"')
        expect(String((post as [unknown, RequestInit])[1]?.body)).toContain('"score":100')
      })
      // La lección quedó completada en el outline
      expect(await screen.findAllByText("1/3 lecciones")).toHaveLength(1)
    })

    it("autenticado: outline del módulo 2 navegable según secuencial (regresión)", async () => {
      mockAuthed()
      mockCourse()
      const user = userEvent.setup()
      render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      const outline = await screen.findByRole("navigation", { name: /Contenido de/ })
      // Sin sesiones-gates: el cerrojo del módulo 2 es secuencial solamente
      expect(outline.textContent).toContain("Completa el Módulo 1")
      expect(
        screen.queryByText("Inicia sesión para acceder a partir del módulo 2")
      ).toBeNull()
      await user.click(outline.querySelector('[data-lesson-state="locked"]') as HTMLElement)
      expect(await screen.findByRole("heading", { level: 2, name: "L3" })).toBeDefined()
      expect(screen.getByRole("status").textContent).toContain("Completa el Módulo 1")
    })

    it("anónimo: el modal se auto-cierra cuando aparece la sesión", async () => {
      mockCourse()
      const user = userEvent.setup()
      const view = render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      await user.click(await screen.findByRole("button", { name: /Marcar como completada/ }))
      expect(await screen.findByRole("dialog")).toBeDefined()
      mockAuthed()
      // Sin dispatch de SessionProvider: la re-renderización con el nuevo mock
      // dispara el effect de auto-cierre (sesión apareció).
      view.rerender(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull()
      })
    })
  })

  it("completar lección reporta progreso y desbloquea", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } as never, expires: "2099-01-01T00:00:00Z" },
      status: "authenticated",
      update: vi.fn(),
    })
    // Manifest + lección activa + progreso (visita, completado): por URL.
    mockCourse()
    const user = userEvent.setup()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)

    // L1 ya es la activa: el child sin interactivos ofrece completar a mano
    await user.click(await screen.findByRole("button", { name: /Marcar como completada/ }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/progress",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"lessonId":"l1"'),
        })
      )
    })
    expect(await screen.findAllByText("1/3 lecciones")).toHaveLength(1)
  })

  it("fetch roto muestra error visible, jamás skeletons infinitos", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("caído"))
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByRole("alert")).toBeDefined()
    expect(screen.queryByLabelText("Cargando curso")).toBeNull()
  })

  it("lección con 0 bloques en secuencial desbloquea el módulo siguiente al completar", async () => {
    mockAuthed()
    const manifest2 = {
      ...MANIFEST,
      modules: [
        { id: "m1", title: "M1", order: 0, lessons: [{ id: "l1", title: "L1", lessonNumber: 1, interactiveCount: 0 }] },
        { id: "m2", title: "M2", order: 1, lessons: [{ id: "l2", title: "L2", lessonNumber: 1, interactiveCount: 0 }] },
      ],
    }
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes("/manifest")) return Response.json(manifest2) as never
      const m = u.match(/\/lessons\/([^/?]+)/)
      if (m)
        return Response.json({
          lesson: { id: m[1], title: m[1] === "l1" ? "L1" : "L2", lessonNumber: 1, content: { version: 2, blocks: [] }, moduleId: m[1] === "l1" ? "m1" : "m2" },
          words: [],
          nav: { prevId: null, prevTitle: null, prevNumber: null, nextId: null, nextTitle: null, nextNumber: null, moduleTitle: "M1", moduleIndex: 1 },
        }) as never
      return Response.json({ completedIds: [], lastVisitedLessonId: null, pct: 0 }) as never
    })
    const user = userEvent.setup()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    // La lección vacía ofrece completar a mano (el child da el botón)
    await user.click(await screen.findByRole("button", { name: /Marcar como completada/ }))
    // El módulo 2 se desbloquea: L2 pasa a todo y el aviso de lock desaparece
    const outline = screen.getByRole("navigation", { name: /Contenido de/ })
    await waitFor(() => {
      expect(outline.querySelector('[data-lesson-state="todo"]')).not.toBeNull()
    })
    expect(outline.textContent).not.toMatch(/Completa el Módulo/)
    expect(await screen.findAllByText("1/2 lecciones")).toHaveLength(1)
  })

  it("módulo vacío: pill 0/0, sin botones, el canvas abre la lección real", async () => {
    const manifestEmpty = {
      ...MANIFEST,
      modules: [
        { id: "m1", title: "M1", order: 0, lessons: [{ id: "l1", title: "L1", lessonNumber: 1, interactiveCount: 0 }] },
        { id: "m0", title: "Vacío", order: 1, lessons: [] },
      ],
    }
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes("/manifest")) return Response.json(manifestEmpty) as never
      const m = u.match(/\/lessons\/([^/?]+)/)
      if (m) return Response.json(lessonPayload(m[1])) as never
      return Response.json({ completedIds: [], lastVisitedLessonId: null, pct: 0 }) as never
    })
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByRole("heading", { level: 2, name: "L1" })).toBeDefined()
    const outline = screen.getByRole("navigation", { name: /Contenido de/ })
    expect(outline.textContent).toContain("0/0")
    // Solo la lección real es seleccionable
    expect(outline.querySelectorAll("[data-lesson-button]")).toHaveLength(1)
    expect(await screen.findAllByText("0/1 lecciones")).toHaveLength(1)
  })

  it("reintento tras fallo del manifest recupera el curso", async () => {
    let manifestCalls = 0
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes("/manifest")) {
        manifestCalls += 1
        if (manifestCalls === 1) throw new Error("caído")
        return Response.json(MANIFEST) as never
      }
      const m = u.match(/\/lessons\/([^/?]+)/)
      if (m) return Response.json(lessonPayload(m[1])) as never
      return Response.json({ completedIds: [], lastVisitedLessonId: null, pct: 0 }) as never
    })
    const user = userEvent.setup()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByRole("alert")).toBeDefined()
    await user.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(await screen.findByRole("heading", { name: "Básico" })).toBeDefined()
    expect(await screen.findByRole("heading", { level: 2, name: "L1" })).toBeDefined()
    expect(manifestCalls).toBe(2)
  })

  it("reintento tras fallo de la lección recupera el canvas", async () => {
    let lessonCalls = 0
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes("/manifest")) return Response.json(MANIFEST) as never
      const m = u.match(/\/lessons\/([^/?]+)/)
      if (m) {
        lessonCalls += 1
        if (lessonCalls === 1) throw new Error("caída")
        return Response.json(lessonPayload(m[1])) as never
      }
      return Response.json({ completedIds: [], lastVisitedLessonId: null, pct: 0 }) as never
    })
    const user = userEvent.setup()
    render(<CursoDetailPage params={Promise.resolve({ id: "c1" })} />)
    expect(await screen.findByText(/No se pudo cargar la lección/)).toBeDefined()
    await user.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(await screen.findByRole("heading", { level: 2, name: "L1" })).toBeDefined()
    expect(lessonCalls).toBe(2)
  })
})
