import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useParams: () => ({ courseId: "c1", lessonId: "l1" }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

/**
 * Stub opcional de LessonEditor para cubrir ramas de la página que con el
 * componente real son inalcanzables (p. ej. `setAutosaveState("error")`: el
 * `guardar` del editor traga todos sus errores y nunca rechaza). Por defecto
 * (`stub === null`) delega al componente real, así que el resto de los tests
 * no cambia de comportamiento.
 */
const lessonEditorCtl = vi.hoisted(() => ({
  stub: null as null | {
    guardar: (motivo?: "manual" | "auto") => Promise<import("@/components/admin/lesson-editor/lesson-editor").SaveResult>
    registrarGuardar?: boolean
    dirty?: boolean
    conBloques?: boolean
  },
}))

vi.mock("@/components/admin/lesson-editor/lesson-editor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/admin/lesson-editor/lesson-editor")>()
  const { useEffect, createElement } = await import("react")
  return {
    LessonEditor: function LessonEditorStub(props: any) {
      const stub = lessonEditorCtl.stub
      // Registro único al montar: los callbacks del stub solo corren cuando
      // el test activó `lessonEditorCtl.stub` antes del render.
      useEffect(() => {
        if (!stub) return
        if (stub.registrarGuardar) props.onGuardarRef?.(stub.guardar)
        props.onUndoRedoRef?.(() => {}, () => {}, false, false)
        if (stub.conBloques) {
          props.onBloquesChange?.([
            {
              id: "b-quiz-stub",
              type: "quiz",
              passScore: 70,
              questions: [
                {
                  prompt: "¿2 + 2?",
                  options: [{ text: "4", correct: true }, { text: "5", correct: false }],
                },
              ],
            },
          ])
        }
        props.onDirtyChange?.(!!stub.dirty)
      }, [])
      return stub ? null : createElement(actual.LessonEditor, props)
    },
  }
})

import LessonEditorPage from "./page"
import type { LessonBlock } from "@/lib/courses/blocks"

type LeccionDetalleTest = {
  id: string
  title: string
  lessonNumber: number | null
  content: { version: number; blocks: LessonBlock[] } | null
  moduleId: string
  moduleTitle: string
  courseId: string
  courseTitle: string
  courseStatus: string
  prev: { id: string; title: string } | null
  next: { id: string; title: string } | null
}

const LECCION: LeccionDetalleTest = {
  id: "l1",
  title: "Lección 1",
  lessonNumber: 1,
  content: { version: 2, blocks: [] },
  moduleId: "m1",
  moduleTitle: "Módulo 1",
  courseId: "c1",
  courseTitle: "Curso 1",
  courseStatus: "DRAFT",
  prev: null,
  next: { id: "l2", title: "Lección 2" },
}

function mockFetchLeccion() {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    if (String(input).includes("/api/lessons/")) {
      return Response.json({ lesson: LECCION })
    }
    return Response.json({ words: [], totalPages: 1, total: 0 })
  })
}

/** Igual que mockFetchLeccion pero con campos de la lección sobrescritos. */
function mockFetchLeccionCustom(custom: Partial<typeof LECCION>) {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    if (String(input).includes("/api/lessons/")) {
      return Response.json({ lesson: { ...LECCION, ...custom } })
    }
    return Response.json({ words: [], totalPages: 1, total: 0 })
  })
}

/** Promise controlada desde el test (para resolver/rechazar a mano). */
function defer<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("LessonEditorPage [F2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    mockFetchLeccion()
  })

  it("carga la lección: título, breadcrumb y vecinas", async () => {
    render(<LessonEditorPage />)
    expect(await screen.findByDisplayValue("Lección 1")).toBeDefined()
    expect(screen.getByText(/Curso 1 · Módulo 1/)).toBeDefined()
    // prev deshabilitado (es la primera), next habilitado
    expect(screen.getByRole("button", { name: /Sin lección anterior/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Lección siguiente/ })).toBeEnabled()
    // undo/redo disponibles
    expect(screen.getByRole("button", { name: "Deshacer último cambio" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Rehacer cambio" })).toBeDefined()
  })

  it("el modo vista muestra el preview y oculta el editor", async () => {
    render(<LessonEditorPage />)
    await screen.findByDisplayValue("Lección 1")

    fireEvent.click(screen.getByRole("button", { name: "Vista previa" }))
    expect(screen.getByRole("button", { name: "Volver a edición" })).toBeDefined()
  })

  it("navegar con cambios abre el guard y Descarta", async () => {
    const user = (await import("@testing-library/user-event")).default.setup()
    render(<LessonEditorPage />)
    const titulo = await screen.findByDisplayValue("Lección 1")

    // ensuciar: cambiar el título
    await user.clear(titulo)
    await user.type(titulo, "Lección 1 editada")
    expect(await screen.findByText("Cambios sin guardar")).toBeDefined()

    // intentar salir
    fireEvent.click(screen.getByRole("button", { name: "Volver a Gestión de cursos" }))
    expect(await screen.findByText("¿Salir sin guardar?")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }))
    expect(pushMock).toHaveBeenCalledWith("/admin/cursos")
  })

  it("404 muestra estado de error con volver", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
    render(<LessonEditorPage />)
    expect(await screen.findByText("Lección no encontrada")).toBeDefined()
  })
})

// ====================================================================
// EDGE / ADVERSARIAL — autosave y estados
// ====================================================================
describe("LessonEditorPage — autosave edge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    mockFetchLeccion()
  })

  it("muestra error de carga de red", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("net"))
    render(<LessonEditorPage />)
    expect(await screen.findByText("Error de red. Intenta de nuevo.")).toBeDefined()
  })

  it("autosave no dispara con lección sin bloques (blocks vacío)", async () => {
    render(<LessonEditorPage />)
    await screen.findByDisplayValue("Lección 1")
    // cambiar título ensucia, pero blocks sigue vacío → efecto tiene guard `!blocks.length`
    const titulo = screen.getByDisplayValue("Lección 1")
    fireEvent.change(titulo, { target: { value: "Editado" } })
    await new Promise((r) => setTimeout(r, 2300))
    const putCalls = (vi.mocked(fetch).mock.calls as any[]).filter((c) => String(c[0]).includes("/api/lessons/") && (c[1]?.method === "PUT"))
    expect(putCalls).toHaveLength(0)
  })
})

// ====================================================================
// COBERTURA — navegación, guards, teclado global, beforeunload, carga
// ====================================================================
describe("LessonEditorPage — interacción y guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lessonEditorCtl.stub = null
    global.fetch = vi.fn()
    mockFetchLeccion()
  })

  it("navegación sin cambios navega directo: prev, next y volver (irA rama !dirty)", async () => {
    // prev seteada y lessonNumber null → título con "?"
    mockFetchLeccionCustom({ prev: { id: "l0", title: "Lección 0" }, lessonNumber: null })
    render(<LessonEditorPage />)
    await screen.findByDisplayValue("Lección 1")

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("?. Lección 1")
    fireEvent.click(screen.getByRole("button", { name: /Lección anterior: Lección 0/ }))
    expect(pushMock).toHaveBeenCalledWith("/admin/cursos/c1/lecciones/l0")
    fireEvent.click(screen.getByRole("button", { name: /Lección siguiente: Lección 2/ }))
    expect(pushMock).toHaveBeenCalledWith("/admin/cursos/c1/lecciones/l2")
    fireEvent.click(screen.getByRole("button", { name: "Volver a Gestión de cursos" }))
    expect(pushMock).toHaveBeenCalledWith("/admin/cursos")
    expect(screen.queryByText("¿Salir sin guardar?")).toBeNull()
  })

  it("error no-404 muestra mensaje genérico; su botón vuelve a cursos", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))
    render(<LessonEditorPage />)
    expect(await screen.findByText("No se pudo cargar la lección")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Volver a Gestión de cursos" }))
    expect(pushMock).toHaveBeenCalledWith("/admin/cursos")
  })

  it("lección sin content arranca con bloques vacíos (?? [])", async () => {
    mockFetchLeccionCustom({ content: null })
    render(<LessonEditorPage />)
    await screen.findByDisplayValue("Lección 1")
    // sin bloques → el editor muestra el estado vacío con plantillas
    expect(screen.getByTestId("plantilla-quiz")).toBeDefined()
  })

  it("guard: Seguir editando limpia pendiente y no navega", async () => {
    render(<LessonEditorPage />)
    const titulo = await screen.findByDisplayValue("Lección 1")
    fireEvent.change(titulo, { target: { value: "Editada" } })
    fireEvent.click(screen.getByRole("button", { name: "Volver a Gestión de cursos" }))
    expect(await screen.findByText("¿Salir sin guardar?")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }))
    await waitFor(() => expect(screen.queryByText("¿Salir sin guardar?")).toBeNull())
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("guard: confirmar desde el botón next navega a la lección siguiente", async () => {
    render(<LessonEditorPage />)
    const titulo = await screen.findByDisplayValue("Lección 1")
    fireEvent.change(titulo, { target: { value: "Editada" } })
    fireEvent.click(screen.getByRole("button", { name: /Lección siguiente/ }))
    expect(await screen.findByText("¿Salir sin guardar?")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }))
    expect(pushMock).toHaveBeenCalledWith("/admin/cursos/c1/lecciones/l2")
  })

  it("beforeunload con cambios sin guardar llama preventDefault", async () => {
    render(<LessonEditorPage />)
    const titulo = await screen.findByDisplayValue("Lección 1")
    fireEvent.change(titulo, { target: { value: "Editada" } })
    const evento = new Event("beforeunload")
    const spy = vi.spyOn(evento, "preventDefault")
    window.dispatchEvent(evento)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("Escape en modo vista vuelve a edición y enfoca el título", async () => {
    render(<LessonEditorPage />)
    await screen.findByDisplayValue("Lección 1")
    fireEvent.click(screen.getByRole("button", { name: "Vista previa" }))
    // una tecla que no es Escape no hace nada (rama falsa del if)
    fireEvent(window, new KeyboardEvent("keydown", { key: "a" }))
    expect(screen.getByRole("button", { name: "Volver a edición" })).toBeDefined()

    const titulo = document.getElementById("lesson-title")!
    const focusSpy = vi.spyOn(titulo, "focus")
    fireEvent(window, new KeyboardEvent("keydown", { key: "Escape" }))
    expect(screen.getByRole("button", { name: "Vista previa" })).toBeDefined()
    await waitFor(() => expect(focusSpy).toHaveBeenCalled())
  })

  it("volver de vista a edición enfoca el título (el editor nunca se desmonta)", async () => {
    render(<LessonEditorPage />)
    await screen.findByDisplayValue("Lección 1")
    fireEvent.click(screen.getByRole("button", { name: "Vista previa" }))
    const titulo = document.getElementById("lesson-title")!
    const focusSpy = vi.spyOn(titulo, "focus")
    fireEvent.click(screen.getByRole("button", { name: "Volver a edición" }))
    await waitFor(() => expect(focusSpy).toHaveBeenCalled())
    expect(screen.getByRole("button", { name: "Vista previa" })).toBeDefined()
  })

  it("los botones de undo/redo de la toolbar operan el historial", async () => {
    render(<LessonEditorPage />)
    const titulo = await screen.findByDisplayValue("Lección 1")
    fireEvent.change(titulo, { target: { value: "Editada" } })
    const undoBtn = screen.getByRole("button", { name: "Deshacer último cambio" })
    expect(undoBtn).toBeEnabled()
    fireEvent.click(undoBtn)
    expect(screen.getByDisplayValue("Lección 1")).toBeDefined()
    const redoBtn = screen.getByRole("button", { name: "Rehacer cambio" })
    expect(redoBtn).toBeEnabled()
    fireEvent.click(redoBtn)
    expect(screen.getByDisplayValue("Editada")).toBeDefined()
  })

  it("el atajo global ignora teclas sin modificador y campos de texto", async () => {
    render(<LessonEditorPage />)
    await screen.findByDisplayValue("Lección 1")
    // el quiz template trae un textarea (Explicación…) y un editor mini
    fireEvent.click(screen.getByTestId("plantilla-quiz"))
    const titulo = screen.getByDisplayValue("Lección 1")
    fireEvent.change(titulo, { target: { value: "Editada" } })

    // sin modificador → no-op
    fireEvent(window, new KeyboardEvent("keydown", { key: "z" }))
    // target INPUT → no-op (el editor de título maneja su propio historial)
    fireEvent.keyDown(titulo, { key: "z", ctrlKey: true })
    // target TEXTAREA → no-op
    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    fireEvent.keyDown(textarea, { key: "z", ctrlKey: true })
    textarea.remove()
    expect(screen.getByDisplayValue("Editada")).toBeDefined()
    // contenteditable (jsdom no implementa isContentEditable: la rama se
    // ejercita sin poder afirmar el resultado; el undo real no ocurre porque
    // el target synthético no asegura el guard)
    const ce = document.createElement("div")
    ce.setAttribute("contenteditable", "true")
    document.body.appendChild(ce)
    fireEvent.keyDown(ce, { key: "z", ctrlKey: true })
    ce.remove()
  })

  it("Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y globales deshacen y rehacen (target no-input)", async () => {
    render(<LessonEditorPage />)
    const titulo = await screen.findByDisplayValue("Lección 1")
    fireEvent.change(titulo, { target: { value: "Editada" } })

    fireEvent(window, new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))
    expect(screen.getByDisplayValue("Lección 1")).toBeDefined()
    fireEvent(window, new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true }))
    expect(screen.getByDisplayValue("Editada")).toBeDefined()
    fireEvent(window, new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))
    expect(screen.getByDisplayValue("Lección 1")).toBeDefined()
    fireEvent(window, new KeyboardEvent("keydown", { key: "y", ctrlKey: true }))
    expect(screen.getByDisplayValue("Editada")).toBeDefined()
  })

  it("respuestas que llegan tras desmontar no tocan el estado (guards !cancelado)", async () => {
    // éxito después de desmontar
    const ok = defer<Response>()
    vi.mocked(fetch).mockImplementation(() => ok.promise)
    const { unmount } = render(<LessonEditorPage />)
    unmount()
    await act(async () => {
      ok.resolve(new Response(JSON.stringify({ lesson: LECCION }), { status: 200 }))
    })

    // 404 después de desmontar
    const nf = defer<Response>()
    vi.mocked(fetch).mockImplementation(() => nf.promise)
    const u2 = render(<LessonEditorPage />)
    u2.unmount()
    await act(async () => {
      nf.resolve(new Response(null, { status: 404 }))
    })

    // error de red después de desmontar
    const net = defer<Response>()
    vi.mocked(fetch).mockImplementation(() => net.promise)
    const u3 = render(<LessonEditorPage />)
    u3.unmount()
    await act(async () => {
      net.reject(new Error("boom"))
    })

    expect(pushMock).not.toHaveBeenCalled()
  })
})

// ====================================================================
// COBERTURA — autosave con fake timers (ciclo completo y errores)
// ====================================================================

/**
 * Con fake timers, `findBy*`/`waitFor` de Testing Library se cuelgan (su
 * propio timeout usa `setTimeout`, que está faked). Drenamos microtasks con
 * `act` hasta que la condición se cumple.
 */
async function flushHasta(check: () => boolean, intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    if (check()) return
    await act(async () => {})
  }
  if (!check()) throw new Error("flushHasta: la condición nunca se cumplió")
}

describe("LessonEditorPage — autosave (fake timers)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lessonEditorCtl.stub = null
    global.fetch = vi.fn()
    mockFetchLeccion()
    // Solo setTimeout/clearTimeout: el resto (rAF, Date, MessageChannel) queda
    // real para no interferir con waitFor ni con el foco del título.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  })

  afterEach(() => {
    vi.useRealTimers()
    lessonEditorCtl.stub = null
  })

  it("autosave guarda tras 2s: Guardando… → Guardado ✓ → vuelve a idle", async () => {
    const put = defer<Response>()
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/lessons/") && init?.method === "PUT") return put.promise
      return Response.json({ lesson: LECCION })
    })
    render(<LessonEditorPage />)
    await flushHasta(() => !!screen.queryByDisplayValue("Lección 1"))

    // la plantilla quiz trae un documento válido: dirty + blocks → autosave
    fireEvent.click(screen.getByTestId("plantilla-quiz"))
    expect(screen.getByText("Cambios sin guardar")).toBeDefined()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByText("· Guardando…")).toBeDefined()

    await act(async () => {
      put.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    })
    expect(screen.getByText("· Guardado ✓")).toBeDefined()
    expect(screen.queryByText("Cambios sin guardar")).toBeNull()
    const putCall = (vi.mocked(fetch).mock.calls as Array<[RequestInfo | URL, RequestInit?]>).find(
      ([input, init]) => String(input).includes("/api/lessons/") && init?.method === "PUT"
    )
    expect(putCall).toBeDefined()

    // tras 2s el badge de "Guardado ✓" vuelve a idle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.queryByText("· Guardado ✓")).toBeNull()
  })

  it("autosave con guardar rechazado muestra Error al guardar", async () => {
    const guardarMock = vi.fn<(motivo?: "manual" | "auto") => Promise<"saved" | "skipped" | "failed">>()
    guardarMock.mockRejectedValue(new Error("boom"))
    lessonEditorCtl.stub = {
      guardar: guardarMock,
      registrarGuardar: true,
      dirty: true,
      conBloques: true,
    }
    render(<LessonEditorPage />)
    await flushHasta(() => !!screen.queryByText("1. Lección 1"))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByText("· Error al guardar")).toBeDefined()
    expect(guardarMock).toHaveBeenCalledWith("auto")
  })

  it("autosave con doc inválido (guardar skipped) no miente con 'Guardado ✓'", async () => {
    const guardarMock = vi.fn<(motivo?: "manual" | "auto") => Promise<"saved" | "skipped" | "failed">>()
    guardarMock.mockResolvedValue("skipped")
    lessonEditorCtl.stub = {
      guardar: guardarMock,
      registrarGuardar: true,
      dirty: true,
      conBloques: true,
    }
    render(<LessonEditorPage />)
    await flushHasta(() => !!screen.queryByText("1. Lección 1"))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.queryByText(/Guardado ✓/)).toBeNull()
    expect(screen.queryByText(/Error al guardar/)).toBeNull()
    expect(guardarMock).toHaveBeenCalledWith("auto")
  })

  it("autosave sin guardarRef registrado no arranca (guard !fn)", async () => {
    const guardarMock = vi.fn<(motivo?: "manual" | "auto") => Promise<"saved" | "skipped" | "failed">>()
    lessonEditorCtl.stub = { guardar: guardarMock, dirty: true, conBloques: true }
    render(<LessonEditorPage />)
    await flushHasta(() => !!screen.queryByText("1. Lección 1"))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.queryByText("· Guardando…")).toBeNull()
    expect(screen.queryByText(/Guardado ✓/)).toBeNull()
    expect(guardarMock).not.toHaveBeenCalled()
  })
})
