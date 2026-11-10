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
 * - Anti-flicker: la animación de entrada solo ocurre en la primera carga
 *   de la página (F5). Una vez que algún Reveal se reveló en la sesión SPA,
 *   los montajes siguientes (navegaciones cliente) arrancan visibles de
 *   inmediato, sin flash de opacity:0. Es seguro para hidratación: en F5 el
 *   módulo se carga fresco (flag en false, idéntico al HTML del servidor);
 *   en navegación cliente el montaje es fresco (sin hidratación) así que
 *   arrancar visible no produce mismatch.
 */
let hasRevealedOnce = false
export function Reveal({ as, delay = 0, className, children, ...rest }: RevealProps) {
  // El cast fija el tag para JSX (el linter exige `ref` sobre un host
  // estático, no dentro de un objeto para createElement); en runtime se
  // respeta el `as` recibido.
  const Tag = (as ?? "div") as "div"
  const targetRef = useRef<HTMLElement | null>(null)
  // Hidratación: el primer render del cliente debe ser idéntico al HTML del
  // servidor (oculto). La vía rápida reduced-motion/sin-IO vive en el efecto,
  // que corre después de hidratar: nunca hay mismatch de atributos.
  // En navegaciones cliente posteriores al primer reveal de la sesión SPA
  // se arranca visible (sin animación ni flash de opacity:0).
  const [visible, setVisible] = useState(() => hasRevealedOnce)

  // Todo reveal efectivo habilita la vía rápida para los montajes futuros.
  useEffect(() => {
    if (visible) hasRevealedOnce = true
  }, [visible])

  const setTarget = useCallback((node: HTMLElement | null) => {
    targetRef.current = node
  }, [])

  useEffect(() => {
    // Vía rápida de sesión SPA: ya visible desde el primer paint, nada que
    // observar (y ningún observer que construir).
    if (visible) return
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true)
      return
    }
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
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
  }, [visible])

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
