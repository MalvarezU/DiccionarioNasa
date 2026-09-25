export interface WordDetail {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  audioUrl: string | null;
  culturalContext: string | null;
  category: string | null;
  examples: Array<{ spanish: string; nasaYuwe: string }> | null;
}

// Category display labels (Spanish)
export const CATEGORY_LABELS: Record<string, string> = {
  sustantivo: "Sustantivo",
  verbo: "Verbo",
  adjetivo: "Adjetivo",
  numeral: "Numeral",
  adverbio: "Adverbio",
  pronombre: "Pronombre",
  preposicion: "Preposición",
  conjuncion: "Conjunción",
  interjeccion: "Interjección",
};

/**
 * Parse category string that may contain multiple categories
 * separated by commas (e.g., "sustantivo, verbo")
 */
export function parseCategories(category: string | null): string[] {
  if (!category) return [];
  return category
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Get display label for a category key
 */
export function getCategoryDisplay(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}
