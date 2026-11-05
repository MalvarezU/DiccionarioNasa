"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { Search, Loader2, Volume2, Pause, Play, CloudOff, Cloud, Database, WifiOff, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useSingleAudio } from "@/hooks/use-single-audio";
import { useToast } from "@/hooks/use-toast";
import { SuggestWordModal } from "@/components/suggest-word-modal";
import { WordDetailCard } from "@/components/word-detail-card";
import { searchLocalWords, isLocalDBReady } from "@/lib/local-db";

interface SearchResult {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  category: string | null;
  audioUrl?: string | null;
}

/** Accent-insensitive compare so grouping matches the API ranking (LIKE collation). */
function normalizeForGroup(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

interface SearchGroup {
  key: "exact" | "nasa" | "spanish";
  label: string;
  start: number;
  items: SearchResult[];
}

/**
 * Cheap, stable client grouping. Preserves the API relevance order inside
 * each group: exact (either field equals the query) → match in Nasa Yuwe →
 * match in Spanish (the rest).
 */
function groupSearchResults(results: SearchResult[], query: string): SearchGroup[] {
  const q = normalizeForGroup(query.trim());
  const exact: SearchResult[] = [];
  const nasa: SearchResult[] = [];
  const spanish: SearchResult[] = [];
  for (const r of results) {
    const nYu = normalizeForGroup(r.nasaYuwe);
    const es = normalizeForGroup(r.spanish);
    if (nYu === q || es === q) exact.push(r);
    else if (nYu.includes(q)) nasa.push(r);
    else spanish.push(r);
  }
  const groups: SearchGroup[] = [];
  let start = 0;
  const push = (key: SearchGroup["key"], label: string, items: SearchResult[]) => {
    if (items.length === 0) return;
    groups.push({ key, label, start, items });
    start += items.length;
  };
  push("exact", "Coincidencia exacta", exact);
  push("nasa", "En Nasa Yuwe", nasa);
  push("spanish", "En español", spanish);
  return groups;
}

interface SearchResultRowProps {
  result: SearchResult;
  index: number;
  highlighted: boolean;
  esGrande: boolean;
  onSelect: (result: SearchResult) => void;
  onHighlight: (index: number) => void;
  onPlayState: (playingId: string | null) => void;
}

/**
 * Single dropdown row (56px min height). The inline play button is local to
 * the row and never propagates the click; the parent pauses other rows via
 * `onPlayState`. Same local-audio pattern as WordCard.
 */
function SearchResultRow({
  result,
  index,
  highlighted,
  esGrande,
  onSelect,
  onHighlight,
  onPlayState,
}: SearchResultRowProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const hasAudio = Boolean(result.audioUrl);

  // Stop playback if the row unmounts while sounding (dropdown closes).
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const audio = audioRef.current;
      if (!audio) return;
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        onPlayState(null);
      } else {
        onPlayState(result.id);
        const playback = audio.play();
        if (playback) {
          playback
            .then(() => setIsPlaying(true))
            .catch(() => {
              setIsPlaying(false);
              onPlayState(null);
            });
        } else {
          setIsPlaying(true);
        }
      }
    },
    [isPlaying, onPlayState, result.id]
  );

  const playLabel = isPlaying
    ? "Pausar"
    : `Escuchar pronunciación de ${result.nasaYuwe}`;

  return (
    <li
      key={result.id}
      id={`search-option-${index}`}
      data-search-item
      role="option"
      aria-selected={highlighted}
      className={`
        flex items-center gap-3 cursor-pointer transition-all min-h-14
        ${esGrande ? "px-4 py-3" : "px-3 py-2.5"}
        ${
          highlighted
            ? "bg-surface-container-high text-foreground border-l-4 border-primary"
            : "hover:bg-surface-container-high text-foreground border-l-4 border-transparent hover:border-primary/50"
        }
      `}
      onClick={() => onSelect(result)}
      onMouseEnter={() => onHighlight(index)}
    >
      {hasAudio && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playLabel}
          aria-pressed={isPlaying}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/10 transition-colors hover:bg-secondary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 text-secondary" aria-hidden="true" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 text-secondary" aria-hidden="true" />
          )}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${esGrande ? "text-base" : "text-sm"}`}>
            {result.nasaYuwe}
          </span>
          <span className={`text-muted-foreground ${esGrande ? "text-sm" : "text-xs"}`}>
            — {result.spanish}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {result.pronunciation && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Volume2 className="h-3 w-3 text-secondary" />
              [{result.pronunciation}]
            </span>
          )}
          {result.category && (
            <Badge
              variant="secondary"
              className="text-2xs px-2 py-0.5 h-5 bg-tertiary-container text-tertiary border border-tertiary/20"
            >
              {result.category}
            </Badge>
          )}
        </div>
      </div>
      {hasAudio && (
        <audio
          ref={audioRef}
          data-word-id={result.id}
          src={result.audioUrl ?? undefined}
          preload="none"
          className="hidden"
          aria-hidden="true"
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            onPlayState(null);
          }}
        />
      )}
    </li>
  );
}

interface SearchBarProps {
  /** "hero" = large centered bar for main area, "inline" = compact for headers */
  /**
   * - inline: campo compacto (navbar, paneles).
   * - hero: campo grande SOBRE IMAGEN oscura → texto y borde blancos.
   * - hero-light: campo grande sobre fondo claro (hero del diccionario).
   */
  variant?: "hero" | "hero-light" | "hero-panel" | "inline";
  /** Callback when a word is selected — used by parent components */
  onWordSelect?: (wordId: string) => void;
}

export function SearchBar({ variant = "inline", onWordSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { containerRef: listRef, handlePlayState, stopAll } =
    useSingleAudio<HTMLUListElement>();

  /** Campo grande (presencia de hero), sea sobre imagen o sobre fondo claro. */
  const esGrande = variant !== "inline";
  /** El texto solo va blanco cuando el fondo real es oscuro (imagen). */
  const sobreOscuro = variant === "hero" || variant === "hero-panel";
  const panelMode = variant === "hero-panel";  const showDropdown = isOpen && debouncedQuery.length >= 2;
  const hasNoResults = showDropdown && !isLoading && results.length === 0;
  const [localDBReady, setLocalDBReady] = useState<boolean | null>(null);

  // Client-side grouping; flat order drives global highlightedIndex.
  const groups = useMemo(
    () => groupSearchResults(results, debouncedQuery),
    [results, debouncedQuery]
  );
  const flatResults = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups]
  );

  // Check local DB readiness on mount and when going offline
  useEffect(() => {
    const checkReady = async () => {
      try {
        const ready = await isLocalDBReady();
        setLocalDBReady(ready);
      } catch {
        setLocalDBReady(false);
      }
    };
    checkReady();
  }, [isOnline]);

  // Fetch search results — uses local IndexedDB when offline, API when online
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        // HU1.3.2: When offline, search from local IndexedDB
        if (!isOnline) {
          const localReady = await isLocalDBReady();
          setLocalDBReady(localReady);
          if (localReady) {
            const localResults = await searchLocalWords(debouncedQuery, 50);
            setResults(localResults);
          } else {
            setResults([]);
          }
        } else {
          // Online: use the API as before
          const response = await fetch(
            `/api/dictionary/search?q=${encodeURIComponent(debouncedQuery)}`
          );
          if (response.ok) {
            const data = await response.json();
            setResults(data.results ?? []);
          } else {
            setResults([]);
          }
        }
      } catch {
        // Fallback: try local search if API fails
        try {
          const localResults = await searchLocalWords(debouncedQuery, 50);
          setResults(localResults);
        } catch {
          setResults([]);
        }
      } finally {
        setIsLoading(false);
        setIsOpen(true);
        setHighlightedIndex(-1);
      }
    };

    fetchResults();
  }, [debouncedQuery, isOnline]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        stopAll();
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [stopAll]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-search-item]");
      const item = items[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      stopAll();
      setQuery("");
      setIsOpen(false);
      if (onWordSelect) {
        onWordSelect(result.id);
      } else {
        setSelectedWordId(result.id);
        setDetailOpen(true);
      }
    },
    [onWordSelect, stopAll]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || flatResults.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < flatResults.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : flatResults.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < flatResults.length) {
            handleSelect(flatResults[highlightedIndex]);
          }
          break;
        case "Escape":
          stopAll();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, flatResults, highlightedIndex, handleSelect, stopAll]
  );

  const handleHighlight = useCallback((index: number) => {
    setHighlightedIndex(index);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className={esGrande ? "relative w-full max-w-2xl mx-auto" : "relative w-full max-w-xl"}
      >
        {/* Search Input */}
        <div className="relative">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${sobreOscuro ? "text-white/70 h-5 w-5" : "text-muted-foreground h-4 w-4"}`}
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar en Nasa Yuwe o Español..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (debouncedQuery.length >= 2) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            className={`pl-10 w-full transition-colors ${
              sobreOscuro
                ? "h-14 text-base sm:text-lg rounded-xl pr-10 shadow-lg bg-black/45 backdrop-blur-md text-white placeholder:text-white/70 border-white/30 hover:border-white/60 focus-visible:border-white focus-visible:ring-white/30"
                : esGrande
                  ? "h-14 text-lg rounded-xl pr-10 bg-surface-container-low border shadow-md focus-visible:border-secondary/60 focus-visible:ring-secondary/25 text-foreground placeholder:text-muted-foreground focus-visible:shadow-lg"
                  : "h-10 pr-9 bg-surface-container-low border-border focus-visible:border-secondary/60 focus-visible:ring-secondary/25 text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:shadow-md"
            }`}
            aria-label="Buscar palabras en el diccionario"
            aria-expanded={showDropdown}
            aria-controls="search-results-list"
            aria-autocomplete="list"
            aria-activedescendant={highlightedIndex >= 0 ? `search-option-${highlightedIndex}` : undefined}
            role="combobox"
          />
          {isLoading && (
            <Loader2
              className={`absolute right-3 top-1/2 -translate-y-1/2 animate-spin ${sobreOscuro ? "text-white/70 h-5 w-5" : "text-muted-foreground h-4 w-4"}`}
            />
          )}
        </div>

        {/* HU1.1.8 — Offline indicator BELOW the input */}
        {!isOnline && (
          <div className="mt-2 flex items-center gap-1.5 justify-center">
            <CloudOff
              className={`h-3.5 w-3.5 ${sobreOscuro ? "text-amber-300" : "text-amber-600"}`}
            />
            <span
              className={`text-xs font-medium ${sobreOscuro ? "text-amber-200" : "text-amber-700"}`}
              style={sobreOscuro ? { textShadow: "0 1px 4px rgba(0,0,0,0.7)" } : undefined}
            >
              Búsqueda local (sin conexión)
            </span>
          </div>
        )}

        {/* Online indicator — not rendered inside the hero panel frame */}
        {isOnline && esGrande && !panelMode && (
          <div className="mt-2 flex items-center gap-1.5 justify-center">
            <Cloud
              className={`h-3.5 w-3.5 ${sobreOscuro ? "text-emerald-300" : "text-emerald-600"}`}
              aria-hidden="true"
            />
            <span
              className={`text-xs font-medium ${sobreOscuro ? "text-white/80" : "text-muted-foreground"}`}
              style={sobreOscuro ? { textShadow: "0 1px 4px rgba(0,0,0,0.7)" } : undefined}
            >
              Búsqueda en línea
            </span>
          </div>
        )}

        {/* Results — panelMode owns a permanent fixed-height ivory frame
            (idle hint and results swap inside it, so typing never moves the
            layout: zero CLS). Other variants keep the original absolute
            dropdown shown only on demand. */}
        {(panelMode || showDropdown) && (
          <div
            className={
              panelMode
                ? "mt-2 h-[48svh] lg:h-[420px] rounded-xl border border-outline-variant/20 bg-surface-container-low/95 backdrop-blur-2xl shadow-lg overflow-hidden"
                : `absolute top-full left-0 right-0 z-50 rounded-lg border border-outline-variant/20 bg-surface-container-low/95 backdrop-blur-2xl shadow-lg overflow-hidden animate-in fade-in duration-200 ${
                    esGrande ? "mt-2 rounded-xl" : "mt-1"
                  }`
            }
          >
            {panelMode && !showDropdown ? (
              <div className="flex h-full items-center justify-center px-6">
                <p className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
                  <Search className="h-5 w-5" aria-hidden="true" />
                  Escribí al menos 2 letras para ver resultados
                </p>
              </div>
            ) : (
              <div
                className={
                  panelMode
                    ? "flex h-full flex-col animate-in fade-in duration-200"
                    : undefined
                }
              >
                {/* Offline banner — context-aware for local DB readiness */}
                {!isOnline && (
                  <div className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border-b border-amber-200 flex items-center gap-1.5">
                    <CloudOff className="h-3 w-3" />
                    {localDBReady
                      ? "Sin conexión — mostrando resultados locales"
                      : "Sin conexión — descarga el diccionario para buscar sin internet"}
                  </div>
                )}

                {/* HU1.1.7 — No results with suggest button */}
                {hasNoResults ? (
                  <div
                    className={
                      panelMode
                        ? "flex flex-1 flex-col items-center justify-center px-4 py-6 text-center"
                        : "px-4 py-6 text-center"
                    }
                  >
                    <p className="text-sm text-muted-foreground mb-1">
                      No encontramos
                    </p>
                    <p className="text-base font-semibold text-foreground mb-3">
                      «{debouncedQuery}»
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      en el diccionario.
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1.5 bg-primary hover:bg-[#22303D] transition-colors"
                      disabled={!isOnline}
                      onClick={() => {
                        setSuggestOpen(true);
                        setIsOpen(false);
                      }}
                    >
                      <Lightbulb className="h-4 w-4" />
                      Sugerir esta palabra
                    </Button>
                    {!isOnline && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 justify-center">
                        <WifiOff className="h-3 w-3" />
                        Se necesita conexión para sugerir palabras
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <ul
                      ref={listRef}
                      id="search-results-list"
                      className={
                        panelMode
                          ? "max-h-full min-h-0 flex-1 overflow-y-auto py-1"
                          : esGrande
                            ? "max-h-[420px] overflow-y-auto py-1"
                            : "max-h-80 overflow-y-auto py-1"
                      }
                      role="listbox"
                      aria-label="Resultados de búsqueda"
                    >
                      {groups.map((group) => (
                        <Fragment key={group.key}>
                          <li
                            role="presentation"
                            className="flex items-center justify-between px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            <span>{group.label}</span>
                            <span>{group.items.length}</span>
                          </li>
                          {group.items.map((result, i) => (
                            <SearchResultRow
                              key={result.id}
                              result={result}
                              index={group.start + i}
                              highlighted={group.start + i === highlightedIndex}
                              esGrande={esGrande}
                              onSelect={handleSelect}
                              onHighlight={handleHighlight}
                              onPlayState={handlePlayState}
                            />
                          ))}
                        </Fragment>
                      ))}
                    </ul>
                    {results.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-outline-variant/20 px-3 py-2 text-xs text-muted-foreground">
                        {!panelMode && (
                          <span className="hidden items-center gap-1 sm:flex">
                            <kbd className="rounded border border-outline-variant/30 bg-surface-container-high px-1 py-px font-mono text-[12px] leading-4 text-foreground">↑</kbd>
                            <kbd className="rounded border border-outline-variant/30 bg-surface-container-high px-1 py-px font-mono text-[12px] leading-4 text-foreground">↓</kbd>
                            <span>navegar</span>
                            <span aria-hidden="true">·</span>
                            <kbd className="rounded border border-outline-variant/30 bg-surface-container-high px-1 py-px font-mono text-[12px] leading-4 text-foreground">↵</kbd>
                            <span>abrir</span>
                            <span aria-hidden="true">·</span>
                            <kbd className="rounded border border-outline-variant/30 bg-surface-container-high px-1 py-px font-mono text-[12px] leading-4 text-foreground">esc</kbd>
                            <span>cerrar</span>
                          </span>
                        )}
                        <span className={panelMode ? undefined : "ml-auto"}>
                          {results.length} {results.length === 1 ? "resultado" : "resultados"}
                        </span>
                        <a
                          href="/diccionario?tab=explore"
                          className={`font-medium text-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary${panelMode ? " ml-auto" : ""}`}
                        >
                          Ver todas en Explorar A-Z →
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Word detail card (Sheet) */}
      {!onWordSelect && (
        <WordDetailCard
          key={selectedWordId ?? "none"}
          wordId={selectedWordId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}

      {/* Suggest word modal */}
      <SuggestWordModal
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        initialTerm={debouncedQuery}
      />
    </>
  );
}
