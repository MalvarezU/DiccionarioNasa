"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getAllLocalWords, isLocalDBReady } from "@/lib/local-db";
import {
  buildLetterCounts,
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

/** Fixed height of one multi-column index row (px). Entries fill it exactly. */
export const INDEX_ROW_HEIGHT = 76;
/** Offset subtracted on scroll-to-letter so the row clears the sticky strip. */
export const INDEX_STRIP_OFFSET = 56;

/**
 * Column count for the A–Z index grid: 1 below md, 2 from md, 3 from xl.
 * SSR default is 1 so hydration never mismatches (the section renders
 * null until mounted anyway); the real value resolves in an effect.
 */
function useIndexColumns(): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const xl = window.matchMedia("(min-width: 1280px)");
    const md = window.matchMedia("(min-width: 768px)");
    const update = () => setColumns(xl.matches ? 3 : md.matches ? 2 : 1);
    update();
    xl.addEventListener("change", update);
    md.addEventListener("change", update);
    return () => {
      xl.removeEventListener("change", update);
      md.removeEventListener("change", update);
    };
  }, []);

  return columns;
}

/**
 * Índice alfabético: carga (online con fallback local), filtro por categoría,
 * grupos por letra chunked en filas multi-entrada y virtualizador de altura
 * fija. La UI vive en explore-section.tsx.
 */
export function useExploreWords(onWordSelect?: (wordId: string) => void) {
  const mounted = useMounted();
  const isOnline = useOnlineStatus();

  const [allWords, setAllWords] = useState<ExploreWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localReady, setLocalReady] = useState<boolean | null>(null);

  // Category filter state (the shadcn Select owns its open state)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Manual letter from scrolling; null = follow the first group. Deriving the
  // fallback during render (instead of defaulting in an effect) keeps the
  // sticky strip and rail highlight correct on the very first data commit.
  const [manualLetter, setManualLetter] = useState<string | null>(null);

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

  const columns = useIndexColumns();

  const categories = useMemo(() => extractCategories(allWords), [allWords]);

  const filteredWords = useMemo(() => {
    if (!selectedCategory) return allWords;
    return allWords.filter((word) =>
      parseCategories(word.category).includes(selectedCategory.toLowerCase())
    );
  }, [allWords, selectedCategory]);

  const letterGroups = useMemo(() => groupByLetter(filteredWords), [filteredWords]);
  const activeLetters = useMemo(() => getActiveLetters(letterGroups), [letterGroups]);
  const letterCounts = useMemo(() => buildLetterCounts(letterGroups), [letterGroups]);

  // Virtual rows: each group's words chunked into fixed-height grid rows
  const virtualRows = useMemo(
    () => buildVirtualRows(letterGroups, columns),
    [letterGroups, columns]
  );
  const letterIndexMap = useMemo(() => buildLetterIndexMap(virtualRows), [virtualRows]);

  const totalFiltered = filteredWords.length;
  const currentLetter = manualLetter ?? letterGroups[0]?.letter ?? null;
  const currentCount = currentLetter ? (letterCounts.get(currentLetter) ?? 0) : 0;

  // Forget the manual letter whenever the underlying groups change
  // (filter change, reload) so the strip never shows a stale letter.
  useEffect(() => {
    setManualLetter(null);
  }, [letterGroups]);

  // ─── Virtualizer (fixed heights — no measureElement) ─────────────────────

  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => INDEX_ROW_HEIGHT,
    overscan: 20,
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  // O(1) current-letter tracking off the same scroll position — no observers.
  const handleListScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || virtualRows.length === 0) return;
    const index = Math.min(
      virtualRows.length - 1,
      Math.max(0, Math.floor(el.scrollTop / INDEX_ROW_HEIGHT))
    );
    const letter = virtualRows[index]?.letter ?? null;
    setManualLetter((prev) => (prev === letter ? prev : letter));
  }, [virtualRows]);

  // Row heights are fixed and uniform, so the target offset is exact.
  const scrollToLetter = useCallback((letter: string) => {
    const index = letterIndexMap.get(letter);
    const el = scrollRef.current;
    if (index === undefined || !el || typeof el.scrollTo !== "function") return;
    setManualLetter(letter);
    el.scrollTo({
      top: Math.max(0, index * INDEX_ROW_HEIGHT - INDEX_STRIP_OFFSET),
      behavior: "smooth",
    });
  }, [letterIndexMap]);

  const handleWordClick = useCallback((wordId: string) => {
    onWordSelect?.(wordId);
  }, [onWordSelect]);

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setManualLetter(null);
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: 0 });
    }
  }, []);

  return {
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
  };
}
