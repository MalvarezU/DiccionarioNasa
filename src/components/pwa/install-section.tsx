"use client"

import { useState } from "react"
import { Check, Download, MonitorDown, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InstallDialog, type InstallVariant } from "./install-dialog"
import { isIOSDevice } from "./is-ios"
import { useInstallPrompt } from "./use-install-prompt"

type ManualVariant = InstallVariant

/**
 * Sección "Instalá Piiyaak" de la home. Vive en chunk separado (dynamic +
 * ssr:false desde InstallSectionLazy): el QR y su runtime nunca tocan
 * la carga inicial.
 *
 * Every install trigger opens the shared dialog first; the real install
 * action lives inside the modal so the native browser prompt never fires
 * from a bare button.
 */
export function InstallSection() {
  const { instalPromptDisponible, instalada, instalar } = useInstallPrompt()
  const [manual, setManual] = useState<ManualVariant | null>(null)

  const accionar = (origen: Exclude<ManualVariant, "ios">) => {
    setManual(isIOSDevice() ? "ios" : origen)
  }

  return (
    <section id="instalar" aria-labelledby="instalar-titulo" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-8">
          <h2 id="instalar-titulo" className="text-2xl sm:text-3xl font-serif font-bold">
            Lleva Piiyaak contigo
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Instalala en tu celular o compu y usala sin conexión con tus
            palabras favoritas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Android / Chrome
              </CardTitle>
              <CardDescription>
                Instalación directa desde el navegador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="cta"
                className="gap-2 w-full"
                disabled={instalada}
                aria-haspopup="dialog"
                onClick={() => accionar("android")}
              >
                {instalada ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {instalada ? "Ya instalada" : "Instalar ahora"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MonitorDown className="h-4 w-4 text-primary" />
                Escritorio
              </CardTitle>
              <CardDescription>
                Chrome o Edge en Windows, Mac o Linux.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="gap-2 w-full hover:bg-amarillo/20 hover:text-montana hover:border-amarillo/60"
                disabled={instalada}
                aria-haspopup="dialog"
                onClick={() => accionar("desktop")}
              >
                {instalada ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {instalada ? "Ya instalada" : "Instalar en el equipo"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 rounded-xl border bg-card p-6">
          <div className="text-center sm:text-left max-w-sm">
            <p className="font-semibold text-sm">Descargá la app (APK)</p>
            <p className="text-xs text-muted-foreground mt-1">
              Instalación directa en Android. Versión publicada y con código QR en la página de descarga.
            </p>
            <a
              href="/descargar"
              className="inline-flex items-center gap-2 mt-3 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Download className="h-3.5 w-3.5" />
              Ir a la página de descarga
            </a>
          </div>
        </div>
      </div>

      <InstallDialog
        open={manual !== null}
        onOpenChange={(abierto) => { if (!abierto) setManual(null) }}
        variant={manual ?? "android"}
        instalPromptDisponible={instalPromptDisponible}
        instalada={instalada}
        onInstalar={instalar}
      />
    </section>
  )
}
