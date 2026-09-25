"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getAllLocalWords, isLocalDBReady } from "@/lib/local-db";
import {
  buildLetterIndexMap,
  buildVirtualRows,
  extractCategories,
  getActiveLetters,
  groupByLetter,
  parseCategories,
  toExploreWord,
  type ExploreWord,
} from "./explore-data";

const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * Índice alfabético: carga (online con fallback local), filtro por categoría,
 * grupos por letra y virtualizador. La UI vive en explore-section.tsx.
 */
export function useExploreWords(onWordSelect?: (wordId: string) => void) {
  const mounted = useMounted();
  const isOnline = useOnlineStatus();

  const [allWords, setAllWords] = useState<ExploreWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localReady, setLocalReady] = useState<boolean | null>(null);

  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  // Ref for the scrollable container used by the virtualizer
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Load words ──────────────────────────────────────────────────────────

  useEffect(() => {
    const loadLocalWords = async (clearWhenNotReady = true): Promise<void> => {
      const ready = await isLocalDBReady();
      setLocalReady(ready);
      if (ready) {
        const localWords = await getAllLocalWords();
        setAllWords(localWords.map(toExploreWord));
      } else if (clearWhenNotReady) {
        setAllWords([]);
      }
    };

    const loadWords = async () => {
      setIsLoading(true);
      try {
        if (!isOnline) {
          await loadLocalWords();
        } else {
          const res = await fetch("/api/dictionary/export?page=1&pageSize=1000");
          if (res.ok) {
            const data = await res.json();
            const apiWords: ExploreWord[] = (data.words ?? []).map(
              (w: Record<string, unknown>) => ({
                id: w.id as string,
                spanish: w.spanish as string,
                nasaYuwe: w.nasaYuwe as string,
                pronunciation: (w.pronunciation as string) ?? null,
                category: (w.category as string) ?? null,
                culturalContext: (w.culturalContext as string) ?? null,
              })
            );
            setAllWords(apiWords);
            setLocalReady(true);
          } else {
            await loadLocalWords(false);
          }
        }
      } catch {
        try {
          await loadLocalWords(false);
        } catch {
          // Nothing works
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadWords();
  }, [isOnline]);

  // ─── Derived data ────────────────────────────────────────────────────────

  const categories = useMemo(() => extractCategories(allWords), [allWords]);

  const filteredWords = useMemo(() => {
    if (!selectedCategory) return allWords;
    return allWords.filter((word) =>
      parseCategories(word.category).includes(selectedCategory.toLowerCase())
    );
  }, [allWords, selectedCategory]);

  const letterGroups = useMemo(() => groupByLetter(filteredWords), [filteredWords]);
  const activeLetters = useMemo(() => getActiveLetters(letterGroups), [letterGroups]);

  // Virtual rows for the virtualizer
  const virtualRows = useMemo(() => buildVirtualRows(letterGroups), [letterGroups]);
  const letterIndexMap = useMemo(() => buildLetterIndexMap(virtualRows), [virtualRows]);

  const totalFiltered = filteredWords.length;

  // ─── Virtualizer ─────────────────────────────────────────────────────────

  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (!row) return 48;
      return row.type === "header" ? 52 : 56;
    },
    overscan: 20,
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  const scrollToLetter = useCallback((letter: string) => {
    const index = letterIndexMap.get(letter);
    if (index !== undefined) {
      virtualizer.scrollToIndex(index, { align: "start", behavior: "smooth" });
    }
  }, [letterIndexMap, virtualizer]);

  const handleWordClick = useCallback((wordId: string) => {
    onWordSelect?.(wordId);
  }, [onWordSelect]);

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setFilterDropdownOpen(false);
  }, []);

  return {
    mounted,
    isOnline,
    allWords,
    isLoading,
    localReady,
    selectedCategory,
    filterDropdownOpen,
    setFilterDropdownOpen,
    scrollRef,
    categories,
    filteredWords,
    activeLetters,
    virtualRows,
    totalFiltered,
    virtualizer,
    scrollToLetter,
    handleWordClick,
    handleCategorySelect,
  };
}
