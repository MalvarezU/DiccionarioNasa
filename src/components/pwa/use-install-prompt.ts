"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Captura el evento `beforeinstallprompt` (una sola oportunidad por visita)
 * y expone el estado de instalación de la PWA.
 *
 * Compartido entre el banner y la sección de instalación: el primero que
 * monte registra el listener, el evento queda retenido para `prompt()`.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let eventoRetenido: BeforeInstallPromptEvent | null = null
const oyentes = new Set<(e: BeforeInstallPromptEvent | null) => void>()

function esStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function useInstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(eventoRetenido)
  const [instalada, setInstalada] = useState<boolean>(() => esStandalone())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      eventoRetenido = evt
      oyentes.forEach((fn) => fn(evt))
      setEvento(evt)
    }
    const onInstalada = () => {
      eventoRetenido = null
      oyentes.forEach((fn) => fn(null))
      setEvento(null)
      setInstalada(true)
    }
    oyentes.add(setEvento)
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalada)
    return () => {
      oyentes.delete(setEvento)
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalada)
    }
  }, [])

  const instalar = useCallback(async (): Promise<boolean> => {
    const evt = eventoRetenido ?? evento
    if (!evt) return false
    await evt.prompt()
    const { outcome } = await evt.userChoice
    if (outcome === "accepted") {
      eventoRetenido = null
      oyentes.forEach((fn) => fn(null))
      setEvento(null)
      return true
    }
    return false
  }, [evento])

  return { evento, instalPromptDisponible: evento !== null, instalada, instalar }
}

/** Solo tests: limpia el evento retenido entre casos. */
export function resetInstallPromptForTests() {
  eventoRetenido = null
  oyentes.forEach((fn) => fn(null))
}
