import { describe, it, expect } from "vitest"
import { sanitizeLessonHtml, sanitizeLessonContent } from "./text-sanitizer"

describe("sanitizeLessonHtml", () => {
  // --- happy paths ---
  it("permite p, h1-h3, ul, li, strong, em, br, span, b, i", () => {
    const html = "<h1>T</h1><h2>S</h2><h3>U</h3><p>a <strong>b</strong> <em>c</em> <b>d</b> <i>e</i> <span>f</span><br /></p><ul><li>x</li></ul>"
    expect(sanitizeLessonHtml(html)).toBe(html)
  })

  it("texto plano pasa sin cambios", () => {
    expect(sanitizeLessonHtml("solo texto")).toBe("solo texto")
  })

  it("string vacío pasa", () => {
    expect(sanitizeLessonHtml("")).toBe("")
  })

  it("preserva entidades HTML", () => {
    expect(sanitizeLessonHtml("a &amp; b &lt; c")).toBe("a &amp; b &lt; c")
  })

  it("preserva espacios internos", () => {
    expect(sanitizeLessonHtml("<p>  texto con espacios  </p>")).toBe("<p>  texto con espacios  </p>")
  })

  it("<p></p> vacío se mantiene", () => {
    expect(sanitizeLessonHtml("<p></p>")).toBe("<p></p>")
  })

  it("normaliza <br>, <br/>, <br />", () => {
    expect(sanitizeLessonHtml("<br>")).toBe("<br />")
    expect(sanitizeLessonHtml("<br/>")).toBe("<br />")
    expect(sanitizeLessonHtml("<br />")).toBe("<br />")
  })

  // --- tags no permitidos ---
  it("remueve <script>", () => {
    expect(sanitizeLessonHtml("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>")
  })

  it("remueve <iframe>", () => {
    expect(sanitizeLessonHtml('<p>ok</p><iframe src="https://x"></iframe>')).toBe("<p>ok</p>")
  })

  it("remueve <div> pero conserva su texto", () => {
    expect(sanitizeLessonHtml("<div>hola</div>")).toBe("hola")
  })

  it("remueve <img> (no está en whitelist)", () => {
    expect(sanitizeLessonHtml('<img src="x" alt="y">')).toBe("")
  })

  it("remueve <a> (no está en whitelist — sin links por diseño)", () => {
    expect(sanitizeLessonHtml('<a href="https://x">link</a>')).toBe("link")
  })

  it("remueve <svg> y su contenido script", () => {
    expect(sanitizeLessonHtml('<svg><script>alert(1)</script></svg>')).toBe("")
  })

  it("remueve <form>, <input>, <button> (form es nonTextTag → descarta su contenido)", () => {
    expect(sanitizeLessonHtml('<form><input><button>x</button></form>')).toBe("")
    // button suelto (sin form) conserva su texto
    expect(sanitizeLessonHtml("<button>x</button>")).toBe("x")
  })

  it("remueve <style>", () => {
    expect(sanitizeLessonHtml("<style>body{color:red}</style><p>ok</p>")).toBe("<p>ok</p>")
  })

  // --- XSS variants ---
  it("remueve onerror de img (tag no permitido igual)", () => {
    expect(sanitizeLessonHtml('<img src="x" onerror="alert(1)">')).toBe("")
  })

  it("remueve event handlers de tags permitidos", () => {
    expect(sanitizeLessonHtml('<strong onclick="alert(1)">text</strong>')).toBe("<strong>text</strong>")
  })

  it("remueve style attribute (CSS injection)", () => {
    expect(sanitizeLessonHtml('<p style="background:url(javascript:alert(1))">text</p>')).toBe("<p>text</p>")
  })

  it("remueve data-* attributes", () => {
    expect(sanitizeLessonHtml('<p data-x="y" data-onload="z">text</p>')).toBe("<p>text</p>")
  })

  it("remueve href javascript: (tag a no permitido igual)", () => {
    expect(sanitizeLessonHtml('<a href="javascript:alert(1)">x</a>')).toBe("x")
  })

  it("remueve src javascript en img (tag no permitido)", () => {
    expect(sanitizeLessonHtml('<img src="javascript:alert(1)">')).toBe("")
  })

  it("maneja anidamiento malicioso (script descartado, texto del p conservado)", () => {
    expect(sanitizeLessonHtml('<div><script>alert(1)</script><p>ok</p></div>')).toBe("<p>ok</p>")
  })

  it("maneja tags con mayúsculas (sanitize-html lowercases)", () => {
    expect(sanitizeLessonHtml("<P>text</P><SCRIPT>x</SCRIPT>")).toBe("<p>text</p>")
  })

  it("maneja HTML malformado (tag sin cerrar)", () => {
    const out = sanitizeLessonHtml("<p>unclosed")
    expect(out).toContain("unclosed")
    expect(out).not.toContain("<script")
  })

  it("maneja atributo sin valor", () => {
    expect(sanitizeLessonHtml('<p disabled>text</p>')).toBe("<p>text</p>")
  })

  // --- mixed content ---
  it("mezcla válido e inválido", () => {
    expect(sanitizeLessonHtml("<p>ok</p><script>x</script><strong>y</strong>")).toBe("<p>ok</p><strong>y</strong>")
  })

  it("HTML con solo tags (sin texto) se mantiene", () => {
    expect(sanitizeLessonHtml("<p></p><strong></strong>")).toBe("<p></p><strong></strong>")
  })

  it("HTML muy largo (cerca del límite) no crashea", () => {
    const long = "<p>" + "a".repeat(39_990) + "</p>"
    const out = sanitizeLessonHtml(long)
    expect(out.length).toBeGreaterThan(0)
    expect(out).toContain("a")
  })
})

describe("sanitizeLessonContent", () => {
  it("sanitizea bloques text en el documento", () => {
    const content = { version: 2, blocks: [{ type: "text", html: "<p>ok</p><script>x</script>" }] }
    const out = sanitizeLessonContent(content as any)
    expect((out.blocks[0] as any).html).toBe("<p>ok</p>")
  })

  it("no toca bloques que no son text", () => {
    const content = { version: 2, blocks: [{ type: "image", url: "https://x.png", alt: "y" }] }
    const out = sanitizeLessonContent(content as any)
    expect((out.blocks[0] as any).url).toBe("https://x.png")
  })

  it("ignora html que no es string", () => {
    const content = { version: 2, blocks: [{ type: "text", html: 123 }] }
    const out = sanitizeLessonContent(content as any)
    expect((out.blocks[0] as any).html).toBe(123)
  })

  it("muta in place y devuelve el mismo objeto", () => {
    const content = { version: 2, blocks: [{ type: "text", html: "<p>x</p>" }] }
    const out = sanitizeLessonContent(content as any)
    expect(out).toBe(content)
  })

  it("maneja documento sin bloques", () => {
    const content = { version: 2, blocks: [] }
    const out = sanitizeLessonContent(content as any)
    expect(out.blocks).toHaveLength(0)
  })
})
