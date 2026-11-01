import { describe, it, expect } from "vitest"
import { markdownToHtml } from "./legacy-markdown-to-html"

describe("markdownToHtml (migración v1→v2)", () => {
  it("título h1", () => {
    expect(markdownToHtml("# H")).toBe("<h1>H</h1>")
  })
  it("título h2/h3", () => {
    expect(markdownToHtml("## H2")).toBe("<h2>H2</h2>")
    expect(markdownToHtml("### H3")).toBe("<h3>H3</h3>")
  })
  it("párrafo", () => {
    expect(markdownToHtml("hola mundo")).toBe("<p>hola mundo</p>")
  })
  it("lista de viñetas", () => {
    expect(markdownToHtml("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>")
  })
  it("negrita y cursiva", () => {
    expect(markdownToHtml("**x** *y*")).toBe("<p><strong>x</strong> <em>y</em></p>")
  })
  it("negrita+cursiva combinadas", () => {
    expect(markdownToHtml("***z***")).toBe("<p><strong><em>z</em></strong></p>")
  })
  it("escapa HTML del texto (anti-XSS en legacy)", () => {
    expect(markdownToHtml("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>")
  })
  it("documento compuesto", () => {
    expect(markdownToHtml("# T\n\nPárrafo.\n\n- uno\n- dos")).toBe(
      "<h1>T</h1><p>Párrafo.</p><ul><li>uno</li><li>dos</li></ul>"
    )
  })
})
