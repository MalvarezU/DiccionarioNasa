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

/**
 * Tokens de color de fuente (F13b). En el HTML guardado viaja el TOKEN en
 * `data-color` (nunca `style="color:"` ni hex): el color real vive en
 * `globals.css`, una sola vez para editor, vista previa y curso.
 */
export const TEXT_COLOR_TOKENS = [
  "rojo",
  "naranja",
  "amarillo",
  "verde",
  "azul",
  "violeta",
  "slate",
  "oliva",
  "tierra",
  "ladrillo",
] as const

export type TextColorToken = (typeof TEXT_COLOR_TOKENS)[number]

/** Muestra del dropdown: hex directos para estándar, tokens de paleta para los de marca. */
export const TEXT_COLOR_SWATCH: Record<TextColorToken, string> = {
  rojo: "#dc2626",
  naranja: "#ea580c",
  amarillo: "#ca8a04",
  verde: "#16a34a",
  azul: "#2563eb",
  violeta: "#7c3aed",
  slate: "var(--primary)",
  oliva: "var(--secondary)",
  tierra: "var(--tertiary)",
  ladrillo: "var(--destructive)",
}

/** Clases Tailwind aplicadas al contenedor del bloque de texto en los 3 lados. */
export const TEXT_BLOCK_PROSE =
  "leading-relaxed [&_p]:mb-3 [&_h1]:font-serif [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 " +
  "[&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 " +
  "[&_h3]:font-serif [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1.5 " +
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_li]:mb-1"
