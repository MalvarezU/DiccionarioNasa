import { describe, it, expect } from "vitest"
import { PLANTILLAS_LECCION, plantillaPorId } from "./templates"
import { parseLessonContent } from "./blocks"

describe("plantillas de leccion", () => {
  it("cada plantilla pasa el contrato de parseLessonContent", () => {
    for (const p of PLANTILLAS_LECCION) {
      const r = parseLessonContent({ version: 2, blocks: p.bloques })
      expect(r.ok, `plantilla "${p.id}" invalida`).toBe(true)
    }
  })

  it("ids de bloques unicos dentro de cada plantilla", () => {
    for (const p of PLANTILLAS_LECCION) {
      const ids = p.bloques.map((b) => b.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("plantillaPorId encuentra y devuelve undefined para desconocida", () => {
    expect(plantillaPorId("texto")?.nombre).toBe("Texto simple")
    expect(plantillaPorId("no-existe")).toBeUndefined()
  })

  it("la plantilla vacia tiene 0 bloques", () => {
    expect(plantillaPorId("vacia")?.bloques).toHaveLength(0)
  })
})