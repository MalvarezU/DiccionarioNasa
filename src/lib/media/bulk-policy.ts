/**
 * Política de lote ante fichas que YA tienen el archivo (ilustraciones y
 * audios comparten el mismo contrato). Nunca se sobrescribe en silencio:
 * el default seguro es omitir lo existente.
 */

export type BulkPolicy = "skip-existing" | "replace-all" | "per-row";

export type BulkRowDecision = "auto" | "subir" | "omitir";

export interface BulkPolicyRow {
  /** null = sin coincidencia (siempre se omite) */
  wordId: string | null;
  /** La ficha ya tiene ese medio */
  hasExisting: boolean;
  /** Elección manual por fila (solo rige en modo "per-row") */
  decision: BulkRowDecision;
}

export type BulkFinalAction = "subir" | "omitir";

/** Acción efectiva de una fila dada la política del lote. */
export function bulkActionFor(row: BulkPolicyRow, policy: BulkPolicy): BulkFinalAction {
  if (!row.wordId) return "omitir";
  if (policy === "replace-all") return "subir";
  if (policy === "skip-existing") return row.hasExisting ? "omitir" : "subir";
  if (row.decision !== "auto") return row.decision;
  return row.hasExisting ? "omitir" : "subir";
}

/** Motivo legible para filas que no se suben. */
export function bulkOmitReason(row: BulkPolicyRow): "ya tiene" | "sin coincidencia" | null {
  if (!row.wordId) return "sin coincidencia";
  return row.hasExisting ? "ya tiene" : null;
}
