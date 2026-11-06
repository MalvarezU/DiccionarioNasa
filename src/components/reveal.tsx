"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type JSX,
  type ReactNode,
} from "react"

export type RevealDelay = 0 | 80 | 160

interface RevealProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Tag contenedor. Div por defecto; `section` para regiones con nombre. */
  as?: keyof JSX.IntrinsicElements
  /** Retardo de entrada. Discreto (0/80/160) para escalonados cortos. */
  delay?: RevealDelay
  children: ReactNode
}

/**
 * Reveal on scroll (B2): envuelve una sección y la muestra con fade +
 * translateY 12px→0 cuando entra al viewport, una sola vez
 * (IntersectionObserver con threshold ~0.15 + `unobserve` vía disconnect).
 *
 * - Respeta `prefers-reduced-motion`: con reducción activa muestra directo
 *   sin observar (el media query se escucha acá, no solo en CSS).
 * - Accesible: el contenido siempre está en el DOM; solo animan
 *   opacity/transform (sin layout shift).
 */
export function Reveal({ as, delay = 0, className, children, ...rest }: RevealProps) {
  // El cast fija el tag para JSX (el linter exige `ref` sobre un host
  // estático, no dentro de un objeto para createElement); en runtime se
  // respeta el `as` recibido.
  const Tag = (as ?? "div") as "div"
  const targetRef = useRef<HTMLElement | null>(null)
  // Sin animación no hay nada que esperar: con reducción activa o sin
  // IntersectionObserver se arranca visible (lazy init, sin setState en
  // el efecto). El observer solo existe en el camino animado.
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return true
    }
    return typeof IntersectionObserver === "undefined"
  })

  const setTarget = useCallback((node: HTMLElement | null) => {
    targetRef.current = node
  }, [])

  useEffect(() => {
    if (visible) return
    const node = targetRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      {...rest}
      ref={setTarget}
      data-delay={delay}
      className={`reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </Tag>
  )
}
