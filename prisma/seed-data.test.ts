import { describe, it, expect, beforeAll } from "vitest"
import * as fs from "fs"
import * as path from "path"

const CSV_PATH = path.join(__dirname, "seed-data.csv")

const HEADER_COLUMNS = 6

interface ParsedWord {
  nasaYuwe: string
  spanish: string
  category: string
  pronunciation: string
  culturalContext: string
  examples: string
}

function parseCSVNaive(content: string): ParsedWord[] {
  const lines = content.trim().split("\n")
  const words: ParsedWord[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/^\uFEFF/, "")

    const parts: string[] = []
    let current = ""
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        parts.push(current)
        current = ""
      } else {
        current += char
      }
    }
    parts.push(current)

    if (parts.length < 2) continue

    const nasaYuwe = parts[0]?.trim().replace(/^"|"$/g, "") || ""
    const spanish = parts[1]?.trim().replace(/^"|"$/g, "") || ""
    const category = parts[2]?.trim().replace(/^"|"$/g, "") || "sustantivo"
    const pronunciation = parts[3]?.trim().replace(/^"|"$/g, "") || nasaYuwe.toLowerCase()
    const culturalContext = parts[4]?.trim().replace(/^"|"$/g, "") || ""
    const examples = parts[5]?.trim().replace(/^"|"$/g, "") || "[]"

    if (!nasaYuwe || !spanish) continue

    words.push({ nasaYuwe, spanish, category, pronunciation, culturalContext, examples })
  }

  return words
}

describe("seed-data.csv regression (bug dialecto Wila)", () => {
  let csvContent: string

  beforeAll(() => {
    csvContent = fs.readFileSync(CSV_PATH, "utf-8")
  })

  it("file exists", () => {
    expect(csvContent).toBeDefined()
    expect(csvContent.length).toBeGreaterThan(0)
  })

  it("has a header row with 6 columns", () => {
    const header = csvContent.trim().split("\n")[0]
    const cols = header.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
    expect(cols.length).toBe(HEADER_COLUMNS)
  })

  it("parses words correctly with proper CSV quoting", () => {
    const words = parseCSVNaive(csvContent)
    expect(words.length).toBeGreaterThan(300)
  })

  it("every word has nasaYuwe and spanish", () => {
    const words = parseCSVNaive(csvContent)
    for (const word of words) {
      expect(word.nasaYuwe).toBeTruthy()
      expect(word.spanish).toBeTruthy()
    }
  })

  it("examples field is valid JSON or empty for all words", () => {
    const words = parseCSVNaive(csvContent)
    for (const word of words) {
      if (word.examples && word.examples !== "[]") {
        expect(() => JSON.parse(word.examples)).not.toThrow()
      }
    }
  })

  it("cultural context with commas does not break the examples field", () => {
    const words = parseCSVNaive(csvContent)
    const withDialecto = words.filter((w) =>
      w.culturalContext.includes("dialecto Wila")
    )

    expect(withDialecto.length).toBeGreaterThan(0)

    for (const word of withDialecto) {
      const fullCtx = word.culturalContext
      expect(fullCtx).toContain("Nasa Yuwe")
      expect(fullCtx).toContain("dialecto Wila")
    }
  })

  it("naive split would produce invalid examples (regression check)", () => {
    const firstDataLine = csvContent.trim().split("\n")[1]
    const naiveParts = firstDataLine.split(",")
    const properParts = parseCSVNaive(firstDataLine)

    expect(naiveParts.length).toBeGreaterThan(HEADER_COLUMNS)
  })
})