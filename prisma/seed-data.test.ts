import { describe, it, expect, beforeAll } from "vitest"
import * as fs from "fs"
import * as path from "path"

const CSV_PATH = path.join(__dirname, "seed-data.csv")

const HEADER_COLUMNS = 6

/**
 * Parser CSV con soporte de comillas, equivalente al usado por `seed.ts`.
 * Se mantiene aquí (y no se reutiliza directamente) para validar la fuente
 * del seed contra el contrato de columnas esperado.
 */
function parseCSV(content: string): string[][] {
  const lines = content.trim().split("\n")
  const rows: string[][] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/^\uFEFF/, "")
    const parts: string[] = []
    let current = ""
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === "," && !inQuotes) {
        parts.push(current)
        current = ""
      } else {
        current += ch
      }
    }
    parts.push(current)
    rows.push(parts)
  }
  return rows
}

describe("prisma/seed-data.csv — integridad de la fuente del seed", () => {
  let rows: string[][]

  beforeAll(() => {
    const csvContent = fs.readFileSync(CSV_PATH, "utf-8")
    rows = parseCSV(csvContent)
  })

  it("contiene más de 300 palabras", () => {
    expect(rows.length).toBeGreaterThan(300)
  })

  it("cada fila tiene el número de columnas esperado", () => {
    for (const row of rows) {
      expect(row.length).toBe(HEADER_COLUMNS)
    }
  })

  it("cada palabra tiene nasaYuwe y spanish", () => {
    for (const row of rows) {
      const nasaYuwe = row[0]?.trim().replace(/^"|"$/g, "")
      const spanish = row[1]?.trim().replace(/^"|"$/g, "")
      expect(nasaYuwe).toBeTruthy()
      expect(spanish).toBeTruthy()
    }
  })

  it("las filas con examples no vacío y no '[ ]' son una minoría (el resto usa '[ ]')", () => {
    // El grueso del corpus no incluye ejemplos (campo '[ ]'). La app parsea
    // `examples` de forma defensiva en runtime (`safeParseExamples`), por lo que
    // aquí solo se valida la estructura del CSV, no el contenido JSON de `examples`.
    const withExamples = rows.filter((r) => {
      const examples = r[5]?.trim().replace(/^"|"$/g, "")
      return examples && examples !== "[]"
    })
    expect(withExamples.length).toBeLessThan(rows.length)
    expect(withExamples.length).toBeLessThan(20)
  })
})
