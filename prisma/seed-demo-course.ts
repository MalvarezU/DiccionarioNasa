/**
 * Seed del curso demo "Nasa Yuwe Básico" (post-limpieza Nivel 1+2).
 *
 * Crea el curso con lecciones 100% en bloques modernos (sin type/wordId/payload).
 * Idempotente: si ya existe un curso PUBLICADO con ese título, no hace nada.
 * Uso (solo BD local/E2E): set -a; source .env.local; set +a; bun run prisma/seed-demo-course.ts
 */
import { PrismaClient } from "@prisma/client";
import { parseLessonContent, type LessonContent } from "../src/lib/courses/blocks";

const db = new PrismaClient();

const TITLE = "Nasa Yuwe Básico";

function mustContent(label: string, content: LessonContent): string {
  const parsed = parseLessonContent(content);
  if (!parsed.ok) throw new Error(`Contenido inválido en ${label}: ${parsed.errors.join(" | ")}`);
  return JSON.stringify({ version: parsed.content.version, blocks: parsed.content.blocks });
}

async function wordId(spanish: string): Promise<string> {
  const w = await db.dictionaryWord.findFirst({
    where: { spanish: { equals: spanish }, status: "PUBLISHED" },
    select: { id: true, spanish: true, nasaYuwe: true },
  });
  if (!w) throw new Error(`Palabra PUBLISHED no encontrada: ${spanish}`);
  return w.id;
}

async function quizCompleta(spanish: string): Promise<LessonContent> {
  const w = await db.dictionaryWord.findFirst({
    where: { spanish: { equals: spanish }, status: "PUBLISHED" },
  });
  if (!w) throw new Error(`Palabra PUBLISHED no encontrada: ${spanish}`);
  const pool = await db.dictionaryWord.findMany({
    where: { status: "PUBLISHED", NOT: { id: w.id } },
    select: { spanish: true },
    orderBy: { spanish: "asc" },
    take: 12,
  });
  if (pool.length < 3) throw new Error("Pool insuficiente para distractores");
  const distract = pool.slice(0, 3).map((d) => ({ text: d.spanish, correct: false as boolean }));
  return {
    version: 2,
    blocks: [
      {
        id: `q-${w.id.slice(-6)}`,
        type: "quiz",
        passScore: 50,
        questions: [
          {
            prompt: `¿Cómo se dice "${w.spanish}" en Nasa Yuwe?`,
            options: [{ text: w.nasaYuwe, correct: true }, ...distract],
            explanation: `"${w.spanish}" es "${w.nasaYuwe}".`,
          },
        ],
      },
    ],
  };
}

async function main() {
  const existing = await db.course.findFirst({ where: { title: TITLE, status: "PUBLISHED" } });
  if (existing) {
    console.log("Curso demo ya existe, nada que hacer:", existing.id);
    return;
  }

  const ids: Record<string, string> = {};
  for (const s of ["Casa", "Agua", "Perro", "Gallina", "Sol", "Luna", "Fuego"]) ids[s] = await wordId(s);

  const course = await db.course.create({
    data: {
      title: TITLE,
      description: "Aprende las palabras esenciales del Nasa Yuwe: casa, animales y elementos.",
      status: "PUBLISHED",
      sequential: true,
    },
  });

  const modulos: Array<{ title: string; lecciones: Array<{ title: string; content: LessonContent }> }> = [
    {
      title: "Módulo 1: Primeras palabras",
      lecciones: [
        {
          title: "Lección 1.1: Casa y Agua",
          content: {
            version: 2,
            blocks: [
              { id: "m1-texto", type: "text", html: "<h1>Primeras palabras</h1><p>Empezamos con dos esenciales: <strong>Casa</strong> y <strong>Agua</strong>.</p>" },
              { id: "m1-ficha", type: "word", wordId: ids["Casa"]! },
              { id: "m1-vocab", type: "vocabulary", wordIds: [ids["Casa"]!, ids["Agua"]!] },
            ],
          },
        },
        {
          title: "Lección 1.2: Quiz básico",
          content: {
            version: 2,
            blocks: [
              { id: "m1-quiz", type: "quiz", passScore: 50, questions: [
                { prompt: "¿Cómo se dice \"Casa\" en Nasa Yuwe?", options: [{ text: "Yat", correct: true }, { text: "Yu'", correct: false }, { text: "Sek", correct: false }], explanation: "\"Casa\" es \"Yat\"." },
              ] },
            ],
          },
        },
      ],
    },
    {
      title: "Módulo 2: Animales",
      lecciones: [
        {
          title: "Lección 2.1: Perro y Gallina",
          content: {
            version: 2,
            blocks: [
              { id: "m2-ficha", type: "word", wordId: ids["Perro"]! },
              { id: "m2-vocab", type: "vocabulary", wordIds: [ids["Perro"]!, ids["Gallina"]!] },
            ],
          },
        },
        { title: "Lección 2.2: Completa la palabra", content: await quizCompleta("Gallina") },
      ],
    },
    {
      title: "Módulo 3: Elementos",
      lecciones: [
        {
          title: "Lección 3.1: Sol y Luna",
          content: {
            version: 2,
            blocks: [
              { id: "m3-ficha", type: "word", wordId: ids["Sol"]! },
              { id: "m3-vocab", type: "vocabulary", wordIds: [ids["Sol"]!, ids["Luna"]!, ids["Fuego"]!] },
            ],
          },
        },
        {
          title: "Lección 3.2: Quiz final",
          content: {
            version: 2,
            blocks: [{ id: "m3-quiz", type: "quiz", passScore: 50, questions: [
              { prompt: "¿Cómo se dice \"Sol\" en Nasa Yuwe?", options: [{ text: "Sek", correct: true }, { text: "A'te", correct: false }, { text: "Ipx", correct: false }], explanation: "\"Sol\" es \"Sek\"." },
            ] }],
          },
        },
      ],
    },
  ];

  let n = 0;
  for (let mi = 0; mi < modulos.length; mi++) {
    const mod = modulos[mi]!;
    const created = await db.module.create({ data: { courseId: course.id, title: mod.title, order: mi } });
    for (const les of mod.lecciones) {
      n++;
      await db.lesson.create({
        data: {
          moduleId: created.id,
          title: les.title,
          order: n - 1,
          lessonNumber: n,
          content: mustContent(les.title, les.content),
        },
      });
    }
  }
  console.log("Curso demo creado:", course.id);
}

await main().finally(() => db.$disconnect());
