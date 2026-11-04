"use client"

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react"

/** Carga diferida: el chunk (QR incluido) solo se descarga al acercarse. */
const InstallSection = lazy(() =>
  import("./install-section").then((m) => ({ default: m.InstallSection }))
)

/**
 * Envuelve la sección con un marcador de altura fija (evita CLS) y la
 * monta cuando entra al viewport (~200px antes) o si el hash la pide.
 *
 * - Con `visible === false` el contenedor es un sentinel de 1px, así no
 *   queda banda vacía en la home.
 * - Con `visible === true` se reserva 420px solo mientras el chunk carga;
 *   una vez montado, el contenido propio define la altura.
 * - `id="instalar"` vive en el contenedor hasta que el chunk carga y
 *   luego en la sección interna, así el scroll siempre encuentra target.
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
  const [loaded, setLoaded] = useState(false)
  const markLoaded = useCallback(() => setLoaded(true), [])

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

  // hashchange: cubre el caso de click en "Descargar app" desde la home
  // misma (el hash cambia sin remontar el componente).
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === "#instalar") {
        setVisible(true)
        window.setTimeout(() => {
          document
            .getElementById("instalar")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 100)
      }
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  // Scroll suave al aterrizar con #instalar (desde /diccionario u otro link)
  useEffect(() => {
    if (!visible) return
    if (typeof window === "undefined" || window.location.hash !== "#instalar") return
    const t = setTimeout(() => {
      document
        .getElementById("instalar")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
    return () => clearTimeout(t)
  }, [visible, loaded])

  return (
    <div
      ref={ref}
      id={loaded ? undefined : "instalar"}
      className={
        visible ? (loaded ? "" : "min-h-[420px]") : "min-h-[1px]"
      }
    >
      {visible ? (
        <Suspense fallback={null}>
          <MountNotifier onMount={markLoaded}>
            <InstallSection />
          </MountNotifier>
        </Suspense>
      ) : null}
    </div>
  )
}

function MountNotifier({
  onMount,
  children,
}: {
  onMount: () => void
  children: ReactNode
}) {
  useEffect(() => {
    onMount()
  }, [onMount])
  return <>{children}</>
}
