"use client"

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  BookOpen,
  Volume2,
  Loader2,
  CloudOff,
  Download,
  List,
  Filter,
  X,
  ChevronDown,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useOnlineStatus } from "@/hooks/use-online-status"
import {
  getAllLocalWords,
  isLocalDBReady,
  getNormalizedInitial,
} from "@/lib/local-db"

// ─── Hydration-safe mount guard ─────────────────────────────────────────────

const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExploreWord {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  category: string | null
  culturalContext: string | null
}

interface LetterGroup {
  letter: string
  words: ExploreWord[]
  /** Starting index of this group in the flat list */
  startIndex: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SPANISH_ALPHABET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
]

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse category string into an array of lowercase trimmed category keys.
 * Supports comma-separated categories: "sustantivo, verbo" → ["sustantivo", "verbo"]
 */
function parseCategories(category: string | null): string[] {
  if (!category) return []
  return category
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Extract unique categories from all words, sorted alphabetically.
 */
function extractCategories(words: ExploreWord[]): string[] {
  const set = new Set<string>()
  for (const word of words) {
    for (const cat of parseCategories(word.category)) {
      set.add(cat)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"))
}

/**
 * Category display labels (Spanish)
 */
const CATEGORY_LABELS: Record<string, string> = {
  sustantivo: "Sustantivo",
  verbo: "Verbo",
  adjetivo: "Adjetivo",
  numeral: "Numeral",
  adverbio: "Adverbio",
  pronombre: "Pronombre",
  preposicion: "Preposición",
  conjuncion: "Conjunción",
  interjeccion: "Interjección",
}

function getCategoryDisplay(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)
}

/**
 * Group words by their normalized initial letter, with startIndex tracking
 * for virtualizer scroll-to-letter functionality.
 */
function groupByLetter(words: ExploreWord[]): LetterGroup[] {
  const map = new Map<string, ExploreWord[]>()

  for (const word of words) {
    const letter = getNormalizedInitial(word.spanish)
    const existing = map.get(letter)
    if (existing) {
      existing.push(word)
    } else {
      map.set(letter, [word])
    }
  }

  let runningIndex = 0
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([letter, groupWords]) => {
      const startIndex = runningIndex
      runningIndex += groupWords.length
      return { letter, words: groupWords, startIndex }
    })
}

/**
 * Get the set of letters that have words.
 */
function getActiveLetters(groups: LetterGroup[]): Set<string> {
  return new Set(groups.map((g) => g.letter))
}

// ─── Virtual list row types ─────────────────────────────────────────────────

interface HeaderRow {
  type: "header"
  letter: string
  count: number
  id: string
}

interface WordRow {
  type: "word"
  word: ExploreWord
  id: string
}

type VirtualRow = HeaderRow | WordRow

/**
 * Build virtual rows from letter groups: interleaves letter headers and word items.
 */
function buildVirtualRows(groups: LetterGroup[]): VirtualRow[] {
  const rows: VirtualRow[] = []
  for (const group of groups) {
    rows.push({
      type: "header",
      letter: group.letter,
      count: group.words.length,
      id: `header-${group.letter}`,
    })
    for (const word of group.words) {
      rows.push({ type: "word", word, id: `word-${word.id}` })
    }
  }
  return rows
}

/**
 * Build a lookup map from letter → virtual row index (for scroll-to-letter).
 */
function buildLetterIndexMap(rows: VirtualRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type === "header") {
      map.set(row.letter, i)
    }
  }
  return map
}

// ─── Component ──────────────────────────────────────────────────────────────

interface ExploreSectionProps {
  /** Callback when a word is selected — parent opens the detail card */
  onWordSelect?: (wordId: string) => void
}

export function ExploreSection({ onWordSelect }: ExploreSectionProps) {
  const mounted = useMounted()
  const isOnline = useOnlineStatus()

  const [allWords, setAllWords] = useState<ExploreWord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [localReady, setLocalReady] = useState<boolean | null>(null)

  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)

  // Ref for the scrollable container used by the virtualizer
  const scrollRef = useRef<HTMLDivElement>(null)

  // ─── Load words ──────────────────────────────────────────────────────────

  useEffect(() => {
    const loadWords = async () => {
      setIsLoading(true)
      try {
        if (!isOnline) {
          const ready = await isLocalDBReady()
          setLocalReady(ready)
          if (ready) {
            const localWords = await getAllLocalWords()
            setAllWords(
              localWords.map((w) => ({
                id: w.id,
                spanish: w.spanish,
                nasaYuwe: w.nasaYuwe,
                pronunciation: w.pronunciation,
                category: w.category,
                culturalContext: w.culturalContext,
              }))
            )
          } else {
            setAllWords([])
          }
        } else {
          const res = await fetch("/api/dictionary/export?page=1&pageSize=1000")
          if (res.ok) {
            const data = await res.json()
            const apiWords: ExploreWord[] = (data.words ?? []).map(
              (w: Record<string, unknown>) => ({
                id: w.id as string,
                spanish: w.spanish as string,
                nasaYuwe: w.nasaYuwe as string,
                pronunciation: (w.pronunciation as string) ?? null,
                category: (w.category as string) ?? null,
                culturalContext: (w.culturalContext as string) ?? null,
              })
            )
            setAllWords(apiWords)
            setLocalReady(true)
          } else {
            const ready = await isLocalDBReady()
            setLocalReady(ready)
            if (ready) {
              const localWords = await getAllLocalWords()
              setAllWords(
                localWords.map((w) => ({
                  id: w.id,
                  spanish: w.spanish,
                  nasaYuwe: w.nasaYuwe,
                  pronunciation: w.pronunciation,
                  category: w.category,
                  culturalContext: w.culturalContext,
                }))
              )
            }
          }
        }
      } catch {
        try {
          const ready = await isLocalDBReady()
          setLocalReady(ready)
          if (ready) {
            const localWords = await getAllLocalWords()
            setAllWords(
              localWords.map((w) => ({
                id: w.id,
                spanish: w.spanish,
                nasaYuwe: w.nasaYuwe,
                pronunciation: w.pronunciation,
                category: w.category,
                culturalContext: w.culturalContext,
              }))
            )
          }
        } catch {
          // Nothing works
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadWords()
  }, [isOnline])

  // ─── Derived data ────────────────────────────────────────────────────────

  const categories = useMemo(() => extractCategories(allWords), [allWords])

  const filteredWords = useMemo(() => {
    if (!selectedCategory) return allWords
    return allWords.filter((word) =>
      parseCategories(word.category).includes(selectedCategory.toLowerCase())
    )
  }, [allWords, selectedCategory])

  const letterGroups = useMemo(() => groupByLetter(filteredWords), [filteredWords])
  const activeLetters = useMemo(() => getActiveLetters(letterGroups), [letterGroups])

  // Virtual rows for the virtualizer
  const virtualRows = useMemo(() => buildVirtualRows(letterGroups), [letterGroups])
  const letterIndexMap = useMemo(() => buildLetterIndexMap(virtualRows), [virtualRows])

  const totalFiltered = filteredWords.length

  // ─── Virtualizer ─────────────────────────────────────────────────────────

  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index]
      if (!row) return 48
      return row.type === "header" ? 52 : 56
    },
    overscan: 20,
  })

  // ─── Handlers ────────────────────────────────────────────────────────────

  const scrollToLetter = useCallback((letter: string) => {
    const index = letterIndexMap.get(letter)
    if (index !== undefined) {
      virtualizer.scrollToIndex(index, { align: "start", behavior: "smooth" })
    }
  }, [letterIndexMap, virtualizer])

  const handleWordClick = useCallback((wordId: string) => {
    onWordSelect?.(wordId)
  }, [onWordSelect])

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category)
    setFilterDropdownOpen(false)
  }, [])

  // ─── Don't render during SSR ────────────────────────────────────────────

  if (!mounted) return null

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <List className="h-7 w-7 text-primary" />
            Índice Alfabético
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Todas las palabras ordenadas de la A a la Z
          </p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="ml-3 text-muted-foreground">Cargando diccionario...</span>
        </div>
      </div>
    )
  }

  // ─── Offline + Not Downloaded ───────────────────────────────────────────

  if (!isOnline && !localReady) {
    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <List className="h-7 w-7 text-primary" />
            Índice Alfabético
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Todas las palabras ordenadas de la A a la Z
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30">
            <Download className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-medium text-foreground max-w-md text-center">
            El diccionario se está descargando.
          </p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            Podrás ver el listado completo cuando termine la descarga.
          </p>
        </div>
      </div>
    )
  }

  // ─── No Words ───────────────────────────────────────────────────────────

  if (allWords.length === 0) {
    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <List className="h-7 w-7 text-primary" />
            Índice Alfabético
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <CloudOff className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay palabras disponibles</p>
        </div>
      </div>
    )
  }

  // ─── Main Content ───────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
          <List className="h-7 w-7 text-primary" />
          Índice Alfabético
        </h2>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          {selectedCategory
            ? `Filtrado por ${getCategoryDisplay(selectedCategory)}`
            : "Todas las palabras ordenadas de la A a la Z"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalFiltered} palabra{totalFiltered !== 1 ? "s" : ""}
          {selectedCategory && (
            <> · <button
              type="button"
              onClick={() => handleCategorySelect(null)}
              className="text-primary hover:underline"
            >
              Mostrar todas
            </button></>
          )}
        </p>
      </div>

      {/* ─── Category Filter Bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setFilterDropdownOpen((prev) => !prev)}
          >
            <Filter className="h-4 w-4" />
            Filtrar por categoría
            {selectedCategory && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {getCategoryDisplay(selectedCategory)}
              </Badge>
            )}
            <ChevronDown className={`h-3 w-3 transition-transform ${filterDropdownOpen ? "rotate-180" : ""}`} />
          </Button>

          {filterDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setFilterDropdownOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
                <div className="p-1 max-h-72 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => handleCategorySelect(null)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      !selectedCategory
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    Todas las categorías
                  </button>

                  <Separator className="my-1" />

                  {categories.map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => handleCategorySelect(cat)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        selectedCategory === cat
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {getCategoryDisplay(cat)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {selectedCategory && (
          <Badge
            variant="secondary"
            className="gap-1.5 py-1 px-3 text-xs cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => handleCategorySelect(null)}
          >
            {getCategoryDisplay(selectedCategory)}
            <X className="h-3 w-3" />
          </Badge>
        )}
      </div>

      {/* ─── Filtered: No results ─────────────────────────────────────────── */}
      {filteredWords.length === 0 && selectedCategory && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Filter className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            No hay palabras en esta categoría
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCategorySelect(null)}
          >
            <X className="h-4 w-4" />
            Limpiar filtro
          </Button>
        </div>
      )}

      {/* ─── Virtualized A-Z List ─────────────────────────────────────────── */}
      {filteredWords.length > 0 && (
        <>
          {/* Letter index — horizontal on mobile */}
          <div className="lg:hidden mb-4">
            <div className="flex flex-wrap justify-center gap-1">
              {SPANISH_ALPHABET.map((letter) => {
                const isActive = activeLetters.has(letter)
                return (
                  <button
                    type="button"
                    key={letter}
                    onClick={() => isActive && scrollToLetter(letter)}
                    disabled={!isActive}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? "text-primary hover:bg-primary/10 cursor-pointer"
                        : "text-muted-foreground/30 cursor-default"
                    }`}
                    aria-label={`Ir a la letra ${letter}`}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content area with sidebar + virtualized list */}
          <div className="flex gap-6">
            {/* Letter sidebar — desktop only */}
            <nav
              className="hidden lg:flex flex-col gap-0.5 shrink-0 sticky top-20 self-start"
              aria-label="Índice de letras"
            >
              {SPANISH_ALPHABET.map((letter) => {
                const isActive = activeLetters.has(letter)
                return (
                  <button
                    type="button"
                    key={letter}
                    onClick={() => isActive && scrollToLetter(letter)}
                    disabled={!isActive}
                    className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "text-primary hover:bg-primary/10 cursor-pointer border border-transparent hover:border-primary/20"
                        : "text-muted-foreground/30 cursor-default"
                    }`}
                    aria-label={`Ir a la letra ${letter}`}
                  >
                    {letter}
                  </button>
                )
              })}
            </nav>

            {/* Virtualized word list */}
            <div className="flex-1 min-w-0">
              <div
                ref={scrollRef}
                className="h-[600px] lg:h-[700px] overflow-y-auto rounded-lg"
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const row = virtualRows[virtualItem.index]
                    if (!row) return null

                    if (row.type === "header") {
                      return (
                        <div
                          key={virtualItem.key}
                          id={`letter-${row.letter}`}
                          data-index={virtualItem.index}
                          ref={virtualizer.measureElement}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualItem.start}px)`,
                          }}
                          className="bg-gradient-to-r from-primary/10 via-surface-container-high to-transparent py-2 px-3 rounded-t-md border-l-4 border-primary"
                        >
                          <h3 className="font-serif text-2xl font-bold text-primary">
                            {row.letter}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {row.count} palabra{row.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      )
                    }

                    // Word row
                    const word = row.word
                    return (
                      <div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleWordClick(word.id)}
                          className="flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-surface-container-low hover:shadow-sm border border-transparent hover:border-outline-variant/30 group w-full"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                {word.spanish}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">
                                —
                              </span>
                              <span className="font-serif text-sm text-primary font-medium truncate">
                                {word.nasaYuwe}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {word.pronunciation && (
                                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                  <Volume2 className="h-2.5 w-2.5" />
                                  [{word.pronunciation}]
                                </span>
                              )}
                              {word.category && (
                                <div className="flex flex-wrap gap-1">
                                  {parseCategories(word.category).map((cat) => (
                                    <Badge
                                      key={cat}
                                      variant="secondary"
                                      className="text-[9px] px-1 py-0 h-3.5 bg-surface-container-highest text-foreground hover:bg-tertiary-fixed transition-colors"
                                    >
                                      {getCategoryDisplay(cat)}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <BookOpen className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Total count footer */}
              {totalFiltered > 0 && (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">
                    {totalFiltered} palabra{totalFiltered !== 1 ? "s" : ""} en total
                    {!isOnline && localReady && " · Sin conexión"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
