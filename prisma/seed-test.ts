/**
 * Seed mínimo y determinista para E2E local (BD de prueba, jamás prod).
 * Crea: admin verificado (creds de .env.test), 8 palabras PUBLISHED y el
 * curso demo "Nasa Yuwe Básico" con lessonNumber 1..N por módulo.
 * Idempotente: re-ejecutable sin duplicar. Uso: bun run prisma/seed-test.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { blocksForLegacyLesson } from "../src/lib/courses/legacy-migration";

const db = new PrismaClient();

const WORDS: Array<{
  spanish: string;
  nasaYuwe: string;
  pronunciation: string;
  culturalContext: string;
  category: string;
}> = [
  { spanish: "Casa", nasaYuwe: "Yat", pronunciation: "yat", culturalContext: "Construcción", category: "sustantivo" },
  { spanish: "Agua", nasaYuwe: "Yu'", pronunciation: "yu'", culturalContext: "Recurso", category: "sustantivo" },
  { spanish: "Perro", nasaYuwe: "Alku", pronunciation: "alku", culturalContext: "Animal - Mamífero doméstico", category: "sustantivo" },
  { spanish: "Gallina", nasaYuwe: "Atalx", pronunciation: "atalx", culturalContext: "Animal", category: "sustantivo" },
  { spanish: "Sol", nasaYuwe: "Sek", pronunciation: "sek", culturalContext: "Constelación", category: "sustantivo" },
  { spanish: "Luna", nasaYuwe: "A'te", pronunciation: "a'te", culturalContext: "Constelación", category: "sustantivo" },
  { spanish: "Fuego", nasaYuwe: "Ipx", pronunciation: "ipx", culturalContext: "Elemento", category: "sustantivo" },
  { spanish: "Grande", nasaYuwe: "Wula", pronunciation: "wula", culturalContext: "Adjetivo", category: "adjetivo" },
  { spanish: "Gato", nasaYuwe: "Misx", pronunciation: "misx", culturalContext: "Animal - Mamífero doméstico", category: "sustantivo" },
  { spanish: "Mano", nasaYuwe: "Kuse", pronunciation: "kuse", culturalContext: "Anatomía - Extremidad", category: "sustantivo" },
  { spanish: "Mujer", nasaYuwe: "U'y", pronunciation: "u'y", culturalContext: "Persona", category: "sustantivo" },
  { spanish: "Ojo", nasaYuwe: "Yafx", pronunciation: "yafx", culturalContext: "Anatomía", category: "sustantivo" },
  { spanish: "Padre", nasaYuwe: "Tata", pronunciation: "tata", culturalContext: "Familia", category: "sustantivo" },
  { spanish: "Tierra", nasaYuwe: "Txiwe", pronunciation: "txiwe", culturalContext: "Elemento", category: "sustantivo" },
];

const COURSE_TITLE = "Nasa Yuwe Básico";

const MODULES: Array<{
  title: string;
  lessons: Array<{
    title: string;
    type: "READ" | "QUIZ" | "COMPLETE";
    spanish?: string;
    payload?: unknown;
  }>;
}> = [
  {
    title: "Módulo 1: Primeras palabras",
    lessons: [
      { title: "Lección 1.1: Casa y Agua", type: "READ", spanish: "Casa" },
      {
        title: "Lección 1.2: Quiz básico",
        type: "QUIZ",
        payload: { questions: [{ wordSpanish: "Casa" }, { wordSpanish: "Agua" }] },
      },
    ],
  },
  {
    title: "Módulo 2: Animales",
    lessons: [
      { title: "Lección 2.1: Perro y Gallina", type: "READ", spanish: "Perro" },
      {
        title: "Lección 2.2: Completa la palabra",
        type: "COMPLETE",
        spanish: "Gallina",
        payload: { level: "facil" },
      },
    ],
  },
  {
    title: "Módulo 3: Elementos",
    lessons: [
      { title: "Lección 3.1: Sol y Luna", type: "READ", spanish: "Sol" },
      {
        title: "Lección 3.2: Quiz final",
        type: "QUIZ",
        payload: { questions: [{ wordSpanish: "Sol" }, { wordSpanish: "Luna" }, { wordSpanish: "Fuego" }] },
      },
    ],
  },
];

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@test.local";
  const password = process.env.ADMIN_PASSWORD || "TestAdmin123!";
  const hashed = await bcrypt.hash(password, 12);
  await db.user.upsert({
    where: { email },
    update: { password: hashed, name: "Administrador", role: "admin", emailVerified: new Date() },
    create: { email, password: hashed, name: "Administrador", role: "admin", emailVerified: new Date() },
  });
  console.log("✓ admin:", email);
}

async function seedWords() {
  for (const w of WORDS) {
    const existing = await db.dictionaryWord.findFirst({
      where: { spanish: w.spanish, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!existing) {
      await db.dictionaryWord.create({
        data: { ...w, examples: null, audioUrl: null, status: "PUBLISHED" },
      });
    }
  }
  console.log(`✓ palabras: ${WORDS.length}`);
}

async function seedCourse() {
  await db.course.deleteMany({ where: { title: COURSE_TITLE } });
  const course = await db.course.create({
    data: {
      title: COURSE_TITLE,
      description: "Aprende las palabras esenciales del Nasa Yuwe: casa, animales y elementos.",
      status: "PUBLISHED",
      sequential: true,
    },
  });
  for (let mi = 0; mi < MODULES.length; mi++) {
    const mod = MODULES[mi]!;
    const created = await db.module.create({
      data: { courseId: course.id, title: mod.title, order: mi },
    });
    for (let li = 0; li < mod.lessons.length; li++) {
      const les = mod.lessons[li]!;
      let wordId: string | null = null;
      if (les.spanish) {
        const w = await db.dictionaryWord.findFirst({
          where: { spanish: les.spanish, status: "PUBLISHED" },
          select: { id: true },
        });
        wordId = w?.id ?? null;
      }
      // El seed genera el documento de bloques con el MISMO mapeo que el
      // backfill (src/lib/courses/legacy-migration.ts), para que una base
      // nueva quede idéntica a una migrada.
      const payloadJson = les.payload ? JSON.stringify(les.payload) : null;
      const blocks = blocksForLegacyLesson(
        { id: `seed_${mi}_${li}`, type: les.type, wordId, payload: payloadJson },
        (_, i) => `blk_seed_${mi}_${li}_${i}`
      );
      await db.lesson.create({
        data: {
          moduleId: created.id,
          title: les.title,
          type: les.type,
          order: li,
          lessonNumber: li + 1,
          wordId,
          payload: payloadJson,
          content: { version: 1, blocks },
        },
      });
    }
  }
  console.log("✓ curso:", course.id);
}

async function main() {
  console.log("Seed de prueba (BD local)...\n");
  await seedAdmin();
  await seedWords();
  await seedCourse();
  console.log("\nListo.");
}

await main().finally(() => db.$disconnect());
