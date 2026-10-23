"use client"

import { useState, useCallback } from "react"

/**
 * Dominio de la ilustración de la ficha: valor vigente, reemplazo y descarte
 * del cambio pendiente.
 *
 * Espejo de use-word-audio, con una diferencia: acá el archivo no se sube
 * desde el hook, lo sube MediaPicker (comprime en el cliente y devuelve la
 * URL pública R2). El estado siempre guarda la URL vigente
 * —la existente si no se tocó— para que el PUT nunca reciba un null espurio.
 */
export function useWordIllustration() {
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null)
  const [originalIllustrationUrl, setOriginalIllustrationUrl] = useState<string | null>(null)
  const [illustrationChanged, setIllustrationChanged] = useState(false)

  const resetIllustration = useCallback((url: string | null) => {
    setIllustrationUrl(url)
    setOriginalIllustrationUrl(url)
    setIllustrationChanged(false)
  }, [])

  const handleIllustrationChange = useCallback((url: string | null) => {
    setIllustrationUrl(url)
    setIllustrationChanged(true)
  }, [])

  /** Descarta el reemplazo pendiente y vuelve a la ilustración guardada. */
  const removeIllustration = useCallback(() => {
    setIllustrationUrl(originalIllustrationUrl)
    setIllustrationChanged(false)
  }, [originalIllustrationUrl])

  return {
    illustrationUrl,
    originalIllustrationUrl,
    illustrationChanged,
    resetIllustration,
    handleIllustrationChange,
    removeIllustration,
  }
}
