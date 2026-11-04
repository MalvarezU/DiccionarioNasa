"use client"

import { useEffect, useState } from "react"
import { useMounted } from "./use-mounted"

const STANDALONE_QUERY = "(display-mode: standalone)"

function readStandalone(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia(STANDALONE_QUERY).matches
    ) {
      return true
    }
  } catch {
    return false
  }
  // iOS Safari fallback: no display-mode support, uses navigator.standalone.
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Reactive PWA-installed flag for PWA-only UI (navbar badge/settings).
 *
 * Why this does not reuse `esStandalone` from `use-install-prompt` directly:
 * that helper is module-private, evaluated once as a `useState` initializer
 * and never re-subscribed, so its result stays frozen if the display mode
 * changes while the app is open. This hook re-reads after mount and listens
 * to the MediaQueryList `change` event so `isPwa` stays live, and exposes
 * `ready` (false during SSR/first render via `useMounted`) so callers can
 * skip painting until hydration and avoid a flash or mismatch.
 */
export function usePwaMode(): { isPwa: boolean; ready: boolean } {
  const ready = useMounted()
  const [isPwa, setIsPwa] = useState(false)

  useEffect(() => {
    if (!ready) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPwa(readStandalone())
    if (typeof window.matchMedia !== "function") return
    let mql: MediaQueryList | null = null
    try {
      mql = window.matchMedia(STANDALONE_QUERY)
    } catch {
      return
    }
    if (!mql) return
    const onChange = (event: MediaQueryListEvent) => {
      setIsPwa(
        event.matches ||
          (window.navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      )
    }
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
    } else {
      // Legacy Safari MediaQueryList API.
      ;(
        mql as unknown as {
          addListener: (fn: (e: MediaQueryListEvent) => void) => void
        }
      ).addListener(onChange)
    }
    return () => {
      if (typeof mql?.removeEventListener === "function") {
        mql.removeEventListener("change", onChange)
      } else if (mql) {
        ;(
          mql as unknown as {
            removeListener: (fn: (e: MediaQueryListEvent) => void) => void
          }
        ).removeListener(onChange)
      }
    }
  }, [ready])

  return { isPwa, ready }
}

export default usePwaMode
