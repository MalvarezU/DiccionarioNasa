import sanitizeHtml from "sanitize-html"

import { TEXT_BLOCK_ALLOWED_TAGS } from "./lesson-html"

/**
 * Sanitiza el HTML de un bloque de texto ANTES de guardarlo.
 *
 * Server-only (importa sanitize-html, que es Node-only). La única puerta de
 * entrada de contenido rico es la API PUT /api/lessons/[id], así que el
 * sanitizer corre ahí y lo que llega a la BD ya es inofensivo.
 *
 * Whitelist cerrada: 12 tags, cero atributos. <script>, <img onerror>,
 * <a href="javascript:">, <iframe>, style=, etc. se descartan.
 */
export function sanitizeLessonHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [...TEXT_BLOCK_ALLOWED_TAGS],
    allowedAttributes: {},
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
