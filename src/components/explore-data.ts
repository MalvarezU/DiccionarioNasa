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

export interface HeaderRow {
  type: "header";
  letter: string;
  count: number;
  id: string;
}

export interface WordRow {
  type: "word";
  word: ExploreWord;
  id: string;
}

export type VirtualRow = HeaderRow | WordRow;

/**
 * Build virtual rows from letter groups: interleaves letter headers and word items.
 */
export function buildVirtualRows(groups: LetterGroup[]): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (const group of groups) {
    rows.push({
      type: "header",
      letter: group.letter,
      count: group.words.length,
      id: `header-${group.letter}`,
    });
    for (const word of group.words) {
      rows.push({ type: "word", word, id: `word-${word.id}` });
    }
  }
  return rows;
}

/**
 * Build a lookup map from letter → virtual row index (for scroll-to-letter).
 */
export function buildLetterIndexMap(rows: VirtualRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.type === "header") {
      map.set(row.letter, i);
    }
  }
  return map;
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
