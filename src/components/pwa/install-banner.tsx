"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Download, X, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InstallDialog, type InstallVariant } from "./install-dialog"
import { isIOSDevice } from "./is-ios"
import { useInstallPrompt } from "./use-install-prompt"
import { useMounted } from "@/hooks/use-mounted"

const DISMISS_KEY = "pwa-banner-dismissed-at"
const REAPARECE_MS = 30 * 24 * 60 * 60 * 1000 // 30 días

type BannerVariant = Extract<InstallVariant, "android" | "ios">

/**
 * Banner de instalación de la PWA. Liviano a propósito: sin QR ni lógica
 * pesada (eso vive en la sección lazy de la home).
 *
 * - Con prompt nativo (Chrome/Android/PC): "Instalar" abre el modal propio
 *   y la acción real vive dentro (el prompt nativo nunca dispara directo).
 * - Sin prompt (iOS Safari, Firefox): "Cómo instalarla" lleva a #instalar.
 * - Instalada o descartada hace <30 días: no se muestra.
 */
export function InstallBanner({ destino = "/#instalar" }: { destino?: string }) {
  const { instalPromptDisponible, instalada, instalar } = useInstallPrompt()
  const mounted = useMounted()
  const [oculto, setOculto] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [variant, setVariant] = useState<BannerVariant>("android")
  const router = useRouter()

  useEffect(() => {
    if (!mounted) return
    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) ?? "0")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Date.now() - ts < REAPARECE_MS) setOculto(true)
    } catch {
      // keep false
    }
  }, [mounted])

  if (!mounted || oculto || instalada) return null

  const abrirModal = () => {
    setVariant(isIOSDevice() ? "ios" : "android")
    setDialogOpen(true)
  }

  const verComo = () => {
    if (destino.startsWith("/#")) {
      document
        .getElementById(destino.slice(2))
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      router.push(destino)
    }
  }

  return (
    <div
      role="region"
      aria-label="Instalar la aplicación Piiyaak"
      className="border-b bg-primary/5"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Smartphone className="h-4 w-4 text-primary" />
        </span>
        <p className="min-w-0 flex-1 text-xs sm:text-sm">
          <span className="font-semibold">Llevá Piiyaak en tu celular o PC.</span>{" "}
          <span className="text-muted-foreground hidden sm:inline">
            Funciona sin conexión con tus favoritas.
          </span>
        </p>
        {instalPromptDisponible ? (
          <Button size="sm" className="gap-1.5" aria-haspopup="dialog" onClick={abrirModal}>
            <Download className="h-3.5 w-3.5" />
            Instalar
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={verComo}>
            Cómo instalarla
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          aria-label="Ocultar aviso de instalación"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, String(Date.now()))
            } catch {
              // Sin localStorage: al menos ocultar en esta vista
            }
            setOculto(true)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <InstallDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        variant={variant}
        instalPromptDisponible={instalPromptDisponible}
        instalada={instalada}
        onInstalar={instalar}
      />
    </div>
  )
}
