import { describe, it, expect } from "vitest"
import { parseMarkdownLite, parseInline } from "./markdown-lite"

describe("parseMarkdownLite — estructura por bloques", () => {
  it("documento completo: título, párrafo, lista y segundo párrafo", () => {
    const md = "# Nasa Yuwe\n\nEl agua es *yu*.\nCon \ncontinuación.\n\n- casa\n- agua\n\n# Otra"
    expect(parseMarkdownLite(md)).toEqual([
      { kind: "heading", level: 1, text: "Nasa Yuwe" },
      { kind: "paragraph", text: "El agua es *yu*. Con continuación." },
      { kind: "list", items: ["casa", "agua"] },
      { kind: "heading", level: 1, text: "Otra" },
    ])
  })

  it("niveles de título 1, 2 y 3", () => {
    const r = parseMarkdownLite("# a\n## b\n### c")
    expect(r).toEqual([
      { kind: "heading", level: 1, text: "a" },
      { kind: "heading", level: 2, text: "b" },
      { kind: "heading", level: 3, text: "c" },
    ])
  })

  it("una línea de lista sigue a otro tipo sin quedarse enganchada", () => {
    const r = parseMarkdownLite("parrafo\n- item")
    expect(r).toEqual([
      { kind: "paragraph", text: "parrafo" },
      { kind: "list", items: ["item"] },
    ])
  })

  it("una lista puede continuar bajo un título mezclado", () => {
    // "-", luego "#", luego "-": dos listas separadas, nada se pierde.
    const r = parseMarkdownLite("- a\n# t\n- b")
    expect(r).toEqual([
      { kind: "list", items: ["a"] },
      { kind: "heading", level: 1, text: "t" },
      { kind: "list", items: ["b"] },
    ])
  })

  it("entrada rara NO lanza y se trata como texto literal", () => {
    expect(parseMarkdownLite("")).toEqual([])
    expect(parseMarkdownLite("   \n  \t ")).toEqual([])
    expect(parseMarkdownLite("una sola línea")).toEqual([
      { kind: "paragraph", text: "una sola línea" },
    ])
  })

  it("#### (4 almohadillas) NO es título: es un párrafo literal", () => {
    const r = parseMarkdownLite("#### a")
    expect(r).toEqual([{ kind: "paragraph", text: "#### a" }])
  })
})

describe("parseInline — negrita y cursiva", () => {
  it("negrita en el medio", () => {
    expect(parseInline("A **b** C")).toEqual([
      { text: "A " },
      { text: "b", bold: true },
      { text: " C" },
    ])
  })

  it("cursiva", () => {
    expect(parseInline("a *i* b")).toEqual([
      { text: "a " },
      { text: "i", italic: true },
      { text: " b" },
    ])
  })

  it("negrita que contiene asteriscos internos", () => {
    expect(parseInline("**x *y* z** t")).toEqual([
      { text: "x *y* z", bold: true },
      { text: " t" },
    ])
  })

  it("marcador sin pareja queda como texto literal", () => {
    expect(parseInline("a **b")).toEqual([{ text: "a **b" }])
    expect(parseInline("a *b")).toEqual([{ text: "a *b" }])
  })

  it("texto sin marcado se devuelve en un solo token", () => {
    expect(parseInline("solo texto")).toEqual([{ text: "solo texto" }])
  })

  it("entrada vacía", () => {
    expect(parseInline("")).toEqual([])
  })
})
