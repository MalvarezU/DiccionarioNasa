"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Check, Copy, Download, MonitorDown, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useInstallPrompt } from "./use-install-prompt"

/**
 * Sección "Instalá Piiyaak" de la home. Vive en chunk separado (dynamic +
 * ssr:false desde InstallSectionLazy): el QR y su runtime nunca tocan
 * la carga inicial.
 */
export function InstallSection() {
  const { instalPromptDisponible, instalar } = useInstallPrompt()
  const [copiado, setCopiado] = useState(false)
  const origen = typeof window !== "undefined" ? window.location.origin : ""

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(origen || window.location.href)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard no disponible (http/permisos): no se rompe nada
    }
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
              {instalPromptDisponible ? (
                <Button className="gap-2 w-full" onClick={() => void instalar()}>
                  <Download className="h-4 w-4" />
                  Instalar ahora
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Abrí esta página en Chrome de Android y tocá ⋮ → “Instalar
                  aplicación”.
                </p>
              )}
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
              {instalPromptDisponible ? (
                <Button variant="outline" className="gap-2 w-full" onClick={() => void instalar()}>
                  <Download className="h-4 w-4" />
                  Instalar en el equipo
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Buscá el icono de instalación en la barra de direcciones
                  (monitor con flecha) y confirmá.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 rounded-xl border bg-card p-6">
          <div className="bg-white p-3 rounded-lg shrink-0" aria-hidden={false}>
            <QRCodeSVG
              value={origen || "https://piiyaak.org"}
              size={160}
              role="img"
              aria-label={`Código QR para abrir ${origen || "Piiyaak"}`}
            />
          </div>
          <div className="text-center sm:text-left max-w-sm">
            <p className="font-semibold text-sm">Pasala a otro celular</p>
            <p className="text-xs text-muted-foreground mt-1 break-all">
              Escaneá el QR o copiá el enlace:{" "}
              <span className="font-mono">{origen}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 mt-3"
              onClick={() => void copiar()}
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "¡Copiado!" : "Copiar enlace"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
