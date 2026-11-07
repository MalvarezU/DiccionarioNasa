import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { Reveal } from "./reveal"

type IOCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void

/**
 * Contrato del Reveal on scroll (B2): contenido siempre en DOM, oculto hasta
 * intersectar (threshold ~0.15), disparo único con disconnect, reduced-motion
 * directo sin observar, delay/className/`as` passthrough.
 */
describe("Reveal", () => {
  const RealIO = globalThis.IntersectionObserver
  const realMatchMedia = globalThis.matchMedia

  let callbacks: IOCallback[]
  let observed: Element[]
  let lastOptions: IntersectionObserverInit | undefined
  let constructed: number
  let disconnected: number

  function fire(index: number, isIntersecting: boolean) {
    const cb = callbacks[index]
    const target = observed[index]
    if (!cb || !target) throw new Error("sin observer registrado")
    act(() => {
      cb([{ isIntersecting, target }])
    })
  }

  beforeEach(() => {
    callbacks = []
    observed = []
    lastOptions = undefined
    constructed = 0
    disconnected = 0
    globalThis.matchMedia = (() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof globalThis.matchMedia
    globalThis.IntersectionObserver = class {
      constructor(cb: IOCallback, options?: IntersectionObserverInit) {
        constructed += 1
        lastOptions = options
        callbacks.push(cb)
      }
      observe = (el: Element) => {
        observed.push(el)
      }
      unobserve = () => {}
      disconnect = () => {
        disconnected += 1
      }
    } as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    globalThis.IntersectionObserver = RealIO
    globalThis.matchMedia = realMatchMedia
  })

  it("contenido siempre en DOM, oculto hasta intersectar (threshold ~0.15)", () => {
    const { container } = render(
      <Reveal>
        <p>Hola territorio</p>
      </Reveal>
    )
    expect(screen.getByText("Hola territorio")).toBeInTheDocument()
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain("reveal")
    expect(wrapper?.className).not.toContain("is-visible")
    expect(lastOptions).toMatchObject({ threshold: 0.15 })
    expect(observed).toHaveLength(1)

    fire(0, true)
    expect(wrapper?.className).toContain("is-visible")
  })

  it("dispara una sola vez: ignora salidas y desconecta al entrar", () => {
    const { container } = render(
      <Reveal>
        <p>Una vez</p>
      </Reveal>
    )
    const wrapper = container.firstElementChild
    fire(0, false)
    expect(wrapper?.className).not.toContain("is-visible")
    fire(0, true)
    expect(wrapper?.className).toContain("is-visible")
    expect(disconnected).toBeGreaterThanOrEqual(1)
    expect(constructed).toBe(1)
  })

  it("delay, className y `as` passthrough", () => {
    const { container } = render(
      <Reveal as="section" delay={80} className="extra" aria-label="Región">
        <p>Passthrough</p>
      </Reveal>
    )
    const wrapper = container.firstElementChild
    expect(wrapper?.tagName).toBe("SECTION")
    expect(wrapper?.getAttribute("data-delay")).toBe("80")
    expect(wrapper?.className).toContain("reveal")
    expect(wrapper?.className).toContain("extra")
    expect(wrapper?.getAttribute("aria-label")).toBe("Región")
  })

  it("respeta prefers-reduced-motion: muestra directo sin observar", () => {
    globalThis.matchMedia = (() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof globalThis.matchMedia
    const { container } = render(
      <Reveal>
        <p>Sin animación</p>
      </Reveal>
    )
    expect(container.firstElementChild?.className).toContain("is-visible")
    expect(constructed).toBe(0)
  })

  it("sin IntersectionObserver muestra directo", () => {
    globalThis.IntersectionObserver = undefined as unknown as typeof IntersectionObserver
    const { container } = render(
      <Reveal>
        <p>Sin observer</p>
      </Reveal>
    )
    expect(container.firstElementChild?.className).toContain("is-visible")
  })
})
