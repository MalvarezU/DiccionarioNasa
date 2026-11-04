"use client"

import Link from "next/link"
import { WifiOff, BookOpen, Heart, Gamepad2, RotateCcw } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"

/**
 * Página sin conexión: qué sí se puede usar con datos locales
 * (diccionario descargado en IndexedDB, favoritas del navegador
 * y juegos con palabras de muestra incluidas en la app).
 */
const DISPONIBLE = [
  {
    href: "/diccionario",
    icon: BookOpen,
    title: "Diccionario descargado",
    description: "Las palabras que descargaste en tu dispositivo.",
  },
  {
    href: "/diccionario",
    icon: Heart,
    title: "Tus favoritas",
    description: "Tus palabras guardadas en este navegador.",
  },
  {
    href: "/juegos",
    icon: Gamepad2,
    title: "Juegos con palabras de muestra",
    description: "Practicá con el vocabulario incluido en la app.",
  },
] as const

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main id="contenido" className="flex-1 flex flex-col items-center px-6 py-16 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/60">
          <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-serif font-bold">Sin conexión</h1>
        <p className="mt-2 text-muted-foreground max-w-md">
          Esto sí podés usar sin internet:
        </p>
        <ul className="mt-6 w-full max-w-md space-y-2 text-left">
          {DISPONIBLE.map((item) => (
            <li key={item.title}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <item.icon className="h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Button
            variant="ghost"
            className="gap-2 border border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            onClick={() => window.location.reload()}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
