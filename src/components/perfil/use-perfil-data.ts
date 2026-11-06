"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import type {
  CourseProgressSummary,
  PerfilFavorite,
  PerfilHistoryEntry,
  SearchHistoryEntry,
} from "./types";

export interface PerfilProfile {
  id: string;
  email: string;
  name: string | null;
  hasPassword: boolean;
}

export interface PerfilStats {
  favorites: number;
  views: number;
  coursesInProgress: number;
  lessonsCompleted: number;
}

interface PerfilData {
  profile: PerfilProfile | null;
  favorites: PerfilFavorite[];
  history: PerfilHistoryEntry[];
  searches: SearchHistoryEntry[];
  courses: CourseProgressSummary[];
  loading: boolean;
  stats: PerfilStats;
  removeFavorite: (wordId: string) => Promise<void>;
  removingId: string | null;
  clearHistory: () => Promise<void>;
  clearingHistory: boolean;
  clearSearches: () => Promise<void>;
  clearingSearches: boolean;
  setProfile: React.Dispatch<React.SetStateAction<PerfilProfile | null>>;
}

/**
 * Única fuente de datos de /perfil: trae perfil, favoritas, historial,
 * búsquedas y avance una sola vez (solo autenticado) y deriva los stats
 * del header de esas mismas respuestas — sin llamadas extra.
 * La página lee del SERVIDOR; el panel del diccionario sigue leyendo su
 * almacenamiento local (ver panel-data.ts): dos fuentes, una estética.
 */
export function usePerfilData(): PerfilData {
  const { status } = useSession();
  const { toast } = useToast();
  const isAuthenticated = status === "authenticated";

  // El objeto de use-toast (y sus mocks) puede cambiar de identidad por
  // render: guardarlo en ref para no re-disparar la carga inicial en loop.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const notify = useCallback(
    (args: Parameters<typeof toast>[0]) => toastRef.current(args),
    []
  );

  const [profile, setProfile] = useState<PerfilProfile | null>(null);
  const [favorites, setFavorites] = useState<PerfilFavorite[]>([]);
  const [history, setHistory] = useState<PerfilHistoryEntry[]>([]);
  const [searches, setSearches] = useState<SearchHistoryEntry[]>([]);
  const [courses, setCourses] = useState<CourseProgressSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearingSearches, setClearingSearches] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, favRes, histRes, searchRes, courseRes] =
          await Promise.all([
            fetch("/api/user/profile"),
            fetch("/api/dictionary/favorites"),
            fetch("/api/dictionary/history"),
            fetch("/api/dictionary/search-history"),
            fetch("/api/user/course-progress"),
          ]);
        if (cancelled) return;
        if (profileRes.ok) {
          const data = await profileRes.json().catch(() => null);
          if (data?.user) setProfile(data.user);
        }
        if (favRes.ok) {
          const data = await favRes.json().catch(() => null);
          if (Array.isArray(data?.favorites)) setFavorites(data.favorites);
        }
        if (histRes.ok) {
          const data = await histRes.json().catch(() => null);
          if (Array.isArray(data?.history)) setHistory(data.history);
        }
        if (searchRes.ok) {
          const data = await searchRes.json().catch(() => null);
          if (Array.isArray(data?.history)) setSearches(data.history);
        }
        if (courseRes.ok) {
          const data = await courseRes.json().catch(() => null);
          if (Array.isArray(data?.courses)) setCourses(data.courses);
        }
      } catch {
        if (!cancelled) {
          notify({
            title: "No se pudo cargar tu espacio",
            description: "Revisa tu conexión e intenta de nuevo.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [status, isAuthenticated, notify]);

  const removeFavorite = useCallback(
    async (wordId: string) => {
      setRemovingId(wordId);
      try {
        const res = await fetch("/api/dictionary/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordId }),
        });
        if (!res.ok) throw new Error();
        setFavorites((prev) => prev.filter((f) => f.wordId !== wordId));
        notify({ title: "Quitada de favoritas" });
      } catch {
        notify({
          title: "No se pudo quitar",
          description: "Intenta de nuevo.",
          variant: "destructive",
        });
      } finally {
        setRemovingId(null);
      }
    },
    [notify]
  );

  const clearHistory = useCallback(async () => {
    setClearingHistory(true);
    try {
      const res = await fetch("/api/dictionary/history", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setHistory([]);
      notify({ title: "Historial borrado" });
    } catch {
      notify({
        title: "No se pudo borrar",
        description: "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setClearingHistory(false);
    }
  }, [notify]);

  const clearSearches = useCallback(async () => {
    setClearingSearches(true);
    try {
      const res = await fetch("/api/dictionary/search-history", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setSearches([]);
      notify({ title: "Búsquedas borradas" });
    } catch {
      notify({
        title: "No se pudo borrar",
        description: "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setClearingSearches(false);
    }
  }, [notify]);

  const stats: PerfilStats = {
    favorites: favorites.length,
    views: history.length,
    coursesInProgress: courses.filter((c) => c.percent < 100).length,
    lessonsCompleted: courses.reduce((n, c) => n + c.lessonsCompleted, 0),
  };

  return {
    profile,
    favorites,
    history,
    searches,
    courses,
    loading,
    stats,
    removeFavorite,
    removingId,
    clearHistory,
    clearingHistory,
    clearSearches,
    clearingSearches,
    setProfile,
  };
}
