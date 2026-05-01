"use client"

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react"
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
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SPANISH_ALPHABET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
]

/** Number of words to show per "page" (HU1.4.4) */
const PAGE_SIZE = 30

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
 * Group words by their normalized initial letter.
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

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([letter, words]) => ({ letter, words }))
}

/**
 * Get the set of letters that have words.
 */
function getActiveLetters(groups: LetterGroup[]): Set<string> {
  return new Set(groups.map((g) => g.letter))
}

/**
 * Flatten letter groups back into a flat word list.
 */
function flattenGroups(groups: LetterGroup[]): ExploreWord[] {
  const result: ExploreWord[] = []
  for (const group of groups) {
    result.push(...group.words)
  }
  return result
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

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

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

  // Extract available categories from all words
  const categories = useMemo(() => extractCategories(allWords), [allWords])

  // Filter words by selected category
  const filteredWords = useMemo(() => {
    if (!selectedCategory) return allWords
    return allWords.filter((word) =>
      parseCategories(word.category).includes(selectedCategory.toLowerCase())
    )
  }, [allWords, selectedCategory])

  // Group filtered words by letter
  const letterGroups = useMemo(() => groupByLetter(filteredWords), [filteredWords])
  const activeLetters = useMemo(() => getActiveLetters(letterGroups), [letterGroups])

  // Flatten groups for pagination — we paginate the flat list, then re-group
  const flatFiltered = useMemo(() => flattenGroups(letterGroups), [letterGroups])

  // Paginated words (the visible subset)
  const visibleWords = useMemo(
    () => flatFiltered.slice(0, visibleCount),
    [flatFiltered, visibleCount]
  )

  // Re-group only the visible words for rendering
  const visibleLetterGroups = useMemo(() => groupByLetter(visibleWords), [visibleWords])

  const hasMore = visibleCount < flatFiltered.length
  const totalFiltered = flatFiltered.length

  // ─── Handlers ────────────────────────────────────────────────────────────

  const scrollToLetter = useCallback((letter: string) => {
    const element = document.getElementById(`letter-${letter}`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  const handleWordClick = useCallback((wordId: string) => {
    onWordSelect?.(wordId)
  }, [onWordSelect])

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category)
    setFilterDropdownOpen(false)
    // Reset pagination when filter changes (HU1.4.4)
    setVisibleCount(PAGE_SIZE)
  }, [])

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE)
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
              onClick={() => handleCategorySelect(null)}
              className="text-primary hover:underline"
            >
              Mostrar todas
            </button></>
          )}
        </p>
      </div>

      {/* ─── Category Filter Bar (HU1.4.3) ──────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {/* Filter dropdown */}
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

          {/* Dropdown */}
          {filterDropdownOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setFilterDropdownOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
                <div className="p-1 max-h-72 overflow-y-auto">
                  {/* "Todas" option */}
                  <button
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

                  {/* Category options */}
                  {categories.map((cat) => (
                    <button
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

        {/* Active filter pill with clear button */}
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

      {/* ─── Letter Index — horizontal on mobile, sticky sidebar on desktop ─ */}
      {filteredWords.length > 0 && (
        <>
          <div className="lg:hidden mb-4">
            <div className="flex flex-wrap justify-center gap-1">
              {SPANISH_ALPHABET.map((letter) => {
                const isActive = activeLetters.has(letter)
                return (
                  <button
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

          {/* Content area with optional sidebar */}
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

            {/* Word list grouped by letter */}
            <div className="flex-1 min-w-0">
              {visibleLetterGroups.map((group) => (
                <div key={group.letter} className="mb-6">
                  {/* Letter header */}
                  <div
                    id={`letter-${group.letter}`}
                    className="scroll-mt-20 sticky top-14 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 pb-2 mb-3"
                  >
                    <h3 className="text-2xl font-bold text-primary">
                      {group.letter}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {group.words.length} palabra{group.words.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Words in this letter group */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {group.words.map((word) => (
                      <button
                        key={word.id}
                        onClick={() => handleWordClick(word.id)}
                        className="flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:bg-primary/5 hover:border-primary/20 border border-transparent hover:shadow-sm group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                              {word.spanish}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              —
                            </span>
                            <span className="text-sm text-primary font-medium truncate">
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
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1 py-0 h-3.5"
                              >
                                {word.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <BookOpen className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>

                  <Separator className="mt-4" />
                </div>
              ))}

              {/* ─── Load More Button (HU1.4.4) ─────────────────────────────── */}
              {hasMore && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleLoadMore}
                    className="gap-2 min-w-[200px]"
                  >
                    <List className="h-4 w-4" />
                    Cargar más palabras
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Mostrando {visibleCount} de {totalFiltered} palabras
                  </p>
                </div>
              )}

              {/* All loaded indicator */}
              {!hasMore && totalFiltered > PAGE_SIZE && (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground">
                    Se han cargado todas las {totalFiltered} palabras
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
