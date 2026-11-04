"use client"

import { useEffect, useState } from "react"

/**
 * Devuelve `value` con un retardo: la UI escribe en cada tecla pero los
 * efectos caros (GET de lista) solo ven el valor cuando deja de cambiar.
 * Sin libs: un setTimeout por cambio, 300ms por defecto.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}
