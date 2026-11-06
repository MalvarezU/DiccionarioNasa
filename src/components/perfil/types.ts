/**
 * Tipos compartidos de la página /perfil ("Mi espacio", fase 2).
 * Reflejan los contratos de GET /api/dictionary/favorites, history,
 * search-history y GET /api/user/course-progress.
 */

export interface PerfilWord {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  category: string | null;
  audioUrl: string | null;
}

export interface PerfilFavorite {
  id: string;
  wordId: string;
  createdAt: string;
  word: PerfilWord;
}

export interface PerfilHistoryEntry {
  id: string;
  wordId: string;
  createdAt: string;
  word: PerfilWord;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  createdAt: string;
}

export interface CourseProgressSummary {
  courseId: string;
  title: string;
  coverImage: string | null;
  lessonsTotal: number;
  lessonsCompleted: number;
  percent: number;
  lastVisitedAt: string | null;
  lastLessonId: string | null;
  lastLessonTitle: string | null;
}

export type PerfilTab = "favorites" | "history" | "progress";

/** Acepta los valores de ?tab= (inglés de la navbar + alias en español). */
export function parsePerfilTab(raw: string | null): PerfilTab {
  switch ((raw ?? "").toLowerCase()) {
    case "history":
    case "historial":
      return "history";
    case "progress":
    case "progreso":
    case "avance":
    case "mi-avance":
      return "progress";
    case "favorites":
    case "favoritos":
    default:
      return "favorites";
  }
}

/** Agrupa entradas de historial por fecha localizada (es-CO), como el panel. */
export function groupHistoryByDate<T extends { createdAt: string }>(
  history: T[]
): Record<string, T[]> {
  return history.reduce<Record<string, T[]>>((acc, item) => {
    const date = new Date(item.createdAt).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
}
