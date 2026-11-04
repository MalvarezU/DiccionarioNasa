"use client"

import { useEffect, useState } from "react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import {
  getCachedWordOfDay,
  setCachedWordOfDay,
  type CachedWordOfDay,
} from "@/lib/local-db"

export interface WordOfDayData {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string | null
  examples: Array<{ spanish: string; nasaYuwe: string }> | null
}

export interface UseWordOfDayResult {
  word: WordOfDayData | null
  date: string | null
  isLoading: boolean
  isFromCache: boolean
  neverConnected: boolean
}

/**
 * Fetches the server-selected word of the day, falling back to the locally
 * cached word when offline or when the server has nothing to serve.
 *
 * Semantics: online → server first, then cache, then empty state;
 * offline → cache, then never-connected state; any unexpected error →
 * last-chance cache read. Successful server responses refresh the cache.
 */
export function useWordOfDay(): UseWordOfDayResult {
  const isOnline = useOnlineStatus()

  const [word, setWord] = useState<WordOfDayData | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [neverConnected, setNeverConnected] = useState(false)

  useEffect(() => {
    const fetchWordOfDay = async () => {
      setIsLoading(true)

      try {
        if (isOnline) {
          // Try fetching from server first (HU1.4.6: server-selected)
          try {
            const res = await fetch("/api/dictionary/word-of-day")
            if (res.ok) {
              const data = await res.json()
              if (data.word) {
                setWord(data.word)
                setDate(data.date)
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
            setWord(cached.word)
            setDate(cached.date)
            setIsFromCache(true)
            setNeverConnected(false)
            setIsLoading(false)
            return
          }

          // No server data and no cache
          setWord(null)
          setNeverConnected(false)
          setIsLoading(false)
        } else {
          // Offline — use cached word of the day (HU1.4.7)
          const cached = await getCachedWordOfDay()
          if (cached) {
            setWord(cached.word)
            setDate(cached.date)
            setIsFromCache(true)
            setNeverConnected(false)
          } else {
            // Never had connection — no cached data (HU1.4.7)
            setWord(null)
            setNeverConnected(true)
          }
          setIsLoading(false)
        }
      } catch {
        // Final fallback: try cache
        try {
          const cached = await getCachedWordOfDay()
          if (cached) {
            setWord(cached.word)
            setDate(cached.date)
            setIsFromCache(true)
            setNeverConnected(false)
          } else {
            setWord(null)
            setNeverConnected(true)
          }
        } catch {
          setWord(null)
          setNeverConnected(true)
        }
        setIsLoading(false)
      }
    }

    fetchWordOfDay()
  }, [isOnline])

  return { word, date, isLoading, isFromCache, neverConnected }
}
