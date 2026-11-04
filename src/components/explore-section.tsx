"use client"

import {
  List,
  Filter,
  X,
  CloudOff,
  Download,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ExploreListSkeleton } from "@/components/skeletons"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select"
import { useExploreWords, INDEX_ROW_HEIGHT } from "./use-explore-words"
import {
  SPANISH_ALPHABET,
  getCategoryDisplay,
  type ExploreWord,
} from "./explore-data"

interface ExploreSectionProps {
  /** Callback when a word is selected — parent opens the detail card */
  onWordSelect?: (wordId: string) => void
}

type RailState = "current" | "active" | "inactive"

function railButtonClass(state: RailState, size: "desktop" | "mobile"): string {
  const base =
    "flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
  const sizing =
    size === "desktop" ? "h-8 w-8 text-sm" : "h-9 min-w-9 shrink-0 px-2 text-sm"
  if (state === "current") return `${base} ${sizing} bg-secondary/15 font-semibold text-secondary`
  if (state === "active") return `${base} ${sizing} text-foreground hover:bg-secondary/10`
  return `${base} ${sizing} text-muted-foreground/40`
}

function railStateFor(
  letter: string,
  activeLetters: Set<string>,
  currentLetter: string | null
): RailState {
  if (letter === currentLetter) return "current"
  return activeLetters.has(letter) ? "active" : "inactive"
}

/**
 * Ultracompact A–Z entry. Inline instead of WordCard variant="row" for two
 * reasons: (1) the multi-column virtualizer needs fixed-height rows, so
 * entries fill an exact 76px slot with no measurement; (2) at this density
 * the play button is dropped — audio lives in the detail card — keeping only
 * the [pronunciation] line. Same anatomy: serif nasaYuwe + spanish, hairline
 * border, surface-container-low background.
 */
function IndexEntry({ word, onOpen }: { word: ExploreWord; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(word.id)}
      aria-label={`Ver ficha de ${word.nasaYuwe}`}
      className="flex h-full min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-left transition-colors hover:border-secondary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate font-serif text-[17px] font-semibold leading-snug text-primary">
          {word.nasaYuwe}
        </span>
        <span className="truncate text-[13px] font-medium text-foreground">
          {word.spanish}
        </span>
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {word.pronunciation ? `[${word.pronunciation}]` : " "}
      </span>
    </button>
  )
}

export function ExploreSection({ onWordSelect }: ExploreSectionProps) {
  const {
    mounted,
    isOnline,
    allWords,
    isLoading,
    localReady,
    selectedCategory,
    scrollRef,
    columns,
    categories,
    filteredWords,
    activeLetters,
    currentLetter,
    currentCount,
    virtualRows,
    totalFiltered,
    virtualizer,
    handleListScroll,
    scrollToLetter,
    handleWordClick,
    handleCategorySelect,
  } = useExploreWords(onWordSelect)

  // ─── Don't render during SSR ────────────────────────────────────────────

  if (!mounted) return null

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <List className="h-7 w-7 text-primary" />
            Índice
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Todas las palabras ordenadas de la A a la Z
          </p>
        </div>
        <ExploreListSkeleton />
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
            Índice
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Todas las palabras ordenadas de la A a la Z
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-50">
            <Download className="h-8 w-8 text-amber-600" />
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
            Índice
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
          Índice
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
        <Select
          value={selectedCategory ?? "all"}
          onValueChange={(value) => handleCategorySelect(value === "all" ? null : value)}
        >
          <SelectTrigger size="sm" className="gap-2" aria-label="Filtrar por categoría">
            <Filter className="h-4 w-4" />
            <span>Filtrar por categoría</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            <SelectSeparator />
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {getCategoryDisplay(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      {/* ─── Virtualized A-Z Index ────────────────────────────────────────── */}
      {filteredWords.length > 0 && (
        <>
          {/* Letter rail — horizontal, sticky under the navbar on mobile */}
          <div className="lg:hidden sticky top-14 z-20 mb-4 rounded-lg border border-outline-variant/30 bg-background/95 backdrop-blur">
            <nav
              className="flex gap-0.5 overflow-x-auto px-2 py-2"
              aria-label="Índice de letras"
            >
              {SPANISH_ALPHABET.map((letter) => {
                const state = railStateFor(letter, activeLetters, currentLetter)
                const isActive = state !== "inactive"
                return (
                  <button
                    type="button"
                    key={letter}
                    onClick={() => isActive && scrollToLetter(letter)}
                    disabled={!isActive}
                    aria-disabled={!isActive}
                    aria-current={state === "current" ? "true" : undefined}
                    className={railButtonClass(state, "mobile")}
                    aria-label={`Ir a la letra ${letter}`}
                  >
                    {letter}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content area with sidebar + virtualized list */}
          <div className="flex gap-6">
            {/* Letter rail — desktop sidebar */}
            <nav
              className="hidden lg:flex flex-col gap-0.5 shrink-0 sticky top-20 self-start"
              aria-label="Índice de letras"
            >
              {SPANISH_ALPHABET.map((letter) => {
                const state = railStateFor(letter, activeLetters, currentLetter)
                const isActive = state !== "inactive"
                return (
                  <button
                    type="button"
                    key={letter}
                    onClick={() => isActive && scrollToLetter(letter)}
                    disabled={!isActive}
                    aria-disabled={!isActive}
                    aria-current={state === "current" ? "true" : undefined}
                    className={railButtonClass(state, "desktop")}
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
                onScroll={handleListScroll}
                data-testid="explore-scroll"
                className="h-[600px] lg:h-[700px] overflow-y-auto rounded-lg"
              >
                {/* Sticky letter strip — current letter while scrolling */}
                {currentLetter && (
                  <div className="sticky top-0 z-10 border-b border-outline-variant/40 bg-background/95 backdrop-blur">
                    <div className="flex items-baseline gap-1.5 px-3 py-1.5">
                      <span className="font-serif text-xl font-bold leading-none text-primary">
                        {currentLetter}
                        {currentLetter.toLowerCase() !== currentLetter
                          ? currentLetter.toLowerCase()
                          : ""}
                      </span>
                      <span aria-hidden="true" className="text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {currentCount} palabra{currentCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                )}

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

                    return (
                      <div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualItem.size || INDEX_ROW_HEIGHT}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <div
                          className="grid h-full gap-2"
                          style={{
                            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                          }}
                        >
                          {row.words.map((word) => (
                            <IndexEntry key={word.id} word={word} onOpen={handleWordClick} />
                          ))}
                          {Array.from(
                            { length: Math.max(0, columns - row.words.length) },
                            (_, i) => (
                              <div key={`empty-${i}`} aria-hidden="true" />
                            )
                          )}
                        </div>
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
