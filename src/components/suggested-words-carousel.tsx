"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  Sparkles,
  Volume2,
  WifiOff,
  BookOpen,
  ChevronRight,
  ChevronLeft,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WordDetailSkeleton } from "@/components/skeletons"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { useSuggestedWords } from "@/hooks/use-suggested-words"

// ─── Hydration-safe mount guard ─────────────────────────────────────────────

const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface SuggestedWordsCarouselProps {
  /** Callback when the user clicks to see the full word detail */
  onWordSelect?: (wordId: string) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SuggestedWordsCarousel({ onWordSelect }: SuggestedWordsCarouselProps) {
  const mounted = useMounted()
  const isOnline = useOnlineStatus()
  const {
    words: wordsData,
    date: wordsDate,
    isLoading,
    isFromCache,
    neverConnected,
  } = useSuggestedWords()

  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [activePage, setActivePage] = useState(0)
  const [visiblePerView, setVisiblePerView] = useState(1)
  const rafRef = useRef<number | null>(null)
  // Suprime handleScroll mientras el scroll es movido por nuestra animación
  // rAF: cada asignación a scrollLeft dispara un evento scroll que, de lo
  // contrario, sobrescribiría activePage con estados intermedios (flicker).
  const isAnimatingRef = useRef(false)

  // Easing de la casa: cubic-bezier(0.22, 1, 0.36, 1) (globals.css).
  const ease = useCallback((t: number) => {
    const x1 = 0.22, y1 = 1, x2 = 0.36, y2 = 1
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u
    const sampleY = (u: number) => ((ay * u + by) * u + cy) * u
    const derivX = (u: number) => (3 * ax * u + 2 * bx) * u + cx
    let u = t
    for (let i = 0; i < 8; i++) {
      const x = sampleX(u) - t
      const d = derivX(u)
      if (Math.abs(x) < 1e-7) break
      if (Math.abs(d) < 1e-6) break
      u -= x / d
    }
    if (u < 0) u = 0
    if (u > 1) u = 1
    return sampleY(u)
  }, [])

  const animateScrollTo = useCallback((targetLeft: number, duration = 550) => {
    const track = trackRef.current
    if (!track) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const startLeft = track.scrollLeft
    const delta = targetLeft - startLeft
    if (Math.abs(delta) < 1) {
      track.scrollLeft = targetLeft
      // Un animación previa pudo dejar el flag en true y su frame final
      // (que lo limpia) ya no correrá: lo limpiamos acá.
      isAnimatingRef.current = false
      return
    }
    isAnimatingRef.current = true
    // Con snap-mandatory, Chrome snapea cada asignación programática de
    // scrollLeft al punto de snap más cercano: la animación se corta a mitad
    // de camino con un salto seco. Desactivamos el snap SOLO mientras anima;
    // al restaurarlo, el re-snap del navegador cae sobre la posición ya
    // asentada (sin salto visible).
    track.style.scrollSnapType = "none"
    const startTime = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      track.scrollLeft = startLeft + delta * ease(t)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
        // Liberamos la supresión DESPUÉS de la asignación final: el evento
        // scroll rezagado de esa asignación re-sincroniza activePage desde
        // la posición ya asentada.
        isAnimatingRef.current = false
        // "" restaura el snap de la clase Tailwind (snap-x snap-mandatory).
        track.style.scrollSnapType = ""
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }, [ease])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const words = wordsData ?? []

  const measureVisible = useCallback(() => {
    const track = trackRef.current
    const first = cardRefs.current[0]
    if (!track || !first || first.offsetWidth === 0) return
    // Cuento con el gap real: n cards caben si n*w + (n-1)*gap <= clientWidth,
    // i.e. n = floor((clientWidth + gap) / (w + gap)). Sin gap la fórmula
    // sobre-contaba en anchos intermedios y generaba pageCount incorrecto.
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0
    const perView = Math.max(
      1,
      Math.floor((track.clientWidth + gap) / (first.offsetWidth + gap))
    )
    setVisiblePerView(perView)
  }, [])

  const pageCount = Math.max(1, Math.ceil(words.length / Math.max(1, visiblePerView)))

  useEffect(() => {
    measureVisible()
    const onResize = () => measureVisible()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [measureVisible, words.length])

  // Si un resize cambia pageCount, activePage puede quedar fuera de rango.
  useEffect(() => {
    setActivePage((prev) => Math.max(0, Math.min(prev, pageCount - 1)))
  }, [pageCount])

  // Índice de card con el que arranca cada página de scroll.
  const pageStartCardIndex = useCallback(
    (p: number) => Math.min(words.length - 1, p * Math.max(1, visiblePerView)),
    [words.length, visiblePerView]
  )

  const handleScroll = useCallback(() => {
    // Nuestra animación rAF mueve scrollLeft por frames: los eventos que
    // genera sobrescribirían activePage con posiciones intermedias.
    if (isAnimatingRef.current) return
    const track = trackRef.current
    if (!track) return
    const maxScroll = track.scrollWidth - track.clientWidth
    if (maxScroll <= 0) {
      setActivePage(0)
      return
    }
    // La página activa es aquella cuyo *target de scroll clampeado* está más
    // cerca de la posición actual. El clampeo es clave: en la última página el
    // navegador limita scrollLeft a maxScroll, que NO coincide con el
    // offsetLeft de la card inicial de esa página (por eso la aritmética
    // anterior de round(scrollLeft/step) deducía una página equivocada y el
    // dot "volvía" a la primera).
    const scrollLeft = track.scrollLeft
    let best = 0
    let bestDist = Infinity
    for (let p = 0; p < pageCount; p++) {
      const el = cardRefs.current[pageStartCardIndex(p)]
      if (!el) continue
      const target = Math.min(el.offsetLeft, maxScroll)
      const dist = Math.abs(scrollLeft - target)
      if (dist < bestDist) {
        bestDist = dist
        best = p
      }
    }
    setActivePage(best)
  }, [pageCount, pageStartCardIndex])

  const scrollToPage = useCallback(
    (p: number) => {
      let page = p
      if (page < 0) page = pageCount - 1
      if (page >= pageCount) page = 0
      const el = cardRefs.current[pageStartCardIndex(page)]
      const track = trackRef.current
      if (el && track) {
        animateScrollTo(el.offsetLeft, 550)
      }
      setActivePage(page)
    },
    [pageCount, pageStartCardIndex, animateScrollTo]
  )

  const handleCardClick = useCallback(
    (wordId: string) => {
      onWordSelect?.(wordId)
    },
    [onWordSelect]
  )

  if (!mounted) return null

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabras sugeridas
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="shrink-0 w-[85%] sm:w-[45%] md:w-[32%]">
                <WordDetailSkeleton />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Never Connected ────────────────────────────────────────────────────

  if (neverConnected || (!wordsData && !isOnline)) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabras sugeridas
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-tertiary-container">
              <WifiOff className="h-6 w-6 text-tertiary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Conéctate para descubrir las palabras sugeridas
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Empty State ────────────────────────────────────────────────────────

  if (!wordsData || words.length === 0) {
    return (
      <Card className="border-outline-variant/30 bg-surface-container-low">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabras sugeridas
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-highest">
              <BookOpen className="h-6 w-6 text-primary/60" />
            </span>
            <p className="text-sm text-muted-foreground">
              Hoy las palabras descansan — explorá el diccionario
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/diccionario">Explorar el diccionario</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Carousel ───────────────────────────────────────────────────────────

  return (
    <Card className="border border-outline-variant/30 bg-gradient-to-br from-surface-container-low via-surface-container-high to-tertiary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <CardTitle className="font-serif text-base font-semibold text-primary">
              Palabras sugeridas
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isFromCache && (
              <Badge
                variant="outline"
                className="text-2xs gap-1 text-tertiary bg-surface-container-highest border-outline-variant/20"
              >
                <WifiOff className="h-2.5 w-2.5" />
                sin conexión
              </Badge>
            )}
            {wordsDate && (
              <span className="text-2xs font-medium text-montana bg-amarillo/20 border border-amarillo/50 rounded-full px-2 py-0.5">
                {new Date(wordsDate + "T00:00:00").toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative md:px-12">
          {/* Prev chevron (md+): vive en el riel lateral, fuera del área de las cards */}
          <button
            type="button"
            onClick={() => scrollToPage(activePage - 1)}
            className="hidden md:flex absolute left-1.5 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full bg-background/90 border border-outline-variant/30 shadow hover:bg-background"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
          >
            {words.map((word, i) => (
              <div
                key={word.id}
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                className={`shrink-0 w-[85%] sm:w-[45%] md:w-[32%] ${
                  i % Math.max(1, visiblePerView) === 0 ? "snap-start" : "snap-none"
                }`}
              >
                <Card
                  className="h-full border border-outline-variant/30 bg-surface-container-low cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-tertiary/40 group"
                  onClick={() => handleCardClick(word.id)}
                >
                  <CardContent className="pt-4">
                    {/* Illustration */}
                    <div className="mb-3 aspect-video w-full overflow-hidden rounded-lg bg-surface-container-highest flex items-center justify-center">
                      {word.illustrationUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={word.illustrationUrl}
                          alt={word.spanish}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BookOpen className="h-8 w-8 text-primary/60" />
                      )}
                    </div>

                    {/* Spanish word */}
                    <h3 className="font-serif text-xl font-bold text-primary group-hover:text-primary/80 transition-colors">
                      {word.spanish}
                    </h3>

                    {/* Nasa Yuwe */}
                    <p className="font-serif text-lg font-semibold text-primary/80 mt-1">
                      {word.nasaYuwe}
                    </p>

                    {/* Pronunciation + Category */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {word.pronunciation && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Volume2 className="h-3 w-3" />
                          [{word.pronunciation}]
                        </span>
                      )}
                      {word.category && (
                        <Badge variant="secondary" className="text-2xs px-2 py-0.5 h-5 bg-secondary-container text-montana border border-secondary/30">
                          {word.category}
                        </Badge>
                      )}
                    </div>

                    {/* Cultural context preview */}
                    {word.culturalContext && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                        {word.culturalContext}
                      </p>
                    )}

                    {/* "Ver ficha completa" link */}
                    <div className="link-underline-terracota flex items-center gap-1 mt-3 text-primary text-xs font-medium w-fit">
                      <BookOpen className="h-3 w-3" />
                      Ver ficha completa
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Next chevron (md+): vive en el riel lateral, fuera del área de las cards */}
          <button
            type="button"
            onClick={() => scrollToPage(activePage + 1)}
            className="hidden md:flex absolute right-1.5 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full bg-background/90 border border-outline-variant/30 shadow hover:bg-background"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Dots: representan páginas de scroll, no palabras individuales */}
        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToPage(i)}
                className={`h-2 w-2 rounded-full transition-all ${
                  i === activePage ? "bg-primary w-4" : "bg-outline-variant/60"
                }`}
                aria-label={`Ir a página ${i + 1}`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
