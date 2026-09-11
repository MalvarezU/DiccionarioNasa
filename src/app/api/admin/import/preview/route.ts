import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { detectColumns, validateRow, type ValidWord } from "@/lib/import-helpers";

/**
 * Importación en 2 pasos (CA-31/CA-32): preview (valida, no escribe) +
 * confirm (escribe). Todo lo confirmado entra en BORRADOR salvo columna
 * explícita; duplicados por «español» (insensible a mayúsculas).
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;
const PREVIEW_TTL_MS = 15 * 60 * 1000;

interface PreviewData {
  rows: ValidWord[];
  expires: number;
}

const previews = new Map<string, PreviewData>();

export function storePreview(rows: ValidWord[]): string {
  const now = Date.now();
  for (const [token, data] of previews) {
    if (data.expires <= now) previews.delete(token);
  }
  const token = crypto.randomUUID();
  previews.set(token, { rows, expires: now + PREVIEW_TTL_MS });
  return token;
}

export function takePreview(token: string): ValidWord[] | null {
  const data = previews.get(token);
  if (!data) return null;
  previews.delete(token);
  if (data.expires <= Date.now()) return null;
  return data.rows;
}

/** Solo tests. */
export function __resetPreviewStore(): void {
  previews.clear();
}

async function parseFile(file: {
  name: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
    throw new Error("Formato no soportado. Sube .xlsx o .csv");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("El archivo no puede superar 5 MB");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("El archivo no tiene hojas legibles");
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (json.length === 0) throw new Error("El archivo no tiene filas de datos");
  if (json.length > MAX_ROWS) {
    throw new Error(`Máximo ${MAX_ROWS} filas por importación`);
  }
  return { headers: Object.keys(json[0] ?? {}), rows: json };
}

/**
 * POST /api/admin/import/preview
 * FormData { file }. Valida sin escribir. Requiere editor+.
 */
export async function POST(request: Request) {
  const { error } = await requireRole("editor");
  if (error) return error;

  try {
    const formData = await request.formData().catch(() => null);
    const raw = formData?.get("file");
    // Duck-typing en vez de instanceof File (jsdom vs undici en tests)
    const file =
      raw !== null &&
      typeof raw === "object" &&
      typeof (raw as { arrayBuffer?: unknown }).arrayBuffer === "function" &&
      typeof (raw as { name?: unknown }).name === "string"
        ? (raw as { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> })
        : null;
    if (!file) {
      return Response.json({ message: "Sube un archivo .xlsx o .csv" }, { status: 400 });
    }

    let headers: string[];
    let rawRows: Record<string, unknown>[];
    try {
      ({ headers, rows: rawRows } = await parseFile(file));
    } catch (e) {
      return Response.json(
        { message: e instanceof Error ? e.message : "Archivo ilegible" },
        { status: 400 }
      );
    }

    const columns = detectColumns(headers);
    const valid: ValidWord[] = [];
    const errorRows: Array<{ row: number; reason: string }> = [];
    for (let i = 0; i < rawRows.length; i++) {
      const result = validateRow(rawRows[i]!);
      if (result.ok) valid.push(result.data);
      else errorRows.push({ row: i + 2, reason: result.reason });
    }

    // Duplicados por «español» (una sola consulta)
    let duplicates = 0;
    const seen = new Set<string>();
    const unique: ValidWord[] = [];
    if (valid.length > 0) {
      const names = [...new Set(valid.map((w) => w.spanish))];
      const existing = await db.dictionaryWord.findMany({
        where: { spanish: { in: names, mode: "insensitive" } },
        select: { spanish: true },
      });
      const taken = new Set(existing.map((w) => w.spanish.trim().toLowerCase()));
      for (const w of valid) {
        const key = w.spanish.trim().toLowerCase();
        if (taken.has(key) || seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);
        unique.push(w);
      }
    }

    const previewToken = storePreview(unique);

    return Response.json({
      fileName: file.name,
      columns,
      total: rawRows.length,
      valid: unique.length,
      invalid: errorRows.length,
      duplicates,
      errors: errorRows.slice(0, 20),
      previewToken,
    });
  } catch (error) {
    console.error("Import preview error:", error);
    return Response.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
