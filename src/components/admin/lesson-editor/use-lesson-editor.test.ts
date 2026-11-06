import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useLessonEditor } from "./use-lesson-editor"
import type { LessonBlock } from "@/lib/courses/blocks"

const texto = (html = "Hola"): LessonBlock => ({
  id: "b1",
  type: "text",
  html,
})
const texto2: LessonBlock = { id: "b2", type: "text", html: "Segundo" }
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

  it("setBlocks reemplaza todos los bloques y marca dirty", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto()] }))
    const nuevos = [texto2, imagen]
    act(() => result.current.setBlocks(nuevos))
    expect(result.current.blocks).toHaveLength(2)
    expect(result.current.blocks[0]!.id).toBe("b2")
    expect(result.current.dirty).toBe(true)
  })

  it("reorder mueve un bloque a la posición de otro", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), texto2, imagen] }))
    act(() => result.current.reorder("b1", "b3"))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b2", "b3", "b1"])
    expect(result.current.dirty).toBe(true)
  })

  it("reorder con ids iguales o inexistentes es no-op", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), texto2] }))
    act(() => result.current.reorder("b1", "b1"))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b1", "b2"])
    act(() => result.current.reorder("nope", "b2"))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b1", "b2"])
  })

  it("undo deshace el ultimo cambio y redo lo rehace", () => {
    const { result } = renderHook(() => useLessonEditor({ title: "T", blocks: [texto()] }))
    act(() => result.current.setTitle("T2"))
    expect(result.current.title).toBe("T2")
    expect(result.current.puedeDeshacer).toBe(true)
    act(() => result.current.undo())
    expect(result.current.title).toBe("T")
    expect(result.current.puedeRehacer).toBe(true)
    act(() => result.current.redo())
    expect(result.current.title).toBe("T2")
  })

  it("undo en el estado inicial es no-op", () => {
    const { result } = renderHook(() => useLessonEditor({ title: "T", blocks: [texto()] }))
    act(() => result.current.undo())
    expect(result.current.title).toBe("T")
  })

  it("nueva edicion tras undo descarta la rama redo", () => {
    const { result } = renderHook(() => useLessonEditor({ title: "T", blocks: [texto()] }))
    act(() => result.current.setTitle("T2"))
    act(() => result.current.undo())
    act(() => result.current.setTitle("T3"))
    expect(result.current.title).toBe("T3")
    expect(result.current.puedeRehacer).toBe(false)
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
      version: 2,
      blocks: [{ id: "b1", type: "text", html: "Hola" }],
    })
  })
})

// ====================================================================
// EDGE / ADVERSARIAL BATTERY — historial y mutaciones no-op
// ====================================================================
describe("useLessonEditor — edge/adversarial", () => {
  it("moveBlock no-op en extremo NO marca dirty", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), texto2] }))
    // estado inicial limpio
    expect(result.current.dirty).toBe(false)
    act(() => result.current.moveBlock("b1", -1))
    expect(result.current.blocks.map((b) => b.id)).toEqual(["b1", "b2"])
    expect(result.current.dirty).toBe(false)
  })

  it("moveBlock con id inexistente NO marca dirty", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), texto2] }))
    act(() => result.current.moveBlock("nope", 1))
    expect(result.current.dirty).toBe(false)
  })

  it("reorder no-op (id inexistente) NO marca dirty", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), texto2] }))
    act(() => result.current.reorder("nope", "b2"))
    expect(result.current.dirty).toBe(false)
  })

  it("reorder con activeId===overId es no-op y no marca dirty", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto(), texto2] }))
    act(() => result.current.reorder("b1", "b1"))
    expect(result.current.dirty).toBe(false)
  })

  it("historial se capea en 50 estados (el más viejo se descarta)", () => {
    const { result } = renderHook(() => useLessonEditor({ title: "T0", blocks: [] }))
    for (let i = 1; i <= 51; i++) {
      act(() => result.current.setTitle(`T${i}`))
    }
    // 50 undos disponibles como máximo
    let undos = 0
    while (result.current.puedeDeshacer) {
      act(() => result.current.undo())
      undos++
      if (undos > 60) break
    }
    expect(undos).toBeLessThanOrEqual(50)
    expect(result.current.title).not.toBe("T0")
  })

  it("addBlock más allá de maxBlocks deja documento inválido (no crashea)", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [] }))
    for (let i = 0; i < 101; i++) {
      act(() => result.current.addBlock("text"))
    }
    expect(result.current.blocks).toHaveLength(101)
    expect(result.current.valido).toBe(false)
    expect(result.current.documento).toBeNull()
  })

  it("setTitle vacío marca dirty y documento sigue válido (título no valida el doc)", () => {
    const { result } = renderHook(() => useLessonEditor({ title: "T", blocks: [texto()] }))
    act(() => result.current.setTitle(""))
    expect(result.current.dirty).toBe(true)
  })

  it("setBlock con id inexistente no cambia nada ni marca dirty", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto()] }))
    act(() => result.current.setBlock("nope", texto()))
    expect(result.current.blocks).toHaveLength(1)
    expect(result.current.dirty).toBe(false)
  })

  it("undo tras markSaved marca dirty (el doc difiere del guardado)", () => {
    const { result } = renderHook(() => useLessonEditor({ title: "T", blocks: [texto()] }))
    act(() => result.current.setTitle("T2"))
    act(() => result.current.markSaved())
    expect(result.current.dirty).toBe(false)
    act(() => result.current.undo())
    expect(result.current.title).toBe("T")
    expect(result.current.dirty).toBe(true)
  })

  it("markSaved dos veces no rompe", () => {
    const { result } = renderHook(() => useLessonEditor({ blocks: [texto()] }))
    act(() => result.current.addBlock("text"))
    act(() => result.current.markSaved())
    act(() => result.current.markSaved())
    expect(result.current.dirty).toBe(false)
  })

  it("redo tras nueva edición se descarta", () => {
    const { result } = renderHook(() => useLessonEditor({ title: "T", blocks: [texto()] }))
    act(() => result.current.setTitle("T2"))
    act(() => result.current.undo())
    expect(result.current.puedeRehacer).toBe(true)
    act(() => result.current.setTitle("T3"))
    expect(result.current.puedeRehacer).toBe(false)
  })
})
