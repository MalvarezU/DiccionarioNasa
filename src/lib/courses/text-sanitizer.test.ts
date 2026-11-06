import { describe, it, expect } from "vitest"
import { sanitizeLessonHtml, sanitizeLessonContent } from "./text-sanitizer"
import { TEXT_COLOR_TOKENS } from "./lesson-html"

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
    expect(sanitizeLessonHtml("<svg><script>alert(1)</script></svg>")).toBe("")
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

describe("sanitizeLessonHtml — colores de fuente (F13b)", () => {
  it("preserva los 10 tokens de data-color en span", () => {
    expect(TEXT_COLOR_TOKENS).toHaveLength(10)
    for (const token of TEXT_COLOR_TOKENS) {
      expect(sanitizeLessonHtml(`<p><span data-color="${token}">x</span></p>`)).toBe(
        `<p><span data-color="${token}">x</span></p>`
      )
    }
  })

  it("limpia valor inventado a span sin atributo (el texto sobrevive)", () => {
    expect(sanitizeLessonHtml('<p><span data-color="fucsia">x</span></p>')).toBe(
      "<p><span>x</span></p>"
    )
  })

  it("descarta style=color aunque el tag sea válido", () => {
    expect(sanitizeLessonHtml('<p><span style="color:red">x</span></p>')).toBe(
      "<p><span>x</span></p>"
    )
    expect(sanitizeLessonHtml('<p style="color:#dc2626">x</p>')).toBe("<p>x</p>")
  })

  it("no acepta data-color en otros tags", () => {
    expect(sanitizeLessonHtml('<p data-color="rojo">x</p>')).toBe("<p>x</p>")
    expect(sanitizeLessonHtml('<strong data-color="rojo">x</strong>')).toBe(
      "<strong>x</strong>"
    )
  })

  it("data-color válido sobrevive junto a texto y otros marks", () => {
    expect(
      sanitizeLessonHtml('<p>a <strong><span data-color="oliva">b</span></strong> c</p>')
    ).toBe('<p>a <strong><span data-color="oliva">b</span></strong> c</p>')
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

// ====================================================================
// EDGE / ADVERSARIAL BATTERY — frontera de seguridad del bloque de texto
// ====================================================================
describe("sanitizeLessonHtml — edge/adversarial", () => {
  it("descarta script inline en cualquier combinación de mayúsculas", () => {
    expect(sanitizeLessonHtml("<SCRIPT>alert(1)</SCRIPT>")).toBe("")
    expect(sanitizeLessonHtml("<ScRiPt>alert(1)</sCrIpT>")).toBe("")
  })

  it("script vacío o con solo whitespace", () => {
    expect(sanitizeLessonHtml("<script>   </script>")).toBe("")
    expect(sanitizeLessonHtml("<script></script>")).toBe("")
  })

  it("script dentro de un p permitido se descarta completo (nonTextTags)", () => {
    expect(sanitizeLessonHtml("<p>ok</p><script>alert(1)</script><p>fin</p>")).toBe("<p>ok</p><p>fin</p>")
  })

  it("iframe, object, embed, form se descartan con su contenido", () => {
    expect(sanitizeLessonHtml('<iframe src="https://evil.com"></iframe>')).toBe("")
    expect(sanitizeLessonHtml('<object data="x"><param name="y" /></object>')).toBe("")
    expect(sanitizeLessonHtml('<embed src="x.swf" />')).toBe("")
    expect(sanitizeLessonHtml('<form action="evil"><input /></form>')).toBe("")
  })

  it("svg con script anidado se descarta entero (svg no whitelisted)", () => {
    expect(sanitizeLessonHtml("<svg><script>alert(1)</script></svg>")).toBe("")
    expect(sanitizeLessonHtml('<svg onload="alert(1)">x</svg>')).toBe("x")
  })

  it("style tag se descarta con su CSS", () => {
    expect(sanitizeLessonHtml("<style>body{display:none}</style><p>x</p>")).toBe("<p>x</p>")
  })

  it("img no whitelisted se descarta entero (no queda onerror)", () => {
    const out = sanitizeLessonHtml('<img src="x" onerror="alert(1)">')
    expect(out).not.toContain("onerror")
    expect(out).not.toContain("img")
  })

  it("a con href javascript: se descarta (a no whitelisted)", () => {
    expect(sanitizeLessonHtml('<a href="javascript:alert(1)">x</a>')).toBe("x")
  })

  it("atributos en tags permitidos se eliminan (style, class, onclick, id)", () => {
    const out = sanitizeLessonHtml('<p style="color:red" class="x" onclick="alert(1)" id="y">t</p>')
    expect(out).toBe("<p>t</p>")
  })

  it("onmouseover/onfocus/etc. en span se eliminan", () => {
    expect(sanitizeLessonHtml('<span onmouseover="alert(1)" onfocus="alert(2)">t</span>')).toBe("<span>t</span>")
  })

  it("data-* attributes se eliminan", () => {
    expect(sanitizeLessonHtml('<p data-x="y">t</p>')).toBe("<p>t</p>")
  })

  it("href javascript en span no aplica (span no tiene attrs permitidos)", () => {
    expect(sanitizeLessonHtml('<span href="javascript:alert(1)">t</span>')).toBe("<span>t</span>")
  })

  it("HTML malformado no rompe ni deja tag colgado", () => {
    expect(sanitizeLessonHtml("<p><strong>negrita sin cerrar")).toBe("<p><strong>negrita sin cerrar</strong></p>")
    expect(sanitizeLessonHtml("<<script>alert(1)</script>")).toBe("&lt;")
    expect(sanitizeLessonHtml("<p>texto</p")).toBe("<p>texto</p>")
  })

  it("comentarios HTML se eliminan", () => {
    expect(sanitizeLessonHtml("<!-- <script>alert(1)</script> --><p>x</p>")).toBe("<p>x</p>")
  })

  it("CDATA no pasa como tag", () => {
    const out = sanitizeLessonHtml("<![CDATA[<script>alert(1)</script>]]>")
    expect(out).not.toContain("<script")
  })

  it("entidades que podrían recomponerse a tag no se interpretan", () => {
    // &lt;script&gt; ya es texto escapado; sanitizer no debe decodificarlo
    expect(sanitizeLessonHtml("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  it("null byte no se propaga", () => {
    const out = sanitizeLessonHtml("<p>a\u0000b</p>")
    expect(out).toContain("a")
    expect(out).toContain("b")
  })

  it("unicode line separators no rompen", () => {
    expect(sanitizeLessonHtml("<p>a\u2028b\u2029c</p>")).toBe("<p>a\u2028b\u2029c</p>")
  })

  it("tag desconocido se elimina pero conserva su texto", () => {
    expect(sanitizeLessonHtml("<foo>texto</foo>")).toBe("texto")
    expect(sanitizeLessonHtml("<custom-tag>x</custom-tag>")).toBe("x")
  })

  it("anidamiento profundo no rompe", () => {
    const deep = "<p>" + "<strong>".repeat(50) + "x" + "</strong>".repeat(50) + "</p>"
    const out = sanitizeLessonHtml(deep)
    expect(out).toContain("x")
  })

  it("payload de 40k chars no se trunca por el sanitizer (eso es del validador)", () => {
    const big = "<p>" + "a".repeat(40_000) + "</p>"
    expect(sanitizeLessonHtml(big).length).toBeGreaterThan(40_000)
  })

  it("br variants se normalizan siempre", () => {
    expect(sanitizeLessonHtml("<BR>")).toBe("<br />")
    expect(sanitizeLessonHtml("<Br/>")).toBe("<br />")
  })

  it("h1-h3 con attrs se limpian", () => {
    expect(sanitizeLessonHtml('<h1 onclick="x" style="y">t</h1>')).toBe("<h1>t</h1>")
  })

  it("ul/li con attrs se limpian", () => {
    expect(sanitizeLessonHtml('<ul class="x"><li onclick="y">z</li></ul>')).toBe("<ul><li>z</li></ul>")
  })

  it("span vacío se conserva", () => {
    expect(sanitizeLessonHtml("<span></span>")).toBe("<span></span>")
  })

  it("texto con < y > sueltos se escapa", () => {
    const out = sanitizeLessonHtml("5 < 10 && 20 > 5")
    expect(out).not.toContain("<10")
  })
})

describe("sanitizeLessonContent — edge", () => {
  it("sanitiza solo bloques type=text, deja el resto intacto", () => {
    const content = {
      version: 2,
      blocks: [
        { type: "text", html: "<p>x</p><script>alert(1)</script>" },
        { type: "image", url: "https://x/a.png", alt: "a" },
      ],
    }
    const out = sanitizeLessonContent(content as any)
    expect((out.blocks[0] as any).html).toBe("<p>x</p>")
    expect((out.blocks[1] as any).url).toBe("https://x/a.png")
  })

  it("no cae si html no es string en bloque text", () => {
    const content = { version: 2, blocks: [{ type: "text", html: 42 }] }
    const out = sanitizeLessonContent(content as any)
    expect((out.blocks[0] as any).html).toBe(42)
  })

  it("no cae si blocks no es array (no sanitiza, no tira)", () => {
    const content = { version: 2, blocks: null } as any
    expect(() => sanitizeLessonContent(content)).not.toThrow()
  })

  it("bloque con html vacío queda vacío", () => {
    const content = { version: 2, blocks: [{ type: "text", html: "" }] }
    const out = sanitizeLessonContent(content as any)
    expect((out.blocks[0] as any).html).toBe("")
  })
})
