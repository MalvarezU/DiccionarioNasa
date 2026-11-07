"use client"

/**
 * game-motion — capa de motion GSAP del juice kit (Fase 2.5).
 *
 * Composición, no competencia: el juice kit CSS existente sigue mandando
 * (game-press, anim-flash-*, anim-match-pop, game-progress, confetti-fall,
 * stagger del hub). Este módulo agrega los momentos que CSS no cubre
 * (flip 3D real, entrada de pregunta, countUp del resultado) con reglas duras:
 *
 * 1. Duraciones ≤ 350ms (todos los presets quedan dentro del sello).
 * 2. Easing visualmente afín a la curva del kit (cubic-bezier(.22,1,.36,1))
 *    → `power3.out` de GSAP.
 * 3. El estado final de un preset SIEMPRE coincide con el estado declarativo
 *    de React/CSS (clearProps en from-tweens, valores finales idénticos).
 * 4. Gate central de reduced-motion: con `prefers-reduced-motion: reduce`
 *    el helper es no-op total (no crea contexto, no ejecuta fx); el bloque
 *    global de `globals.css` queda como red de seguridad.
 * 5. GSAP core (solo core, sin plugins club) va importado estático en el
 *    paquete client (evaluado SSR-safe), SOLO dentro de componentes que
 *    importan este módulo. El flip 3D necesita tween síncrono pre-paint
 *    (layout effect); la importación estática lo garantiza sin el parpadeo
 *    de un frame que tendría una carga lazy (import("gsap") se resuelve
 *    después del paint del commit).
 */

import { useEffect, useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"

export type Gsap = typeof gsap
type GsapCtx = ReturnType<Gsap["context"]>

export interface GameMotionApi {
  gsap: Gsap
  /** Elemento scope del contexto (root del hook). */
  root: HTMLElement
}

/** Easing de proa del juice kit: curva ~cubic-bezier(0.22, 1, 0.36, 1). */
export const GAME_EASE = "power3.out"

/** Duraciones sello del kit (≤ 350ms). */
export const GAME_DUR = {
  flip: 0.28,
  burst: 0.3,
  drop: 0.25,
  settle: 0.18,
  pulse: 0.14,
  stamp: 0.26,
  reveal: 0.3,
  count: 0.35,
} as const

/** Gate central: true = no animar nada (helper no-op, el CSS reduce manda). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

/**
 * Hook scope de GSAP para un componente de juego.
 *
 * - Crea UN `gsap.context()` por montaje y ejecuta `fx` dentro; en re-runs
 *   por `deps`, agrega el fx al MISMO contexto vía `add()` (los tweens en
 *   vuelo de corridos anteriores NO mueren: el flip de la 2ª carta nunca se
 *   interrumpe a mitad por el re-render de checkPair).
 * - `.revert()` corre solo en el unmount del componente (StrictMode-safe:
 *   dev monta-desmonta-monta y las re-formas quedan limpias, sin inline
 *   values ni tweens huérfanos).
 * - Con reduced-motion el hook es no-op total y el fx jamás se ejecuta.
 *
 * Devuelve el ref del elemento raíz cuya subtree anima el fx (los presets
 * hacen querySelector dentro de `root`).
 */
export function useGsapGame(
  fx: (api: GameMotionApi) => void,
  deps: React.DependencyList = []
): React.RefObject<HTMLDivElement | null> {
  const rootRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<GsapCtx | null>(null)
  const ctxRootRef = useRef<HTMLElement | null>(null)
  // Última closure del fx: los re-runs usan la versión fresca del render
  // actual (los refs internos del componente siguen siendo la misma fuente).
  const fxRef = useRef(fx)
  fxRef.current = fx

  // Layout effect: los tweens montan pre-paint (cero flash entre el estado
  // de React y el primer frame del tween). Iso = sin warning de SSR.
  const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

  useIso(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    const ctx = ctxRef.current
    if (!ctx || ctx.isReverted || ctxRootRef.current !== root) {
      // Contexto nuevo, o renovar scope si el branch cambió la raíz
      // (p.ej. pantalla de carga → tablero en el mismo hook).
      ctx?.revert()
      ctxRef.current = gsap.context(() => {
        fxRef.current({ gsap, root })
      }, root)
      ctxRootRef.current = root
      return
    }
    // Re-run por deps: agrega el fx al MISMO contexto — los tweens en
    // vuelo de corridos anteriores NO mueren.
    ctx.add(() => {
      fxRef.current({ gsap, root })
    })
    // deps son del caller: el hook es un contenedor declarativo.
  }, deps)

  // Revert del contexto completo al desmontar (undo de tweens + inline).
  useEffect(() => {
    return () => {
      void ctxRef.current?.revert()
      ctxRef.current = null
      ctxRootRef.current = null
    }
  }, [])

  return rootRef
}


/* --------------------------------------------------------------------
 * Presets reutilizables (todos ≤ 350ms). Cada uno anima SOLO transición;
 * el estado de reposo lo manejan React + CSS (o el re-sello del fx).
 * ------------------------------------------------------------------ */

/**
 * Volteo 3D real de una carta (rotateY). `to=false` vuelve al dorso.
 * El dueño del transform de reposo es el CSS declarativo
 * (`.memory-flip-card[data-flip]` en globals.css): el tween anima SOLO
 * la transición con fromTo (parte del reposo opuesto, porque el CSS ya
 * pinta el final) y al completar libera el inline (`clearProps`) para
 * que el CSS tome el mando sin flash. `overwrite: "auto"`: si entra un
 * tween nuevo sobre la misma carta, mata el anterior en lugar de pelear
 * por los mismos props.
 */
export function flipCard3D(gsap: Gsap, el: Element | null, to = true): void {
  if (!el) return
  gsap.fromTo(
    el,
    { rotateY: to ? 0 : 180 },
    {
      rotateY: to ? 180 : 0,
      duration: GAME_DUR.flip,
      ease: "power2.out",
      overwrite: "auto",
      clearProps: "transform",
    }
  )
}

/**
 * Compat no-op: el estado de reposo del flip lo declara el CSS
 * (`[data-flip]`, ver globals.css), así que ya nada necesita imponerlo
 * vía GSAP. Se conserva la firma para no romper imports existentes.
 */
export function setFlipState(
  _gsap: Gsap,
  _el: Element | null,
  _to = true
): void {
  return
}

/**
 * matchBurst: micro asentamiento "sello" de una pareja encontrada. La
 * escala ya la cubre el keyframe CSS `anim-match-pop` (disparado por clase
 * sobre el botón); acá manda el golpe corto de rotateY sobre el inner en
 * OTRA capa: composición, no competencia. Termina en el estado de reposo
 * (180°) y libera el inline para que el CSS tome el mando sin flash.
 */
export function matchBurst(gsap: Gsap, el: Element | null): void {
  if (!el) return
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })
  tl.to(el, {
    rotateY: 166,
    duration: GAME_DUR.pulse,
    ease: "power2.in",
    overwrite: "auto",
  }).to(el, {
    rotateY: 180,
    duration: GAME_DUR.burst - GAME_DUR.pulse,
    ease: "back.out(1.7)",
    clearProps: "transform",
  })
}

/** Ficha que vuela al slot: entra con leve rebote. */
export function tileDropIn(gsap: Gsap, el: Element | null): void {
  if (!el) return
  gsap.from(el, {
    opacity: 0,
    scale: 0.7,
    y: -6,
    duration: GAME_DUR.drop,
    ease: "back.out(1.8)",
    overwrite: "auto",
    clearProps: "transform,opacity",
  })
}

/** Micro retorno de ficha a la banca al deshacer. */
export function tileSettleBack(gsap: Gsap, el: Element | null): void {
  if (!el) return
  gsap.from(el, {
    scale: 0.92,
    duration: GAME_DUR.settle,
    ease: "power2.out",
    overwrite: "auto",
    clearProps: "transform",
  })
}

/** Pulso del badge al subir de tiers de racha (1 → 2). */
export function streakTierPulse(gsap: Gsap, el: Element | null): void {
  if (!el) return
  gsap.fromTo(
    el,
    { scale: 1 },
    {
      scale: 1.12,
      duration: GAME_DUR.pulse,
      ease: "power2.out",
      yoyo: true,
      repeat: 1,
      overwrite: "auto",
      clearProps: "transform",
    }
  )
}

/** Sello "¡correcto!": check que cae en su lugar (scale + giro corto). */
export function stampIn(gsap: Gsap, el: Element | null): void {
  if (!el) return
  gsap.fromTo(
    el,
    { opacity: 0, scale: 1.35, rotation: -8 },
    {
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: GAME_DUR.stamp,
      ease: "back.out(2.2)",
      overwrite: "auto",
      clearProps: "transform,opacity",
    }
  )
}

/** Transición de pregunta / palabra nueva: slide + fade (desde derecha). */
export function slideReveal(gsap: Gsap, el: Element | null): void {
  if (!el) return
  gsap.from(el, {
    opacity: 0,
    x: 24,
    duration: GAME_DUR.reveal,
    ease: GAME_EASE,
    overwrite: "auto",
    clearProps: "transform,opacity",
  })
}

/** countUp del resultado final (0 → target, con redondeo en el tx). */
export function countUp(
  gsap: Gsap,
  el: HTMLElement | null,
  target: number
): ReturnType<Gsap["to"]> | undefined {
  if (!el || target <= 0) return
  const obj = { v: 0 }
  return gsap.to(obj, {
    v: target,
    duration: GAME_DUR.count,
    ease: "power1.out",
    overwrite: "auto",
    onUpdate: () => {
      el.textContent = String(Math.round(obj.v))
    },
  })
}

/** Nivel de racha equivalente a los tonos de `streakClass` (2 / 5). */
export function streakTier(streak: number): 0 | 1 | 2 {
  if (streak >= 5) return 2
  if (streak >= 2) return 1
  return 0
}
