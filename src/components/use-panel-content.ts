"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  buildLocalFavorites,
  buildLocalHistory,
  clearLocalHistory,
  groupHistoryByDate,
  type FavoriteWord,
  type HistoryWord,
  type PanelTab,
} from "./panel-data";

interface UsePanelContentArgs {
  initialTab: PanelTab;
  onWordSelect: (wordId: string) => void;
  onClose: () => void;
}

/**
 * Datos del panel Mis Palabras: favoritas e historial (API con fallback
 * local), limpieza y agrupado por fecha. La UI vive en panel-content.tsx.
 */
export function usePanelContent({ initialTab, onWordSelect, onClose }: UsePanelContentArgs) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Favorites state
  const [favorites, setFavorites] = useState<FavoriteWord[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(
    initialTab === "favorites"
  );

  // History state
  const [history, setHistory] = useState<HistoryWord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(
    initialTab === "history"
  );

  // Reset tab when initialTab changes (e.g. opening panel with different tab)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Stable refs for fetch functions
  const userId = (session?.user as any)?.id || 'demo-user';

  // Single source-of-truth effect: fetch data for the active tab.
  // - Depends directly on activeTab (no fragile useCallback ref chain)
  // - Uses 'cancelled' flag in cleanup to avoid race conditions when
  //   the user switches tabs while a fetch is in flight
  // - Resets isLoadingX for the opposite tab so a previous spinner
  //   doesn't stay stuck on screen after switching
  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setFavorites([]);
      setHistory([]);
      setIsLoadingFavorites(false);
      setIsLoadingHistory(false);
      return;
    }

    if (activeTab === "favorites") {
      setIsLoadingFavorites(true);
      setIsLoadingHistory(false);
      fetch("/api/dictionary/favorites")
        .then((res) => (res.ok ? res.json() : null))
        .then(async (data) => {
          if (cancelled) return;
          if (data?.favorites && data.favorites.length > 0) {
            setFavorites(data.favorites);
            return;
          }
          setFavorites(await buildLocalFavorites(userId));
        })
        .catch(async () => {
          if (cancelled) return;
          setFavorites(await buildLocalFavorites(userId));
        })
        .finally(() => {
          if (!cancelled) setIsLoadingFavorites(false);
        });
    } else {
      // activeTab === "history"
      setIsLoadingHistory(true);
      setIsLoadingFavorites(false);
      fetch("/api/dictionary/history")
        .then((res) => (res.ok ? res.json() : null))
        .then(async (data) => {
          if (cancelled) return;
          if (data?.history && data.history.length > 0) {
            setHistory(data.history);
            return;
          }
          setHistory(await buildLocalHistory(userId));
        })
        .catch(async () => {
          if (cancelled) return;
          setHistory(await buildLocalHistory(userId));
        })
        .finally(() => {
          if (!cancelled) setIsLoadingHistory(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, isAuthenticated, userId]);

  const handleClearHistory = async () => {
    try {
      const res = await fetch("/api/dictionary/history", { method: "DELETE" });
      if (res.ok) {
        setHistory([]);
      }
    } catch {
      // Continue to clear localStorage even if API fails
    }
    // Also clear localStorage for demo mode
    clearLocalHistory(userId);
    setHistory([]);
  };

  const handleWordClick = useCallback(
    (wordId: string) => {
      onWordSelect(wordId);
      onClose();
    },
    [onWordSelect, onClose]
  );

  // Group history by date
  const groupedHistory = groupHistoryByDate(history);

  return {
    isAuthenticated,
    activeTab,
    setActiveTab,
    authModalOpen,
    setAuthModalOpen,
    favorites,
    isLoadingFavorites,
    history,
    isLoadingHistory,
    groupedHistory,
    handleClearHistory,
    handleWordClick,
  };
}
