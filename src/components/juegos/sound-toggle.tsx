"use client"

import { useEffect, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isSoundMuted, setSoundMuted } from "@/lib/game-sound"

/**
 * Small mute switch shared by every game screen (Fase 2).
 * Reads the persisted opt-out flag on mount, toggles it on click.
 * Label in Spanish; icon-only on mobile to save header space.
 */
export function SoundToggle() {
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setMuted(isSoundMuted())
  }, [])

  function toggle() {
    const next = !muted
    setSoundMuted(next)
    setMuted(next)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? "Activar sonido del juego" : "Silenciar sonido del juego"}
      title={muted ? "Activar sonido" : "Silenciar sonido"}
      className="game-press min-h-11 gap-1.5 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      {muted ? (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{muted ? "Silenciado" : "Sonido"}</span>
    </Button>
  )
}
