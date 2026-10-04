import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })),
}))

import { LessonEditor } from "./lesson-editor"
import type { LessonBlock } from "@/lib/courses/blocks"

const bloqueTexto: LessonBlock = { id: "b1", type: "text", markdown: "Hola lección" }
const bloqueImagenVacia: LessonBlock = { id: "b2", type: "image", url: "", alt: "" }

function peticionPUT() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/api/dictionary/words")) {
      return Response.json({ words: [] })
    }
    if (url.startsWith("/api/lessons/")) {
      return Response.json({ lesson: { id: "l1" } })
    }
    return Response.json({})
  })
}

/** Los ids de las tarjetas de bloque, en el orden que aparecen en el DOM. */
function ordenDeBloques(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-testid^='block-card-']")
  ).map((el) => el.getAttribute("data-testid")!)
}

const boton = (nombre: RegExp) => screen.getByRole("button", { name: nombre })

describe("LessonEditor", () => {
  let fetchMock: ReturnType<typeof peticionPUT>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = peticionPUT()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("muestra el título y los bloques iniciales", () => {
    render(<LessonEditor lessonId="l1" initialTitle="Lección 1.1" initialBlocks={[bloqueTexto]} />)
    expect((screen.getByLabelText(/Título de la lección/i) as HTMLInputElement).value).toBe("Lección 1.1")
    expect(screen.getByDisplayValue("Hola lección")).toBeDefined()
    expect(ordenDeBloques()).toEqual(["block-card-b1"])
  })

  it("sin bloques muestra el estado vacío", () => {
    render(<LessonEditor lessonId="l1" initialTitle="T" initialBlocks={[]} />)
    expect(screen.getByText(/Agregá el primer bloque/i)).toBeDefined()
  })

  it("agregar un bloque lo deja al final", async () => {
    const user = userEvent.setup()
    render(<LessonEditor lessonId="l1" initialTitle="T" initialBlocks={[bloqueTexto]} />)

    await user.click(boton(/^Texto$/))

    const areas = screen.getAllByLabelText(/Texto de la lección/i)
    expect(areas).toHaveLength(2)
    expect((areas[1] as HTMLTextAreaElement).value).toBe("")
    expect(screen.getByText(/Cambios sin guardar/)).toBeDefined()
  })

  it("editar el texto del bloque marca cambios sin guardar", async () => {
    const user = userEvent.setup()
    render(
      <LessonEditor lessonId="l1" initialTitle="T" initialBlocks={[bloqueTexto]} />
    )
    expect(screen.queryByText(/Cambios sin guardar/)).toBeNull()

    await user.type(screen.getByLabelText(/Texto de la lección/i), "!")
    expect(screen.getByText(/Cambios sin guardar/)).toBeDefined()
  })

  it("bloque incompleto bloquea el guardado y marca la tarjeta", () => {
    render(
      <LessonEditor lessonId="l1" initialTitle="T" initialBlocks={[bloqueTexto, bloqueImagenVacia]} />
    )
    expect(boton(/Guardar lección/).hasAttribute("disabled")).toBe(true)
    expect(screen.getByText(/Hay bloques con errores/i)).toBeDefined()
    const tarjeta = screen.getByTestId("block-card-b2")
    expect(within(tarjeta).getByText(/url/i)).toBeDefined()
  })

  it("quitar bloque actualiza la lista", async () => {
    const user = userEvent.setup()
    render(
      <LessonEditor lessonId="l1" initialTitle="T" initialBlocks={[bloqueTexto, bloqueImagenVacia]} />
    )
    await user.click(boton(/Quitar bloque 2/i))
    expect(ordenDeBloques()).toEqual(["block-card-b1"])
  })

  it("mover bloque reordena", async () => {
    const user = userEvent.setup()
    render(
      <LessonEditor lessonId="l1" initialTitle="T" initialBlocks={[bloqueTexto, bloqueImagenVacia]} />
    )

    // mover el primero hacia arriba: no-op, nada cambia
    await user.click(boton(/Mover bloque 1 arriba/i))
    expect(ordenDeBloques()).toEqual(["block-card-b1", "block-card-b2"])

    await user.click(boton(/Mover bloque 1 abajo/i))
    expect(ordenDeBloques()).toEqual(["block-card-b2", "block-card-b1"])
  })

  it("guardar llama al PUT con título y contenido y limpia el indicador", async () => {
    const user = userEvent.setup()
    const onGuardado = vi.fn()
    render(
      <LessonEditor
        lessonId="l1"
        initialTitle="Lección nueva"
        initialBlocks={[bloqueTexto]}
        onGuardado={onGuardado}
      />
    )

    await user.type(screen.getByLabelText(/Texto de la lección/i), "!")
    await user.click(boton(/Guardar lección/))

    const put = fetchMock.mock.calls.find((c) => String(c[0]).startsWith("/api/lessons/"))
    expect(put).toBeDefined()
    const init = put![1] as RequestInit
    const cuerpo = JSON.parse(String(init.body)) as {
      title: string
      content: { version: number; blocks: Array<{ id: string; type: string; markdown: string }> }
    }
    expect(cuerpo.title).toBe("Lección nueva")
    expect(cuerpo.content.version).toBe(1)
    expect(cuerpo.content.blocks[0]!.markdown).toBe("Hola lección!")

    await waitFor(() => expect(screen.queryByText(/Cambios sin guardar/)).toBeNull())
    expect(onGuardado).toHaveBeenCalled()
  })

  it("la vista previa muestra el render del estudiante y se puede ocultar", async () => {
    const user = userEvent.setup()
    render(<LessonEditor lessonId="l1" initialTitle="T" initialBlocks={[bloqueTexto]} />)

    await user.click(boton(/Vista previa/i))
    const panel = screen.getByLabelText(/Vista previa de la lección/i)
    expect(within(panel).getByText("Hola lección")).toBeDefined()

    await user.click(boton(/Ocultar vista previa/i))
    expect(screen.queryByLabelText(/Vista previa de la lección/i)).toBeNull()
  })

  it("el bloque legacy se muestra como solo lectura", () => {
    const legacy: LessonBlock = { id: "b9", type: "legacy-quiz-words", words: ["a", "b"] }
    render(<LessonEditor lessonId="l1" initialTitle="T" initialBlocks={[legacy]} />)
    expect(screen.getByText(/no es editable/i)).toBeDefined()
  })
})
