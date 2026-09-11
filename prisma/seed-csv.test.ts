import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { parseSeedCSV } from "./seed-csv"

describe("prisma/seed-csv — parser real con comillas [B1.11]", () => {
  it("no corrompe campos con comas entre comillas (bug del split)", () => {
    const csv = [
      "nasaYuwe,spanish,category,pronunciation,culturalContext,examples",
      '"Açe",Odiar,verbo,"açe","Palabra de la lengua Nasa Yuwe, dialecto Wila",[]',
    ].join("\n")

    const { words, skippedDup } = parseSeedCSV(csv)

    expect(skippedDup).toBe(0)
    expect(words).toHaveLength(1)
    expect(words[0]).toMatchObject({
      spanish: "Odiar",
      nasaYuwe: "Açe",
      category: "verbo",
      culturalContext: "Palabra de la lengua Nasa Yuwe, dialecto Wila",
    })
  })

  it("omite duplicados por español insensible a mayúsculas", () => {
    const csv = [
      "nasaYuwe,spanish",
      "Yat,Casa",
      "Yat2,CASA",
      "Yu,Agua",
    ].join("\n")

    const { words, skippedDup } = parseSeedCSV(csv)

    expect(words.map((w) => w.spanish)).toEqual(["Casa", "Agua"])
    expect(skippedDup).toBe(1)
  })

  it("sanea ejemplos a JSON válido y defaultea campos", () => {
    const csv = [
      "nasaYuwe,spanish",
      "Yat,Casa",
    ].join("\n")

    const { words } = parseSeedCSV(csv)

    expect(words[0].examples).toBe("[]")
    expect(words[0].category).toBe("sustantivo")
    expect(words[0].pronunciation).toBe("yat")
  })

  it("parsea el corpus real: 351 únicas + 18 sentidos duplicados, ejemplos intactos", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "seed-data.csv"),
      "utf-8"
    )
    const { words, skippedDup } = parseSeedCSV(content)

    // El corpus trae 18 sentidos legítimos repetidos (ej. "Separar"×3):
    // se omiten con reporte (CA-33) para revisión del referente Nasa.
    expect(words.length).toBe(351)
    expect(skippedDup).toBe(18)
    // Ningún ejemplo corrupto por comas (todas las filas: JSON válido)
    for (const w of words) {
      expect(() => JSON.parse(w.examples)).not.toThrow()
    }
    // La fila problemática de la matriz conserva su contexto completo
    const odiar = words.find((w) => w.spanish === "Odiar")
    expect(odiar?.culturalContext).toContain("dialecto Wila")
    // Sin comillas literales heredadas del parser ingenuo
    for (const w of words) {
      expect(w.spanish.startsWith('"')).toBe(false)
    }
  })
})
