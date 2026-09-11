/**
 * Parser del CSV del seed (B1.11).
 *
 * Módulo sin efectos laterales (seed.ts auto-ejecuta main y no se puede
 * importar en tests). Parseo con comillas reales (SheetJS): el split(',')
 * ingenuo corrompía `examples` cuando otro campo traía comas entre comillas.
 * Además: dedup por «español» insensible a mayúsculas y ejemplos siempre
 * JSON válido (si no, "[]").
 */
import * as XLSX from "xlsx";

export interface WordData {
  spanish: string;
  nasaYuwe: string;
  pronunciation: string;
  culturalContext: string;
  category: string;
  audioUrl: string | null;
  examples: string;
}

export interface ParsedSeed {
  words: WordData[];
  skippedDup: number;
}

function validExamplesJson(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "[]";
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? t : "[]";
  } catch {
    return "[]";
  }
}

export function parseSeedCSV(content: string): ParsedSeed {
  const clean = content.replace(/^\uFEFF/, "").trim();
  if (!clean) return { words: [], skippedDup: 0 };

  const wb = XLSX.read(clean, { type: "string" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { words: [], skippedDup: 0 };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const words: WordData[] = [];
  const seen = new Set<string>();
  let skippedDup = 0;

  for (let i = 1; i < rows.length; i++) {
    const parts = ((rows[i] ?? []) as unknown[]).map((v) => String(v ?? "").trim());
    if (parts.length < 2) continue;

    const nasaYuwe = parts[0] || "";
    const spanish = parts[1] || "";
    if (!nasaYuwe || !spanish) continue;

    const key = spanish.toLowerCase();
    if (seen.has(key)) {
      skippedDup++;
      continue;
    }
    seen.add(key);

    const category = parts[2] || "sustantivo";
    const pronunciation = parts[3] || nasaYuwe.toLowerCase();
    const culturalContext =
      parts[4] || "Palabra de la lengua Nasa Yuwe, dialecto Wila";

    words.push({
      spanish,
      nasaYuwe,
      pronunciation,
      culturalContext,
      category,
      audioUrl: null,
      examples: validExamplesJson(parts[5] ?? ""),
    });
  }

  return { words, skippedDup };
}
