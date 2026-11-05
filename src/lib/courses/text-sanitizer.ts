import sanitizeHtml from "sanitize-html"

import { TEXT_BLOCK_ALLOWED_TAGS, TEXT_COLOR_TOKENS } from "./lesson-html"

/** Tokens exactos que puede llevar `data-color` (F13b). Cualquier otro valor se limpia. */
const TOKENS_COLOR = new Set<string>(TEXT_COLOR_TOKENS)

/**
 * Sanitiza el HTML de un bloque de texto ANTES de guardarlo.
 *
 * Server-only (importa sanitize-html, que es Node-only). La única puerta de
 * entrada de contenido rico es la API PUT /api/lessons/[id], así que el
 * sanitizer corre ahí y lo que llega a la BD ya es inofensivo.
 *
 * Whitelist cerrada: 12 tags, cero atributos salvo `data-color` en `span`
 * (y solo con uno de los 10 tokens exactos). <script>, <img onerror>,
 * <a href="javascript:">, <iframe>, style=, etc. se descartan.
 */
export function sanitizeLessonHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [...TEXT_BLOCK_ALLOWED_TAGS],
    allowedAttributes: { span: ["data-color"] },
    transformTags: {
      // sanitize-html valida valores con match exacto pero deja el atributo
      // vacío cuando no coincide; acá se elimina del todo para que el HTML
      // guardado quede limpio (`<span>x</span>`, el texto sobrevive).
      span: (tagName, attribs) => {
        if (attribs["data-color"] !== undefined && !TOKENS_COLOR.has(attribs["data-color"])) {
          delete attribs["data-color"]
        }
        return { tagName, attribs }
      },
    },
    nonTextTags: ["script", "style", "iframe", "object", "embed", "form"],
  })
}

export function sanitizeLessonContent(content: { version: number; blocks: Array<{ type: string; [k: string]: unknown }> }) {
  for (const b of content.blocks) {
    if (b.type === "text" && typeof b.html === "string") {
      b.html = sanitizeLessonHtml(b.html)
    }
  }
  return content
}
