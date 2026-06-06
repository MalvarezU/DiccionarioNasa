"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Volume2, CloudOff, Cloud, Database, WifiOff, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useOnlineStatus } from "@/hooks/use-online-status";
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
}

interface SearchBarProps {
  /** "hero" = large centered bar for main area, "inline" = compact for headers */
  variant?: "hero" | "inline";
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
  const listRef = useRef<HTMLUListElement>(null);

  const isHero = variant === "hero";
  const showDropdown = isOpen && debouncedQuery.length >= 2;
  const hasNoResults = showDropdown && !isLoading && results.length === 0;
  const [localDBReady, setLocalDBReady] = useState<boolean | null>(null);

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
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      setQuery("");
      setIsOpen(false);
      // Open the word detail card
      setSelectedWordId(result.id);
      setDetailOpen(true);
      // Also notify parent if callback provided
      onWordSelect?.(result.id);
    },
    [onWordSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < results.length) {
            handleSelect(results[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, results, highlightedIndex, handleSelect]
  );

  return (
    <>
      <div
        ref={containerRef}
        className={isHero ? "relative w-full max-w-2xl mx-auto" : "relative w-full max-w-xl"}
      >
        {/* Search Input */}
        <div className="relative">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${isHero ? "h-5 w-5" : "h-4 w-4"}`}
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
            className={`pl-10 w-full bg-background/60 border-border/50 focus-visible:border-primary/50 ${
              isHero
                ? "h-14 text-lg rounded-xl pr-10 shadow-sm focus-visible:shadow-md transition-shadow"
                : "h-10 pr-9"
            }`}
            aria-label="Buscar palabras en el diccionario"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            role="combobox"
          />
          {isLoading && (
            <Loader2
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin ${isHero ? "h-5 w-5" : "h-4 w-4"}`}
            />
          )}
        </div>

        {/* HU1.1.8 — Offline indicator BELOW the input */}
        {!isOnline && (
          <div className="mt-2 flex items-center gap-1.5 justify-center">
            <CloudOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Búsqueda local (sin conexión)
            </span>
          </div>
        )}

        {/* Online indicator */}
        {isOnline && isHero && (
          <div className="mt-2 flex items-center gap-1.5 justify-center">
            <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs text-white">
              Búsqueda en línea
            </span>
          </div>
        )}

        {/* Dropdown with results */}
        {showDropdown && (
          <div
            className={`absolute top-full left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden animate-in fade-in duration-200 ${
              isHero ? "mt-2 rounded-xl" : "mt-1"
            }`}
          >
            {/* Offline banner — context-aware for local DB readiness */}
            {!isOnline && (
              <div className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border-b border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900 flex items-center gap-1.5">
                <CloudOff className="h-3 w-3" />
                {localDBReady
                  ? "Sin conexión — mostrando resultados locales"
                  : "Sin conexión — descarga el diccionario para buscar sin internet"}
              </div>
            )}

            {/* HU1.1.7 — No results with suggest button */}
            {hasNoResults ? (
              <div className="px-4 py-6 text-center">
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
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
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
              <ul
                ref={listRef}
                className={isHero ? "max-h-[420px] overflow-y-auto py-1" : "max-h-80 overflow-y-auto py-1"}
                role="listbox"
              >
                {results.map((result, index) => (
                  <li
                    key={result.id}
                    data-search-item
                    role="option"
                    aria-selected={index === highlightedIndex}
                    className={`
                      flex items-center gap-3 cursor-pointer transition-colors
                      ${isHero ? "px-4 py-3" : "px-3 py-2.5"}
                      ${
                        index === highlightedIndex
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted/60 text-foreground"
                      }
                    `}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isHero ? "text-base" : "text-sm"}`}>
                          {result.nasaYuwe}
                        </span>
                        <span className={`text-muted-foreground ${isHero ? "text-sm" : "text-xs"}`}>
                          — {result.spanish}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {result.pronunciation && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Volume2 className="h-3 w-3" />
                            [{result.pronunciation}]
                          </span>
                        )}
                        {result.category && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            {result.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Word detail card (Sheet) */}
      <WordDetailCard
        wordId={selectedWordId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Suggest word modal */}
      <SuggestWordModal
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        initialTerm={debouncedQuery}
      />
    </>
  );
}
