"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { useOfflineAudio } from "@/hooks/use-offline-audio";
import { getLocalWord, isLocalDBReady } from "@/lib/local-db";
import { isLocalFavorite, toggleLocalFavorite } from "@/lib/demo-storage";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { parseCategories, type WordDetail } from "./word-detail";

function toWordDetail(localWord: {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation?: string | null;
  audioUrl?: string | null;
  culturalContext?: string | null;
  category?: string | null;
  examples?: string | null;
}): WordDetail {
  return {
    id: localWord.id,
    spanish: localWord.spanish,
    nasaYuwe: localWord.nasaYuwe,
    pronunciation: localWord.pronunciation ?? null,
    audioUrl: localWord.audioUrl ?? null,
    culturalContext: localWord.culturalContext ?? null,
    category: localWord.category ?? null,
    examples: localWord.examples ? JSON.parse(localWord.examples) : null,
  } as WordDetail;
}

/**
 * Datos de la ficha: detalle (online con fallback local), favorita y audio
 * offline. La UI vive en word-content.tsx y word-detail-card.tsx.
 */
export function useWordDetail(wordId: string | null, open: boolean) {
  const [word, setWord] = useState<WordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFav, setIsTogglingFav] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { data: session } = useSession();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  // Track whether the favorite change was triggered by user action
  const pendingOfflineAction = useRef<"download" | "remove" | null>(null);

  const isAuthenticated = !!session?.user;

  // Use offline audio hook
  const {
    audioSrc,
    isCached,
    isDownloading,
    downloadProgress,
    downloadForOffline,
    removeFromCache,
    storageInfo,
  } = useOfflineAudio(word?.audioUrl ?? null);

  // Fetch word details when opened
  useEffect(() => {
    if (!wordId || !open) {
      setWord(null);
      return;
    }

    const fetchWord = async () => {
      setIsLoading(true);
      try {
        if (!isOnline) {
          const localReady = await isLocalDBReady();
          if (localReady) {
            const localWord = await getLocalWord(wordId);
            setWord(localWord ? toWordDetail(localWord) : null);
          } else {
            setWord(null);
          }
        } else {
          const response = await fetch(`/api/dictionary/words/${wordId}`);
          if (response.ok) {
            const data = await response.json();
            setWord(data);
          } else {
            setWord(null);
          }
        }
      } catch {
        try {
          const localWord = await getLocalWord(wordId);
          setWord(localWord ? toWordDetail(localWord) : null);
        } catch {
          setWord(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchWord();
  }, [wordId, open, isOnline]);

  // Check favorite status
  useEffect(() => {
    if (!wordId || !open || !isAuthenticated) {
      setIsFavorite(false);
      return;
    }

    const userId = (session?.user as any)?.id || 'demo-user';

    const checkFavorite = async () => {
      try {
        const response = await fetch(
          `/api/dictionary/favorites?wordId=${wordId}`
        );
        if (response.ok) {
          const data = await response.json();
          setIsFavorite(data.isFavorite);
          return
        }
      } catch {
        // Fall through to localStorage fallback
      }
      // localStorage fallback for demo mode
      setIsFavorite(isLocalFavorite(userId, wordId));
    };

    checkFavorite();
  }, [wordId, open, isAuthenticated, session]);

  // Handle auto-download/remove of offline audio when favorite status changes
  useEffect(() => {
    const action = pendingOfflineAction.current;
    if (!action) return;
    pendingOfflineAction.current = null;

    if (action === "download" && word?.audioUrl) {
      downloadForOffline().then(() => {
        toast({
          title: "Audio descargado",
          description: "Audio descargado para uso sin conexión",
        });

        if (storageInfo && storageInfo.percentUsed > 80) {
          toast({
            title: "Almacenamiento limitado",
            description: `Has usado ${storageInfo.percentUsed.toFixed(0)}% del almacenamiento disponible. Considera eliminar audios antiguos.`,
            variant: "destructive",
          });
        }
      });
    } else if (action === "remove" && isCached) {
      removeFromCache().then(() => {
        toast({
          title: "Audio eliminado",
          description: "Audio eliminado del almacenamiento offline",
        });
      });
    }
  }, [isFavorite, word?.audioUrl, isCached, downloadForOffline, removeFromCache, toast, storageInfo]);

  const handleToggleFavorite = useCallback(async () => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    if (!wordId || isTogglingFav) return;

    setIsTogglingFav(true);
    const userId = (session?.user as any)?.id || 'demo-user';

    try {
      const response = await fetch("/api/dictionary/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId }),
      });

      if (response.status === 401) {
        setAuthModalOpen(true);
        setIsTogglingFav(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite);

        if (data.isFavorite) {
          pendingOfflineAction.current = "download";
        } else {
          pendingOfflineAction.current = "remove";
        }

        toast({
          title: data.isFavorite ? "Añadido a favoritos" : "Eliminado de favoritos",
          description: data.isFavorite
            ? "La palabra se ha guardado en tus favoritos."
            : "La palabra se ha eliminado de tus favoritos.",
        });
      } else {
        throw new Error('API error')
      }
    } catch {
      // Fallback to localStorage for demo mode
      const newState = toggleLocalFavorite(userId, wordId);
      setIsFavorite(newState);

      if (newState) {
        pendingOfflineAction.current = "download";
      } else {
        pendingOfflineAction.current = "remove";
      }

      toast({
        title: newState ? "Añadido a favoritos" : "Eliminado de favoritos",
        description: newState
          ? "La palabra se ha guardado en tus favoritos (offline)."
          : "La palabra se ha eliminado de tus favoritos.",
      });
    } finally {
      setIsTogglingFav(false);
    }
  }, [wordId, isAuthenticated, isTogglingFav, toast, session]);

  const categories = parseCategories(word?.category ?? null);

  return {
    word,
    isLoading,
    categories,
    isFavorite,
    isTogglingFav,
    isAuthenticated,
    isOnline,
    audioSrc,
    isCached,
    isDownloading,
    downloadProgress,
    storageInfo,
    authModalOpen,
    setAuthModalOpen,
    handleToggleFavorite,
  };
}
