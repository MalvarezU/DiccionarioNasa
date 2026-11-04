/**
 * Convierte el HTML que emite el editor rico a texto plano.
 *
 * Se usa al guardar las instrucciones de los bloques interactivos (prompt del
 * quiz, question de escucha): son texto de instrucción, no contenido rico; el
 * estudiante las renderiza como texto literal (`{q.prompt}` en JSX, que
 * escapa HTML). Si se guardara el HTML del editor, en pantalla se vería
 * `<p>¿Cómo se dice?</p>`.
 *
 * Criterio de conversión: cada elemento de BLOQUE (p, títulos, ítem, etc.) o
 * un `<br>` aporta UN espacio de separación, solo si ya hay texto real antes.
 * El render del estudiante usa `white-space` normal y no preserva `\n`, así
 * que guardamos exactamente lo que se va a mostrar:
 * `<p>hola</p><p>mundo</p>` → `hola mundo` (no `hola\nmundo`).
 *
 * Sin trim del borde: la conversión corre en cada tipeo y el espacio que el
 * docente acaba de escribir quedaría comido hasta el siguiente carácter. El
 * trim lo hace igual el validador del API (`readString`) al guardar.
 *
 * El formato inline (strong, em…) no sobrevive por diseño: la instrucción es
 * texto, así que el contenido se conserva y el tag se descarta.
 */

/** Elementos de bloque: aportan separación de espacio respecto al contenido previo. */
const BLOQUES = new Set<string>([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "div",
  "pre",
])

/**
 * Espacio de separación solo si ya hay contenido real detrás y no hay uno ya.
 * Sin esto, los bordes del documento quedan con espacios fantasmas: el
 * primero (antes del primer bloque) y el último (después del último).
 */
function separa(out: string[]): void {
  const ultimo = out[out.length - 1]
  if (ultimo !== undefined && ultimo !== " ") {
    out.push(" ")
  }
}

function textoDeNodo(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.textContent ?? "")
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return
  }
  const tag = (node as Element).tagName.toLowerCase()
  if (tag === "br") {
    separa(out)
    return
  }
  if (!BLOQUES.has(tag)) {
    // Elemento inline: concatenar directo (el formato se pierde, el texto no).
    node.childNodes.forEach((child) => textoDeNodo(child, out))
    return
  }
  // Bloque: separa del contenido anterior y agrega su texto interno.
  separa(out)
  node.childNodes.forEach((child) => textoDeNodo(child, out))
}

export function htmlToPlainText(html: string): string {
  if (!html) {
    return ""
  }
  // El editor corre client-only (Tiptap con `immediatelyRender: false`), así
  // que DOMParser siempre está disponible en el punto donde se llama.
  const doc = new DOMParser().parseFromString(html, "text/html")
  const out: string[] = []
  doc.body.childNodes.forEach((child) => textoDeNodo(child, out))
  return out.join("").replace(/\s+/g, " ")
}
