/**
 * Helpers de importación del corpus (B1.10).
 *
 * Puros y testeables: parseo de .xlsx/.csv (SheetJS), mapeo de columnas
 * ES/EN/snake, validación por fila y normalización. El default de estado
 * es BORRADOR (CA-32) y los duplicados se detectan por «español» (CA-31/33).
 */

export interface RawRow {
  row: number
  values: Record<string, unknown>
}

export interface ValidWord {
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string | null
  examples: string | null
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
}

export type RowResult =
  | { ok: true; data: ValidWord }
  | { ok: false; reason: string };

const normKey = (k: string) =>
  k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "");

function pick(values: Record<string, unknown>, ...names: string[]): unknown {
  const entries = Object.entries(values);
  for (const name of names) {
    const hit = entries.find(([k]) => normKey(k) === normKey(name));
    if (hit && hit[1] !== undefined && hit[1] !== null && String(hit[1]).trim() !== "") {
      return hit[1];
    }
  }
  return undefined;
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Columnas reconocidas (encabezados ES/EN, con o sin tildes/guiones). */
export const KNOWN_COLUMNS = [
  "spanish",
  "nasaYuwe",
  "pronunciation",
  "culturalContext",
  "category",
  "examples",
  "status",
  "audioUrl",
] as const;

export function normalizeStatus(raw: unknown): ValidWord["status"] {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "DRAFT" || s === "BORRADOR") return "DRAFT";
  if (s === "ARCHIVED" || s === "ARCHIVADA" || s === "ARCHIVADO") return "ARCHIVED";
  if (s === "PUBLISHED" || s === "PUBLICADA" || s === "PUBLICADO") return "PUBLISHED";
  return "DRAFT";
}

function normalizeExamples(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) {
        const nonEmpty = parsed.filter(
          (ex: { spanish?: string; nasaYuwe?: string }) =>
            ex?.spanish?.trim() || ex?.nasaYuwe?.trim()
        );
        return nonEmpty.length > 0 ? JSON.stringify(nonEmpty) : null;
      }
    } catch {
      // No es JSON: se guarda como texto plano en un ejemplo único
      return JSON.stringify([{ spanish: t, nasaYuwe: "" }]);
    }
    return t;
  }
  if (Array.isArray(raw)) {
    const nonEmpty = (raw as Array<{ spanish?: string; nasaYuwe?: string }>).filter(
      (ex) => ex?.spanish?.trim() || ex?.nasaYuwe?.trim()
    );
    return nonEmpty.length > 0 ? JSON.stringify(nonEmpty) : null;
  }
  return null;
}

export function validateRow(values: Record<string, unknown>): RowResult {
  const spanish = str(pick(values, "spanish", "espanol", "palabra_esp", "palabra esp"));
  const nasaYuwe = str(
    pick(values, "nasaYuwe", "nasa yuwe", "palabra_nyw", "palabra nyw", "nasa_yuwe", "nasayuwe")
  );

  if (!spanish || !nasaYuwe) {
    return { ok: false, reason: "Campos obligatorios faltantes (español y Nasa Yuwe)" };
  }

  return {
    ok: true,
    data: {
      spanish,
      nasaYuwe,
      pronunciation: str(pick(values, "pronunciation", "pronunciacion", "pronunciación")),
      audioUrl: str(pick(values, "audioUrl", "audio_url", "audio")),
      culturalContext: str(
        pick(values, "culturalContext", "cultural_context", "contexto", "contexto cultural")
      ),
      category: str(pick(values, "category", "categoria", "categoría")),
      examples: normalizeExamples(pick(values, "examples", "ejemplos", "ejemplo")),
      status: normalizeStatus(pick(values, "status", "estado")),
    },
  };
}

/** Qué columnas del archivo se reconocieron (mapeo visual en la UI). */
export function detectColumns(headers: string[]): Array<{ header: string; mapped: string | null }> {
  const probes: Array<{ field: string; names: string[] }> = [
    { field: "spanish", names: ["spanish", "espanol", "palabra_esp", "palabra esp"] },
    { field: "nasaYuwe", names: ["nasaYuwe", "nasa yuwe", "palabra_nyw", "palabra nyw", "nasa_yuwe", "nasayuwe"] },
    { field: "pronunciation", names: ["pronunciation", "pronunciacion", "pronunciación"] },
    { field: "culturalContext", names: ["culturalContext", "cultural_context", "contexto", "contexto cultural"] },
    { field: "category", names: ["category", "categoria", "categoría"] },
    { field: "examples", names: ["examples", "ejemplos", "ejemplo"] },
    { field: "status", names: ["status", "estado"] },
    { field: "audioUrl", names: ["audioUrl", "audio_url", "audio"] },
  ];
  return headers.map((header) => {
    const found = probes.find((p) => p.names.some((n) => normKey(n) === normKey(header)));
    return { header, mapped: found ? found.field : null };
  });
}
