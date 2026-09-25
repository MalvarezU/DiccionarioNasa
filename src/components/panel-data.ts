import { getLocalWord } from "@/lib/local-db";
import {
  getLocalFavorites,
  getLocalHistory,
  getLocalFavoritesWithWord,
  getLocalHistoryWithWord,
  clearLocalHistory,
} from "@/lib/demo-storage";

export { clearLocalHistory };

export interface FavoriteWord {
  id: string;
  wordId: string;
  createdAt: string;
  word: {
    id: string;
    spanish: string;
    nasaYuwe: string;
    pronunciation: string | null;
    category: string | null;
    audioUrl: string | null;
  };
}

export interface HistoryWord {
  id: string;
  wordId: string;
  createdAt: string;
  word: {
    id: string;
    spanish: string;
    nasaYuwe: string;
    pronunciation: string | null;
    category: string | null;
    audioUrl: string | null;
  };
}

export type PanelTab = "favorites" | "history";

type LocalWordShape = {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  category: string | null;
  audioUrl?: string | null;
};

async function resolveWordMap<T extends { word: LocalWordShape | null }>(
  ids: string[]
): Promise<Map<string, LocalWordShape>> {
  const wordMap = new Map<string, LocalWordShape>();
  await Promise.all(
    ids.map(async (id) => {
      const word = await getLocalWord(id);
      if (word) {
        wordMap.set(id, {
          id: word.id,
          spanish: word.spanish,
          nasaYuwe: word.nasaYuwe,
          pronunciation: word.pronunciation,
          category: word.category,
          audioUrl: word.audioUrl ?? null,
        });
      }
    })
  );
  return wordMap;
}

export async function buildLocalFavorites(userId: string): Promise<FavoriteWord[]> {
  const favIds = getLocalFavorites(userId).map((f) => f.wordId);
  const wordMap = await resolveWordMap(favIds);
  return getLocalFavoritesWithWord(userId, (id) => wordMap.get(id) ?? null).filter(
    (f) => f.word !== null
  ) as FavoriteWord[];
}

export async function buildLocalHistory(userId: string): Promise<HistoryWord[]> {
  const histIds = getLocalHistory(userId).map((h) => h.wordId);
  const wordMap = await resolveWordMap(histIds);
  return getLocalHistoryWithWord(userId, (id) => wordMap.get(id) ?? null).filter(
    (h) => h.word !== null
  ) as HistoryWord[];
}

/** Agrupa el historial por fecha localizada (es-CO). */
export function groupHistoryByDate(history: HistoryWord[]): Record<string, HistoryWord[]> {
  return history.reduce<Record<string, HistoryWord[]>>(
    (acc, item) => {
      const date = new Date(item.createdAt).toLocaleDateString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    },
    {}
  );
}
