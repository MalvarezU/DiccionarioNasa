import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { Download, ExternalLink, Smartphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumbs } from "@/components/breadcrumbs"

export const dynamic = "force-dynamic"

/** Contract: R2 apk/latest.json pointer (published by apk-release workflow). */
interface ApkLatest {
  versionCode: number
  versionName: string
  contentVersion: number
  apkUrl: string
  sizeBytes: number
  generatedAt: string
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

async function fetchLatest(): Promise<ApkLatest | null> {
  const base = process.env.R2_PUBLIC_BASE_URL
  if (!base) return null
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/apk/latest.json`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<ApkLatest>
    if (
      typeof data.apkUrl !== "string" ||
      typeof data.versionCode !== "number"
    ) {
      return null
    }
    return data as ApkLatest
  } catch {
    return null
  }
}

export default async function DescargarPage() {
  const latest = await fetchLatest()
  const pageUrl = "https://piiyaak.com/descargar"

  return (
    <main
      id="contenido"
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6"
    >
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Descargar app" }]} />

      <section className="mb-8 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-7 w-7 text-primary" aria-hidden="true" />
          <h1 className="font-serif text-3xl font-bold leading-none text-primary sm:text-4xl">
            App móvil Piiyaak
          </h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Lleva el diccionario, los cursos y los juegos Nasa Yuwe en tu
          bolsillo. Todo el contenido viaja dentro de la app: funciona sin
          internet desde el primer momento.
        </p>
      </section>

      {latest ? (
        <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Smartphone className="size-3.5" aria-hidden="true" />
                  Android
                </Badge>
                <Badge variant="outline">v{latest.versionName}</Badge>
                {typeof latest.contentVersion === "number" ? (
                  <Badge variant="outline" className="tabular-nums">
                    contenido v{latest.contentVersion}
                  </Badge>
                ) : null}
              </div>

              <p className="text-sm text-muted-foreground">
                {formatBytes(latest.sizeBytes)} · actualizada el{" "}
                {new Date(latest.generatedAt).toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>

              <Button asChild size="lg" className="min-h-[48px] gap-2">
                <a href={latest.apkUrl} download>
                  <Download className="size-4" aria-hidden="true" />
                  Descargar APK
                </a>
              </Button>

              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Descarga e instala la APK (permite apps de origen desconocido si el sistema lo pide).</li>
                <li>Al abrir por primera vez prepara el contenido: tarda unos segundos.</li>
                <li>Luego funciona sin internet. Con conexión, se pone al día sola.</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardContent className="flex flex-col items-center gap-3 pt-6">
              <div className="rounded-lg border border-outline-variant/30 bg-white p-3">
                <QRCodeSVG value={pageUrl} size={160} aria-label={`Código QR hacia ${pageUrl}`} />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Escanea con otra teléfono para compartir la app
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="font-serif text-xl font-bold text-primary">
              La app todavía no está publicada
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              La primera versión se está preparando. Vuelve a intentarlo en
              unos días o escanea el código más tarde.
            </p>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/">
                Volver al inicio
                <ExternalLink className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
