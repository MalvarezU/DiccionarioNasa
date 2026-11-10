import { describe, it, expect } from "vitest"
import { bulkActionFor, bulkOmitReason, type BulkPolicyRow } from "./bulk-policy"

const SIN_MATCH: BulkPolicyRow = { wordId: null, hasExisting: false, decision: "auto" };
const NUEVA: BulkPolicyRow = { wordId: "w1", hasExisting: false, decision: "auto" };
const EXISTENTE: BulkPolicyRow = { wordId: "w2", hasExisting: true, decision: "auto" };

describe("bulkActionFor", () => {
  it("sin coincidencia siempre se omite, en cualquier modo", () => {
    for (const p of ["skip-existing", "replace-all", "per-row"] as const) {
      expect(bulkActionFor(SIN_MATCH, p)).toBe("omitir");
    }
  });

  it("skip-existing (default seguro): solo sube lo nuevo", () => {
    expect(bulkActionFor(NUEVA, "skip-existing")).toBe("subir");
    expect(bulkActionFor(EXISTENTE, "skip-existing")).toBe("omitir");
  });

  it("replace-all: sube todo lo matcheado", () => {
    expect(bulkActionFor(NUEVA, "replace-all")).toBe("subir");
    expect(bulkActionFor(EXISTENTE, "replace-all")).toBe("subir");
  });

  it("per-row: respeta la decisión explícita, default = como skip", () => {
    expect(bulkActionFor(NUEVA, "per-row")).toBe("subir");
    expect(bulkActionFor(EXISTENTE, "per-row")).toBe("omitir");
    expect(bulkActionFor({ ...EXISTENTE, decision: "subir" }, "per-row")).toBe("subir");
    expect(bulkActionFor({ ...NUEVA, decision: "omitir" }, "per-row")).toBe("omitir");
  });

  it("la decisión manual fuera de per-row no cambia el resultado", () => {
    expect(bulkActionFor({ ...EXISTENTE, decision: "subir" }, "skip-existing")).toBe("omitir");
    expect(bulkActionFor({ ...NUEVA, decision: "omitir" }, "replace-all")).toBe("subir");
  });
});

describe("bulkOmitReason", () => {
  it("explica por qué no se sube", () => {
    expect(bulkOmitReason(SIN_MATCH)).toBe("sin coincidencia");
    expect(bulkOmitReason(EXISTENTE)).toBe("ya tiene");
    expect(bulkOmitReason(NUEVA)).toBeNull();
  });
});
