/**
 * Markdown restringido para los bloques `text` de las lecciones.
 *
 * Se escribe a mano (sin librerías de markdown ni HTML) por dos razontes:
 * 1. Seguridad: el docente escribe y el estudiante renderiza. Un parser que
 *    devuelve TEXTO ESTRUCTURADO (no HTML) no puede inyectar nada — React
 *    escapa los strings al renderizar. `dangerouslySetInnerHTML` no existe acá.
 * 2. Control: solo lo que un docente de lengua necesita — títulos, listas,
 *    negrita y cursiva. Nada más reduce sorpresas.
 *
 * Sintaxis soportada:
 *   # Título 1  ## Título 2  ### Título 3
 *   párrafos (líneas contiguas se unen)
 *   - ítems de lista
 *   **negrita**  *cursiva*
 */

export type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }

export type InlineToken = { text: string; bold?: boolean; italic?: boolean }

/** Parsea el documento por bloques. Nunca lanza; entrada rara -> texto literal. */
export function parseMarkdownLite(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []

  let párrafo: string[] = []
  let lista: string[] = []

  const vaciarPárrafo = () => {
    if (párrafo.length > 0) {
      blocks.push({ kind: "paragraph", text: párrafo.join(" ") })
      párrafo = []
    }
  }
  const vaciarLista = () => {
    if (lista.length > 0) {
      blocks.push({ kind: "list", items: [...lista] })
      lista = []
    }
  }

  for (const líneaBruta of (markdown ?? "").split(/\r?\n/)) {
    const línea = líneaBruta.trim()

    if (línea === "") {
      vaciarPárrafo()
      vaciarLista()
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(línea)
    if (heading) {
      vaciarPárrafo()
      vaciarLista()
      const level = heading[1]!.length as 1 | 2 | 3
      blocks.push({ kind: "heading", level, text: heading[2]!.trim() })
      continue
    }

    if (línea.startsWith("- ")) {
      vaciarPárrafo()
      lista.push(línea.slice(2).trim())
      continue
    }

    // Línea de texto: cierra la lista abierta y añade al párrafo actual.
    vaciarLista()
    párrafo.push(línea)
  }

  vaciarPárrafo()
  vaciarLista()

  return blocks
}

/**
 * Divide una línea en tokens de negrita/cursiva. Los marcadores sin pareja
 * quedan como texto literal (no se pierde nada).
 */
export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = []
  let buffer = ""
  let i = 0

  while (i < text.length) {
    // Negrita primero: "**" contendría a un "*" suelto, hay que probarlo antes.
    if (text.startsWith("**", i)) {
      const cierre = text.indexOf("**", i + 2)
      if (cierre !== -1) {
        if (buffer) out.push({ text: buffer })
        buffer = ""
        out.push({ text: text.slice(i + 2, cierre), bold: true })
        i = cierre + 2
        continue
      }
    }
    if (text[i] === "*") {
      const cierre = text.indexOf("*", i + 1)
      if (cierre !== -1 && cierre > i + 1) {
        if (buffer) out.push({ text: buffer })
        buffer = ""
        out.push({ text: text.slice(i + 1, cierre), italic: true })
        i = cierre + 1
        continue
      }
    }
    buffer += text[i]
    i++
  }
  if (buffer) out.push({ text: buffer })

  return unirTokensPlanos(out)
}

// Dos tokens de texto seguidos se unen, para no iterar más de lo necesario
// en el render.
function unirTokensPlanos(tokens: InlineToken[]): InlineToken[] {
  const out: InlineToken[] = []
  for (const t of tokens) {
    const anterior = out[out.length - 1]
    if (!t.bold && !t.italic && anterior && !anterior.bold && !anterior.italic) {
      out[out.length - 1] = { text: anterior.text + t.text }
    } else {
      out.push(t)
    }
  }
  return out
}
