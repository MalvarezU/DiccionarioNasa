import { describe, it, expect } from "vitest"
import {
  detectColumns,
  normalizeStatus,
  validateRow,
} from "./import-helpers"

describe("import-helpers [B1.10]", () => {
  it("valida fila mínima y aplica BORRADOR por defecto", () => {
    const r = validateRow({ spanish: "casa", nasaYuwe: "ya:t" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe("DRAFT")
      expect(r.data.spanish).toBe("casa")
    }
  })

  it("rechaza sin obligatorios", () => {
    expect(validateRow({ spanish: "casa" }).ok).toBe(false)
    expect(validateRow({}).ok).toBe(false)
  })

  it("mapea encabezados ES variados", () => {
    const r = validateRow({
      Palabra_esp: "sol",
      "Palabra_nyW": "kiwe",
      Categoría: "sustantivo",
      Estado: "PUBLICADA",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.nasaYuwe).toBe("kiwe")
      expect(r.data.category).toBe("sustantivo")
      expect(r.data.status).toBe("PUBLISHED")
    }
  })

  it("normaliza estados ES/EN y defaultea a DRAFT", () => {
    expect(normalizeStatus("BORRADOR")).toBe("DRAFT")
    expect(normalizeStatus("archivada")).toBe("ARCHIVED")
    expect(normalizeStatus("publicada")).toBe("PUBLISHED")
    expect(normalizeStatus("???")).toBe("DRAFT")
    expect(normalizeStatus(undefined)).toBe("DRAFT")
  })

  it("normaliza ejemplos array y JSON", () => {
    const a = validateRow({
      spanish: "x",
      nasaYuwe: "y",
      examples: [{ spanish: "hola", nasaYuwe: "" }],
    })
    expect(a.ok && a.data.examples).toContain("hola")

    const b = validateRow({ spanish: "x", nasaYuwe: "y", examples: "texto plano" })
    expect(b.ok && b.data.examples).toContain("texto plano")
  })

  it("detecta columnas conocidas y marca desconocidas", () => {
    const cols = detectColumns(["Palabra_esp", "Palabra_nyW", "ColumnaRara"])
    expect(cols).toEqual([
      { header: "Palabra_esp", mapped: "spanish" },
      { header: "Palabra_nyW", mapped: "nasaYuwe" },
      { header: "ColumnaRara", mapped: null },
    ])
  })
})
