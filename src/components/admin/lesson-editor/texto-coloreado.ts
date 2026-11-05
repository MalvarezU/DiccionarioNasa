import { Mark, mergeAttributes } from "@tiptap/core"

import { TEXT_COLOR_TOKENS, type TextColorToken } from "@/lib/courses/lesson-html"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textoColoreado: {
      /** Aplica el token de color a la selección (o stored mark si colapsada). */
      setColor: (color: TextColorToken) => ReturnType
      /** Quita el color de la selección. */
      unsetColor: () => ReturnType
    }
  }
}

/**
 * Mark custom de color de fuente (F13b).
 *
 * Guarda el TOKEN en `data-color` (`<span data-color="oliva">`), NUNCA
 * `style="color:"` ni hex: el inline style lo descartaría el sanitizer y
 * rompería el round-trip editor → BD → curso. El color real lo pinta
 * `globals.css` (una regla por token), así los tres lados comparten render.
 *
 * Solo parsea `span[data-color]` con token válido: cualquier otro valor se
 * ignora y el texto queda sin marca (el sanitizer ya lo limpió al guardar).
 */
export const TextoColoreado = Mark.create({
  name: "textoColoreado",

  addAttributes() {
    return {
      "data-color": {
        default: null,
        parseHTML: (element) => {
          const valor = element.getAttribute("data-color")
          return (TEXT_COLOR_TOKENS as readonly string[]).includes(valor ?? "")
            ? valor
            : null
        },
        renderHTML: (attributes) => {
          const valor = attributes["data-color"] as string | null
          return (TEXT_COLOR_TOKENS as readonly string[]).includes(valor ?? "")
            ? { "data-color": valor }
            : {}
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-color]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setColor:
        (color) =>
        ({ commands }) =>
          commands.setMark(this.name, { "data-color": color }),
      unsetColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
