/**
 * Constantes compartidas del bloque de texto (browser-safe).
 *
 * El bloque de texto vive en HTML directo (sin round-trip markdown):
 * - El editor lo produce con Tiptap (getHTML()).
 * - El servidor lo sanitizea antes de guardarlo.
 * - El estudiante lo renderiza con dangerouslySetInnerHTML.
 *
 * Una sola especificación visual (TEXT_BLOCK_PROSE) para los tres lados:
 * la fuente del editor y la del curso son idénticas.
 */

/** Tags permitidos en el bloque de texto. Fuente única (la valida el sanitizer). */
export const TEXT_BLOCK_ALLOWED_TAGS = ["p", "h1", "h2", "h3", "ul", "li", "strong", "em", "br", "span", "b", "i"] as const

/** Clases Tailwind aplicadas al contenedor del bloque de texto en los 3 lados. */
export const TEXT_BLOCK_PROSE =
  "leading-relaxed [&_p]:mb-3 [&_h1]:font-serif [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 " +
  "[&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 " +
  "[&_h3]:font-serif [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1.5 " +
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_li]:mb-1"
