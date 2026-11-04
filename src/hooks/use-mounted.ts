"use client"

import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}

/**
 * Hydration-safe "mounted" flag.
 * Returns `false` during SSR and the initial client render, `true` after
 * hydration. Use as a guard before touching `window`/`localStorage`.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

export default useMounted
