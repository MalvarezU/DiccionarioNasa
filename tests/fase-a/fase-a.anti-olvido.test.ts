import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * T11 — Test anti-olvido (red de seguridad de BUMP-05, spec §2.3).
 *
 * Escanea `src/app/api/**\/route.ts`: toda ruta con handler mutante
 * (POST/PUT/PATCH/DELETE) que toque contenido publicable
 * (`DictionaryWord`, `Course`, `Module`, `Lesson`, `MediaAsset`, objetos R2)
 * debe importar o invocar `bumpContentVersion`, o figurar en la allowlist
 * explícita con motivo. Al agregar una ruta mutante sin bump ni entrada en
 * allowlist, este test falla señalándola.
 */

const API_ROOT = join(process.cwd(), "src/app/api");

type Violation = { file: string; handlers: string[]; mutations: string[] };

// Modelos cuyo cambio altera el contenido publicable (spec §2.3, D2/D3).
// Todo lo demás (User, Favorite, ViewHistory, SearchHistory,
// UserLessonProgress, UserGameSession, PasswordReset, AuditLog, progreso de
// usuario, auth) no es contenido publicable y no exige bump.
const PUBLISHABLE_MODELS = ["dictionaryWord", "course", "module", "lesson", "mediaAsset"];

const MUTATION_RES: RegExp[] = [
  new RegExp(
    `(?:db|tx)\\s*\\.\\s*(?:${PUBLISHABLE_MODELS.join("|")})\\s*\\.\\s*` +
      `(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\\s*\\(`
  ),
  /\bputObject\s*\(/,
  /\bdeleteObject\s*\(/,
  /\bdeleteMediaAssetBy\w*\s*\(/,
];

const HANDLER_RE = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g;

// Allowlist explícita con motivo (spec T11): muta contenido publicable sin
// bump por decisión documentada. Vacía desde C1 (el legacy `admin/import`
// bumpea como `confirm`): ninguna ruta mutante publicable queda exenta.
// Agregar una entrada exige spec-review.
const ALLOWLIST: Array<{ file: string; reason: string }> = [];

function stripComments(src: string): string {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlocks
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(abs));
    else if (entry.isFile() && entry.name === "route.ts") out.push(abs);
  }
  return out;
}

export function scanApiRoot(root: string = API_ROOT): Violation[] {
  const allowlisted = new Set(ALLOWLIST.map((a) => a.file));
  const violations: Violation[] = [];
  for (const abs of routeFiles(root)) {
    const rel = relative(process.cwd(), abs);
    const src = stripComments(readFileSync(abs, "utf-8"));
    const handlers = [...src.matchAll(HANDLER_RE)].map((m) => m[1]!);
    if (!handlers.some((h) => h === "POST" || h === "PUT" || h === "PATCH" || h === "DELETE")) {
      continue;
    }
    const mutations = MUTATION_RES.filter((re) => {
      re.lastIndex = 0;
      return re.test(src);
    }).map((re) => re.source);
    if (mutations.length === 0) continue;
    if (src.includes("bumpContentVersion")) continue;
    if (allowlisted.has(rel)) continue;
    violations.push({ file: rel, handlers, mutations });
  }
  return violations;
}

describe("T11 anti-olvido — cobertura de bumps en rutas mutantes", () => {
  it("el inventario actual declara bump (o allowlist con motivo) en toda ruta mutante publicable", () => {
    const violations = scanApiRoot();
    expect(
      violations,
      `rutas mutantes sin bump:\n${violations.map((v) => ` - ${v.file} [${v.handlers.join(",")}] -> ${v.mutations.join(", ")}`).join("\n")}`
    ).toEqual([]);
  });

  it("señala una ruta mutante nueva sin bump ni allowlist (fixture temporal)", () => {
    const dir = join(API_ROOT, "__fase-a-t11-fixture__");
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(
        join(dir, "route.ts"),
        `import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const created = await db.dictionaryWord.create({
    data: { spanish: body.spanish, nasaYuwe: body.nasaYuwe },
  });
  return NextResponse.json({ created }, { status: 201 });
}
`
      );
      const violations = scanApiRoot();
      expect(violations.map((v) => v.file)).toContain(
        relative(process.cwd(), join(dir, "route.ts"))
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

export { API_ROOT };
