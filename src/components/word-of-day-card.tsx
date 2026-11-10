"use client"

import { useCallback, useSyncExternalStore } from "react"
import {
  Sparkles,
  Volume2,
  WifiOff,
  BookOpen,
  ChevronRight,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { WordDetailSkeleton } from "@/components/skeletons"
import { Button } from "@/components/ui/button"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { useWordOfDay } from "@/hooks/use-word-of-day"

// ─── Hydration-safe mount guard ─────────────────────────────────────────────

const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface WordOfDayCardProps {
  /** Callback when the user clicks to see the full word detail */
  onWordSelect?: (wordId: string) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WordOfDayCard({ onWordSelect }: WordOfDayCardProps) {
  const mounted = useMounted()
  const isOnline = useOnlineStatus()
  const {
    word: wordData,
    date: wordDate,
    isLoading,
    isFromCache,
    neverConnected,
  } = useWordOfDay()

  // ─── Handle click ────────────────────────────────────────────────────────

  const handleClick = useCallback(() => {
    if (wordData) {
      onWordSelect?.(wordData.id)
    }
  }, [wordData, onWordSelect])

  // ─── Don't render during SSR ────────────────────────────────────────────

  if (!mounted) return null

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabra del Día
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <WordDetailSkeleton />
        </CardContent>
      </Card>
    )
  }

  // ─── Never Connected (clean install, no internet) ───────────────────────

  if (neverConnected || (!wordData && !isOnline)) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabra del Día
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-tertiary-container">
              <WifiOff className="h-6 w-6 text-tertiary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Conéctate para descubrir la palabra del día
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── No word data available (online, server empty/failed, no cache) ─────
  // Designed empty state — never a ghost gap. Fetch/cache logic above
  // stays intact; only the fallthrough render changes.

  if (!wordData) {
    return (
      <Card className="border-outline-variant/30 bg-surface-container-low">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabra del Día
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-highest">
              <BookOpen className="h-6 w-6 text-primary/60" />
            </span>
            <p className="text-sm text-muted-foreground">
              Hoy la palabra descansa — explorá el diccionario
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/diccionario">Explorar el diccionario</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Word of the Day Card ───────────────────────────────────────────────

  return (
    <Card
      className="border border-outline-variant/30 bg-gradient-to-br from-surface-container-low via-surface-container-high to-tertiary/5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-tertiary/40 group"
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <CardTitle className="font-serif text-base font-semibold text-primary">
              Palabra del Día
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
            {wordDate && (
              <span className="text-2xs font-medium text-montana bg-amarillo/20 border border-amarillo/50 rounded-full px-2 py-0.5">
                {new Date(wordDate + "T00:00:00").toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Spanish word */}
            <h3 className="font-serif text-3xl font-bold text-primary group-hover:text-primary/80 transition-colors">
              {wordData.spanish}
            </h3>

            {/* Nasa Yuwe translation */}
            <p className="font-serif text-2xl font-semibold text-primary/80 mt-1">
              {wordData.nasaYuwe}
            </p>

            {/* Pronunciation + Category */}
            <div className="flex items-center gap-2 mt-3">
              {wordData.pronunciation && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Volume2 className="h-3 w-3" />
                  [{wordData.pronunciation}]
                </span>
              )}
              {wordData.category && (
                <Badge variant="secondary" className="text-2xs px-2 py-0.5 h-5 bg-secondary-container text-montana border border-secondary/30">
                  {wordData.category}
                </Badge>
              )}
            </div>

            {/* Cultural context preview */}
            {wordData.culturalContext && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                {wordData.culturalContext}
              </p>
            )}

            {/* "Ver más" link */}
            <div className="link-underline-terracota flex items-center gap-1 mt-3 text-primary text-xs font-medium w-fit">
              <BookOpen className="h-3 w-3" />
              Ver ficha completa
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>

          {/* Decorative sparkle */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-surface-container-highest shrink-0">
            <BookOpen className="h-6 w-6 text-primary/60" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
