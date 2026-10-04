import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useLessonEditor } from "./use-lesson-editor"
import type { LessonBlock } from "@/lib/courses/blocks"

const texto = (markdown = "Hola"): LessonBlock => ({
  id: "b1",
  type: "text",
  markdown,
})
const texto2: LessonBlock = { id: "b2", type: "text", markdown: "Segundo" }
const imagen: LessonBlock = { id: "b3", type: "image", url: "/a.png", alt: "Foto" }

describe("useLessonEditor — mutaciones del documento", () => {
  beforeEach(() => vi.clearAllMocks())

  it("arranca con los bloques iniciales y es válido", () => {
    const { result } = renderHook(() => useLessonEditor({ title: "T", blocks: [texto(), texto2] }))
    expect(result.current.title).toBe("T")
    expect(result.current.blocks).toHaveLength(2)
    expect(result.current.valido).toBe(true)
    expect(result.current.dirty).toBe(false)
  })

  it("addBlock agrega al final con id único", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto()] }))
    act(() => result.current.addBlock("image"))
    expect(result.current.blocks).toHaveLength(2)
    expect(result.current.blocks[1]!.type).toBe("image")
    expect(result.current.dirty).toBe(true)
  })

  it("setBlock reemplaza el bloque correcto", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), imagen] }))
    act(() => result.current.setBlock("b3", { ...imagen, alt: "Otra foto" }))
    expect(result.current.blocks[1]).toMatchObject({ alt: "Otra foto" })
    expect(result.current.blocks[0]!.id).toBe("b1")
  })

  it("removeBlock saca el bloque indicado", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), texto2] }))
    act(() => result.current.removeBlock("b2"))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b1"])
  })

  it("moveBlock baja y sube; en los extremos es no-op", () => {
    const { result } = renderHook(() =>
      useLessonEditor({ blocks: [texto(), texto2, imagen] })
    )

    act(() => result.current.moveBlock("b1", 1))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b2", "b1", "b3"])

    act(() => result.current.moveBlock("b1", -1))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b1", "b2", "b3"])

    // ya está primero: no-op (y no revienta)
    act(() => result.current.moveBlock("b1", -1))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b1", "b2", "b3"])

    // id inexistente: no-op
    act(() => result.current.moveBlock("nope", 1))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b1", "b2", "b3"])
  })

  it("dirty se limpia con markSaved", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [] }))
    act(() => result.current.addBlock("text"))
    expect(result.current.dirty).toBe(true)
    act(() => result.current.markSaved())
    expect(result.current.dirty).toBe(false)
  })
})

describe("useLessonEditor — validación con el MISMO contrato del server", () => {
  it("un bloque inválido marca su tarjeta y deshabilita el guardado", () => {
    const invalido: LessonBlock = { id: "mal", type: "image", url: "", alt: "" }
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), invalido] }))

    expect(result.current.valido).toBe(false)
    expect(result.current.documento).toBeNull()
    expect(result.current.erroresPorBloque["mal"]).toEqual(
      expect.arrayContaining([expect.stringContaining("url")])
    )
    // el bloque bueno no arrastra errores del malo
    expect(result.current.erroresPorBloque["b1"]).toBeUndefined()
  })

  it("un documento inválido expone los errores con ruta", () => {
    const { result } = renderHook(() =>
      useLessonEditor({ blocks: [{ id: "x", type: "desconocido" } as never] })
    )
    expect(result.current.errores.length).toBeGreaterThan(0)
    expect(result.current.documento).toBeNull()
  })

  it("documento válido expone el documento listo para guardar", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto()] }))
    expect(result.current.documento).toEqual({
      version: 1,
      blocks: [{ id: "b1", type: "text", markdown: "Hola" }],
    })
  })
})
