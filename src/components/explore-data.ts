import { getNormalizedInitial } from "@/lib/local-db";
import { getCategoryDisplay, parseCategories } from "./word-detail";

export { getCategoryDisplay, parseCategories };

export interface ExploreWord {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  category: string | null;
  culturalContext: string | null;
}

export interface LetterGroup {
  letter: string;
  words: ExploreWord[];
  /** Starting index of this group in the flat list */
  startIndex: number;
}

export const SPANISH_ALPHABET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

/**
 * Extract unique categories from all words, sorted alphabetically.
 */
export function extractCategories(words: ExploreWord[]): string[] {
  const set = new Set<string>();
  for (const word of words) {
    for (const cat of parseCategories(word.category)) {
      set.add(cat);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Group words by their normalized initial letter, with startIndex tracking
 * for virtualizer scroll-to-letter functionality.
 */
export function groupByLetter(words: ExploreWord[]): LetterGroup[] {
  const map = new Map<string, ExploreWord[]>();

  for (const word of words) {
    const letter = getNormalizedInitial(word.spanish);
    const existing = map.get(letter);
    if (existing) {
      existing.push(word);
    } else {
      map.set(letter, [word]);
    }
  }

  let runningIndex = 0;
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([letter, groupWords]) => {
      const startIndex = runningIndex;
      runningIndex += groupWords.length;
      return { letter, words: groupWords, startIndex };
    });
}

/**
 * Get the set of letters that have words.
 */
export function getActiveLetters(groups: LetterGroup[]): Set<string> {
  return new Set(groups.map((g) => g.letter));
}

export interface IndexRow {
  type: "row";
  /** Letter group this chunk belongs to (drives the sticky strip + rail). */
  letter: string;
  /** 1..N words sharing one fixed-height grid row (N = column count). */
  words: ExploreWord[];
  id: string;
}

export type VirtualRow = IndexRow;

/**
 * Split a group's words into chunks of `size` for multi-column index rows.
 * The last chunk may be short; the UI pads it with empty cells.
 */
export function chunkWords(words: ExploreWord[], size: number): ExploreWord[][] {
  const n = Math.max(1, Math.floor(size));
  if (n <= 1) return words.map((w) => [w]);
  const chunks: ExploreWord[][] = [];
  for (let i = 0; i < words.length; i += n) {
    chunks.push(words.slice(i, i + n));
  }
  return chunks;
}

/**
 * Build virtual rows from letter groups: each group's words chunked into
 * fixed-height grid rows of `columns` entries. Letter headers are NOT rows —
 * the sticky strip shows the current letter instead.
 */
export function buildVirtualRows(groups: LetterGroup[], columns = 1): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (const group of groups) {
    for (const chunk of chunkWords(group.words, columns)) {
      rows.push({
        type: "row",
        letter: group.letter,
        words: chunk,
        id: `row-${group.letter}-${rows.length}`,
      });
    }
  }
  return rows;
}

/**
 * Build a lookup map from letter → first virtual row index (for scroll-to-letter).
 */
export function buildLetterIndexMap(rows: VirtualRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && !map.has(row.letter)) {
      map.set(row.letter, i);
    }
  }
  return map;
}

/** Word count per letter, for the sticky strip ("Aa · 42 palabras"). */
export function buildLetterCounts(groups: LetterGroup[]): Map<string, number> {
  return new Map(groups.map((g) => [g.letter, g.words.length]));
}

/** Map a local-DB word row onto ExploreWord (shared by the three load paths). */
export function toExploreWord(w: {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  category: string | null;
  culturalContext: string | null;
}): ExploreWord {
  return {
    id: w.id,
    spanish: w.spanish,
    nasaYuwe: w.nasaYuwe,
    pronunciation: w.pronunciation,
    category: w.category,
    culturalContext: w.culturalContext,
  };
}
