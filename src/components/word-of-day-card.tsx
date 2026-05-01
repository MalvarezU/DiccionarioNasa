"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import {
  Sparkles,
  Volume2,
  Loader2,
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useOnlineStatus } from "@/hooks/use-online-status"
import {
  getCachedWordOfDay,
  setCachedWordOfDay,
  type CachedWordOfDay,
} from "@/lib/local-db"

// ─── Hydration-safe mount guard ─────────────────────────────────────────────

const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface WordOfDayData {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string | null
  examples: Array<{ spanish: string; nasaYuwe: string }> | null
}

interface WordOfDayCardProps {
  /** Callback when the user clicks to see the full word detail */
  onWordSelect?: (wordId: string) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WordOfDayCard({ onWordSelect }: WordOfDayCardProps) {
  const mounted = useMounted()
  const isOnline = useOnlineStatus()

  const [wordData, setWordData] = useState<WordOfDayData | null>(null)
  const [wordDate, setWordDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [neverConnected, setNeverConnected] = useState(false)

  // ─── Fetch word of the day ─────────────────────────────────────────────

  useEffect(() => {
    const fetchWordOfDay = async () => {
      setIsLoading(true)

      try {
        // Get today's date string for cache comparison
        const today = new Date().toISOString().slice(0, 10)

        if (isOnline) {
          // Try fetching from server first (HU1.4.6: server-selected)
          try {
            const res = await fetch("/api/dictionary/word-of-day")
            if (res.ok) {
              const data = await res.json()
              if (data.word) {
                setWordData(data.word)
                setWordDate(data.date)
                setIsFromCache(false)
                setNeverConnected(false)

                // Cache locally for offline use (HU1.4.7)
                const cacheData: CachedWordOfDay = {
                  word: data.word,
                  date: data.date,
                  cachedAt: new Date().toISOString(),
                }
                await setCachedWordOfDay(cacheData)

                setIsLoading(false)
                return
              }
            }
          } catch {
            // Server fetch failed — fall through to cache
          }

          // Server didn't return a word or fetch failed — try cache
          const cached = await getCachedWordOfDay()
          if (cached) {
            setWordData(cached.word)
            setWordDate(cached.date)
            setIsFromCache(true)
            setNeverConnected(false)
            setIsLoading(false)
            return
          }

          // No server data and no cache
          setWordData(null)
          setNeverConnected(false)
          setIsLoading(false)
        } else {
          // Offline — use cached word of the day (HU1.4.7)
          const cached = await getCachedWordOfDay()
          if (cached) {
            setWordData(cached.word)
            setWordDate(cached.date)
            setIsFromCache(true)
            setNeverConnected(false)
          } else {
            // Never had connection — no cached data (HU1.4.7)
            setWordData(null)
            setNeverConnected(true)
          }
          setIsLoading(false)
        }
      } catch {
        // Final fallback: try cache
        try {
          const cached = await getCachedWordOfDay()
          if (cached) {
            setWordData(cached.word)
            setWordDate(cached.date)
            setIsFromCache(true)
            setNeverConnected(false)
          } else {
            setWordData(null)
            setNeverConnected(true)
          }
        } catch {
          setWordData(null)
          setNeverConnected(true)
        }
        setIsLoading(false)
      }
    }

    fetchWordOfDay()
  }, [isOnline])

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
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabra del Día
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
          </div>
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
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabra del Día
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/30">
              <WifiOff className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Conéctate para descubrir la palabra del día
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── No word data available ─────────────────────────────────────────────

  if (!wordData) {
    return null
  }

  // ─── Word of the Day Card ───────────────────────────────────────────────

  return (
    <Card
      className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Palabra del Día
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isFromCache && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
              >
                <WifiOff className="h-2.5 w-2.5" />
                sin conexión
              </Badge>
            )}
            {wordDate && (
              <span className="text-[10px] text-muted-foreground">
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
            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
              {wordData.spanish}
            </h3>

            {/* Nasa Yuwe translation */}
            <p className="text-lg font-semibold text-primary mt-0.5">
              {wordData.nasaYuwe}
            </p>

            {/* Pronunciation + Category */}
            <div className="flex items-center gap-2 mt-2">
              {wordData.pronunciation && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Volume2 className="h-3 w-3" />
                  [{wordData.pronunciation}]
                </span>
              )}
              {wordData.category && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {wordData.category}
                </Badge>
              )}
            </div>

            {/* Cultural context preview */}
            {wordData.culturalContext && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                {wordData.culturalContext}
              </p>
            )}

            {/* "Ver más" link */}
            <div className="flex items-center gap-1 mt-2 text-primary text-xs font-medium group-hover:underline">
              <BookOpen className="h-3 w-3" />
              Ver ficha completa
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>

          {/* Decorative sparkle */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 shrink-0">
            <BookOpen className="h-6 w-6 text-primary/60" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
