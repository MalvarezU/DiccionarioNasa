"use client"

import { useEffect, useMemo, useState } from "react"

interface ConfettiProps {
  /** Number of DOM pieces (default 40). Keep small: pure CSS, no canvas. */
  pieces?: number
  className?: string
}

const CONFETTI_COLORS = [
  "#d7ae55", // amarillo tierra
  "#b96f4a", // terracota
  "#496b55", // territorio
  "#173f35", // montaña
  "#8c4a2a", // terracota texto
]

interface Piece {
  left: number
  delay: number
  duration: number
  color: string
  width: number
  height: number
  round: boolean
}

/**
 * CSS-only celebration confetti (~40 DOM pieces, animated in globals.css).
 * Renders nothing when the user prefers reduced motion.
 */
export function Confetti({ pieces = 40, className }: ConfettiProps) {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null
    if (!mq) return
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const items = useMemo<Piece[]>(
    () =>
      Array.from({ length: Math.max(0, pieces) }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 0.75 + Math.random() * 0.25,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        width: 6 + Math.floor(Math.random() * 5),
        height: 8 + Math.floor(Math.random() * 6),
        round: Math.random() > 0.6,
      })),
    [pieces]
  )

  if (reduced) return null

  return (
    <div
      aria-hidden="true"
      className={`game-confetti pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      {items.map((p, i) => (
        <span
          key={i}
          className="game-confetti-piece absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            borderRadius: p.round ? "999px" : "1px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
