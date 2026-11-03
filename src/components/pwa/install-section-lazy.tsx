"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

/** Carga diferida: el chunk (QR incluido) solo se descarga al acercarse. */
const InstallSection = dynamic(
  () => import("./install-section").then((m) => m.InstallSection),
  { ssr: false, loading: () => null }
)

/**
 * Envuelve la sección con un marcador de altura fija (evita CLS) y la
 * monta cuando entra al viewport (~200px antes) o si el hash la pide.
 */
export function InstallSectionLazy() {
  const ref = useRef<HTMLDivElement>(null)
  // Si el hash ya pide la sección o no hay IntersectionObserver,
  // visible desde el primer render (sin efecto)
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false
    if (window.location.hash === "#instalar") return true
    return typeof IntersectionObserver === "undefined"
  })

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible])

  // Scroll suave al aterrizar con #instalar (desde /diccionario u otro link)
  useEffect(() => {
    if (!visible || (typeof window !== "undefined" && window.location.hash !== "#instalar")) return
    const t = setTimeout(() => {
      document.getElementById("instalar")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <div ref={ref} className="min-h-[420px]">
      {visible ? <InstallSection /> : null}
    </div>
  )
}
