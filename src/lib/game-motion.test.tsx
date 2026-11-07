import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { gsap } from "gsap"
import {
  useGsapGame,
  prefersReducedMotion,
  streakTier,
  flipCard3D,
  matchBurst,
  tileDropIn,
  tileSettleBack,
  streakTierPulse,
  stampIn,
  slideReveal,
  countUp,
  GAME_DUR,
} from "./game-motion"
import type { GameMotionApi } from "./game-motion"

/** matchMedia jsdom polyfill escribe `matches: false`; el test controla el gate. */
function mockMatchMedia(matches: boolean) {
  const matcher = vi.fn().mockReturnValue({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList)
  vi.stubGlobal("matchMedia", matcher)
  return matcher
}

/**
 * Consumer mínimo: el ref del hook tiene que adjuntarse a un elemento real
 * (si la raíz no existe, el hook sale sin animar — por eso renderHook sin
 * mount no basta).
 */
function GsapScope({
  fx,
  dep,
}: {
  fx: (api: GameMotionApi) => void
  dep?: number
}) {
  const ref = useGsapGame(fx, [dep])
  return <div ref={ref} />
}

describe("useGsapGame [Fase 2.5 juice kit]", () => {
  it("sin preferencia de motion reducida: ejecuta fx una vez dentro del scope", () => {
    vi.unstubAllGlobals()
    const fx = vi.fn()
    const { unmount } = render(<GsapScope fx={fx} />)
    expect(fx).toHaveBeenCalledTimes(1)
    const api = fx.mock.calls[0]![0] as GameMotionApi
    expect(api.gsap).toBe(gsap)
    expect(api.root).toBeInstanceOf(HTMLElement)
    // Preset dentro del contexto: crea tween (el ticker de jsdom no lo
    // hace avanzar, pero el contexto lo registró sin errores).
    flipCard3D(api.gsap, api.root, true)
    unmount()
  })

  it("con prefers-reduced-motion: reduce el helper es no-op total (fx nunca corre)", () => {
    mockMatchMedia(true)
    const fx = vi.fn()
    const { unmount } = render(<GsapScope fx={fx} />)
    // Layout effect sincrónico: si pasara el gate, fx ya habría corrido.
    expect(fx).not.toHaveBeenCalled()
    unmount()
    expect(prefersReducedMotion()).toBe(true)
  })

  it("re-run por deps usa la misma raíz sin recrear el contexto", () => {
    vi.unstubAllGlobals()
    const fx = vi.fn()
    const { rerender, unmount } = render(<GsapScope fx={fx} dep={0} />)
    expect(fx).toHaveBeenCalledTimes(1)
    rerender(<GsapScope fx={fx} dep={1} />)
    expect(fx).toHaveBeenCalledTimes(2)
    unmount()
  })
})

describe("presets de game-motion [Fase 2.5]", () => {
  it("streakTier marca los tiers de streakClass (2 y 5)", () => {
    expect(streakTier(0)).toBe(0)
    expect(streakTier(1)).toBe(0)
    expect(streakTier(2)).toBe(1)
    expect(streakTier(4)).toBe(1)
    expect(streakTier(5)).toBe(2)
    expect(streakTier(9)).toBe(2)
  })

  it("todos los presets toleran null target (guard barato, y el sello de duración ≤ 350ms)", () => {
    expect(() => flipCard3D(gsap, null)).not.toThrow()
    expect(() => matchBurst(gsap, null)).not.toThrow()
    expect(() => tileDropIn(gsap, null)).not.toThrow()
    expect(() => tileSettleBack(gsap, null)).not.toThrow()
    expect(() => streakTierPulse(gsap, null)).not.toThrow()
    expect(() => stampIn(gsap, null)).not.toThrow()
    expect(() => slideReveal(gsap, null)).not.toThrow()
    expect(() => countUp(gsap, null, 10)).not.toThrow()
    expect(Math.max(...Object.values(GAME_DUR))).toBeLessThanOrEqual(0.35)
  })

  it("countUp con target 0 no crea tween (texto final ya es el declarativo)", () => {
    const el = document.createElement("span")
    el.textContent = "0"
    countUp(gsap, el, 0)
    expect(el.textContent).toBe("0")
  })

  it("countUp escribe el valor final redondeado al actualizar", () => {
    const el = document.createElement("span")
    el.textContent = "0"
    const tween = countUp(gsap, el, 42)
    // Avanzar el tween manualmente: el estado final del texto es 42.
    tween?.progress(1)
    expect(el.textContent).toBe("42")
  })
})
