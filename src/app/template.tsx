import type { ReactNode } from "react"

/**
 * Reveal sutil de página (F5): cada navegación remonta este wrapper y
 * re-ejecuta `.anim-page-reveal` (fade + translateY 12px→0, 300ms).
 * Solo opacity/transform: sin layout shift. Con
 * `prefers-reduced-motion` la animación no se genera (gated en globals.css).
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="anim-page-reveal">{children}</div>
}
