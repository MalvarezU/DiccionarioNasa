/**
 * Conversión final legacy -> bloques modernos (Limpieza Nivel 1+2).
 *
 * Usa SQL crudo a propósito: corre ANTES de la migración de schema
 * (`drop_lesson_legacy_columns`), cuando `type`/`wordId`/`payload` aún existen.
 * Si esas columnas ya no existen, hace solo el pase de bloques por contenido.
 *
 * - `legacy-quiz-words {words}` -> `quiz` (una pregunta por palabra,
 *   distractores del pool).
 * - `legacy-complete-word {wordId}` -> `quiz` "¿Cómo se dice X?" con 3
 *   distractores + passScore 50 (el umbral del renderer clásico).
 * - Lecciones con `content` null -> mismo mapeo del backfill original.
 *
 * Idempotente. Uso (solo BD local/E2E antes de migrate deploy, jamás prod sin backup):
 *   set -a; source .env.local; set +a; bun run prisma/migrate-legacy-blocks.ts
 */
import { PrismaClient } from "@prisma/client";
import { parseLessonContent } from "../src/lib/courses/blocks";

const db = new PrismaClient();

type Block = { id: string; type: string; [k: string]: unknown };
type Row = { id: string; title: string; type?: string | null; wordId?: string | null; payload?: string | null; content: unknown };

async function wordIdBySpanish(spanish: string): Promise<{ id: string; spanish: string; nasaYuwe: string }> {
  const w = await db.dictionaryWord.findFirst({
    where: { spanish: { equals: spanish.trim() }, status: "PUBLISHED" },
  });
  if (!w) throw new Error(`Palabra PUBLISHED no encontrada: "${spanish}"`);
  return w as { id: string; spanish: string; nasaYuwe: string };
}

async function distractores(exceptoId: string, n: number): Promise<Array<{ spanish: string }>> {
  const pool = await db.dictionaryWord.findMany({
    where: { status: "PUBLISHED", NOT: { id: exceptoId } },
    select: { spanish: true },
    orderBy: { spanish: "asc" },
    take: Math.max(n * 4, 12),
  });
  const scored = pool
    .map((w) => {
      let h = 0;
      const s = "mostrario-limpieza" + w.spanish;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return { w, h };
    })
    .sort((a, b) => a.h - b.h)
    .slice(0, n)
    .map((x) => x.w);
  if (scored.length < n) throw new Error(`Pool insuficiente para distractores (${scored.length}/${n})`);
  return scored;
}

async function convertirLegacy(b: Block): Promise<Block> {
  if (b.type === "legacy-quiz-words") {
    const words = b.words as unknown;
    if (!Array.isArray(words) || words.length === 0) throw new Error(`legacy-quiz-words sin words: ${b.id}`);
    const questions: any[] = [];
    for (const w of words) {
      if (typeof w !== "string" || !w.trim()) throw new Error(`word inválida en ${b.id}`);
      const palabra = await wordIdBySpanish(w);
      const dist = await distractores(palabra.id, 3);
      questions.push({
        prompt: `¿Cómo se dice "${palabra.spanish}" en Nasa Yuwe?`,
        options: [{ text: palabra.nasaYuwe, correct: true }, ...dist.map((d) => ({ text: d.spanish, correct: false }))],
        explanation: `"${palabra.spanish}" es "${palabra.nasaYuwe}".`,
      });
    }
    return { id: b.id as string, type: "quiz", passScore: 50, questions };
  }
  if (b.type === "legacy-complete-word") {
    const wordId = b.wordId as unknown;
    if (typeof wordId !== "string" || !wordId) throw new Error(`legacy-complete-word sin wordId: ${b.id}`);
    const palabra = await db.dictionaryWord.findUnique({ where: { id: wordId } });
    if (!palabra) throw new Error(`Palabra no encontrada: ${wordId}`);
    const dist = await distractores(palabra.id, 3);
    return {
      id: b.id as string,
      type: "quiz",
      passScore: 50,
      questions: [
        {
          prompt: `¿Cómo se dice "${palabra.spanish}" en Nasa Yuwe?`,
          options: [
            { text: (palabra as { nasaYuwe: string }).nasaYuwe, correct: true },
            ...dist.map((d) => ({ text: d.spanish, correct: false })),
          ],
          explanation: `"${palabra.spanish}" es "${(palabra as { nasaYuwe: string }).nasaYuwe}".`,
        },
      ],
    };
  }
  return b;
}

/** Mapeo del backfill original para lecciones sin content. */
async function bloquesSinContent(type: string | null | undefined, wordId: string | null | undefined, payload: string | null | undefined, lessonId: string): Promise<Block[]> {
  const bid = (i: number) => `blk_${lessonId.slice(-10)}_${i}`;
  if (type === "READ") {
    if (!wordId) return [];
    return [{ id: bid(0), type: "word", wordId }];
  }
  if (type === "QUIZ") {
    let words: string[] = [];
    try {
      const p = JSON.parse(payload ?? "") as { questions?: Array<{ wordSpanish?: unknown }> };
      if (Array.isArray(p.questions)) {
        words = p.questions
          .map((q) => (typeof q?.wordSpanish === "string" ? q.wordSpanish.trim() : ""))
          .filter((w) => w.length > 0);
      }
    } catch { words = []; }
    if (words.length === 0) return [];
    return [await convertirLegacy({ id: bid(0), type: "legacy-quiz-words", words })];
  }
  if (type === "COMPLETE") {
    if (!wordId) return [];
    return [await convertirLegacy({ id: bid(0), type: "legacy-complete-word", wordId })];
  }
  return [];
}

async function escribirContent(id: string, content: { version: number; blocks: Block[] }) {
  const parsed = parseLessonContent(content);
  if (!parsed.ok) throw new Error(`Contenido inválido para ${id}: ${parsed.errors.join(" | ")}`);
  await db.$executeRawUnsafe("UPDATE Lesson SET content = ? WHERE id = ?", JSON.stringify({ version: parsed.content.version, blocks: parsed.content.blocks }), id);
}

async function main() {
  // Intento 1: BD pre-migración (con columnas legacy).
  let rows: Row[];
  try {
    rows = (await db.$queryRawUnsafe(
      "SELECT id, title, `type`, wordId, payload, content FROM Lesson ORDER BY id ASC"
    )) as Row[];
  } catch {
    // Intento 2: BD post-migración (solo contenido).
    const typed = await db.lesson.findMany({ select: { id: true, title: true, content: true }, orderBy: { id: "asc" } });
    rows = typed.map((l) => ({ id: l.id, title: l.title, content: l.content }));
  }
  let tocadas = 0;
  for (const les of rows) {
    const raw = les.content as unknown as { version?: number; blocks?: Block[] } | null;
    if (!raw) {
      const blocks = await bloquesSinContent(les.type, les.wordId ?? null, (les.payload as string | null) ?? null, les.id);
      await escribirContent(les.id, { version: 1, blocks });
      console.log(`backfill: "${les.title}" -> ${blocks.length} bloque(s)`);
      tocadas++;
      continue;
    }
    const blocks = raw.blocks ?? [];
    if (!blocks.some((b) => b.type === "legacy-quiz-words" || b.type === "legacy-complete-word")) continue;
    const convertidos: Block[] = [];
    for (const b of blocks) convertidos.push(await convertirLegacy(b));
    await escribirContent(les.id, { version: raw.version ?? 1, blocks: convertidos });
    console.log(`convertida: "${les.title}" (${blocks.map((b) => b.type).join(",")})`);
    tocadas++;
  }
  console.log(`Listo. Lecciones tocadas: ${tocadas}/${rows.length}`);
}

await main().finally(() => db.$disconnect());
