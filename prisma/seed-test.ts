/**
 * Seed mínimo y determinista para E2E local (BD de prueba, jamás prod).
 * Crea: admin verificado (creds de .env.test), 8 palabras PUBLISHED y el
 * curso demo "Nasa Yuwe Básico" con lessonNumber 1..N por módulo.
 * Idempotente: re-ejecutable sin duplicar. Uso: bun run prisma/seed-test.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parseLessonContent } from "../src/lib/courses/blocks";

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
    /** Ficha de palabra (bloque word) + vocabulario con estas palabras. */
    ficha?: string;
    palabras?: string[];
    /** Juego flashcards con estas palabras. */
    flashcards?: string[];
    /** Quiz "como se dice X" con distractores del pool. */
    completa?: string;
    /** Documento de bloques directo (leccion rica). */
    content?: { version: number; blocks: unknown[] };
  }>;
}> = [
  {
    title: "Módulo 1: Primeras palabras",
    lessons: [
      { title: "Lección 1.1: Casa y Agua", ficha: "Casa", palabras: ["Casa", "Agua"] },
      { title: "Lección 1.2: Quiz básico", flashcards: ["Casa", "Agua"] },
      {
        // Lección RICA (fase 4): texto + quiz propio. No depende del
        // diccionario, así que la e2e puede completarla siempre.
        title: "Lección 1.3: El saludo (contenido)",
        content: {
          version: 2,
          blocks: [
            {
              id: "blk_rich_t",
              type: "text",
              html: "<h1>El saludo</h1><p>En Nasa Yuwe el saludo cambia según la hora del día.</p><ul><li><em>wii</em> — mañana</li><li><em>yuwe</em> — tarde</li></ul>",
            },
            {
              id: "blk_rich_q",
              type: "quiz",
              passScore: 70,
              questions: [
                {
                  prompt: "¿Cómo se dice agua en Nasa Yuwe?",
                  options: [
                    { text: "yu", correct: true },
                    { text: "kwe", correct: false },
                  ],
                },
                {
                  prompt: "¿Cómo se dice sol en Nasa Yuwe?",
                  options: [
                    { text: "sok", correct: true },
                    { text: "pa", correct: false },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    title: "Módulo 2: Animales",
    lessons: [
      { title: "Lección 2.1: Perro y Gallina", ficha: "Perro", palabras: ["Perro", "Gallina"] },
      { title: "Lección 2.2: Completa la palabra", completa: "Gallina" },
    ],
  },
  {
    title: "Módulo 3: Elementos",
    lessons: [
      { title: "Lección 3.1: Sol y Luna", ficha: "Sol", palabras: ["Sol", "Luna", "Fuego"] },
      { title: "Lección 3.2: Quiz final", flashcards: ["Sol", "Luna", "Fuego"] },
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
  // Idempotente y auto-regenerante: si un e2e ARCHIVÓ una palabra seed,
  // aquí se rehabilita en vez de crear otra fila duplicada (antes las
  // corridas acumulaban dos "Agua" ARCHIVED y la búsqueda público no
  // mostraba ninguna: dos tests del usuario morían por eso).
  let consolidados = 0
  for (const w of WORDS) {
    const filas = await db.dictionaryWord.findMany({
      where: { spanish: w.spanish },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    if (filas.length === 0) {
      // BD vacía (migración fresca): crear la palabra publicada.
      await db.dictionaryWord.create({
        data: {
          spanish: w.spanish,
          nasaYuwe: w.nasaYuwe,
          pronunciation: w.pronunciation,
          culturalContext: w.culturalContext,
          category: w.category,
          status: "PUBLISHED",
        },
      })
      continue
    }
    // Conserva la primera (publicándola); el resto, si es duplicado, fuera.
    for (const [i, fila] of filas.entries()) {
      if (i === 0) {
        await db.dictionaryWord.update({
          where: { id: fila.id },
          data: { status: "PUBLISHED", nasaYuwe: w.nasaYuwe, category: w.category ?? null },
        })
      } else {
        await db.dictionaryWord.delete({ where: { id: fila.id } })
      }
    }
    if (filas.length > 1) consolidados++
  }
  console.log(`✓ palabras: ${WORDS.length} (duplicadas consolidadas: ${consolidados})`)
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
      const idDe = async (spanish: string) => {
        const w = await db.dictionaryWord.findFirst({
          where: { spanish: { equals: spanish }, status: "PUBLISHED" },
        });
        if (!w) throw new Error("Palabra seed no encontrada: " + spanish);
        return w as { id: string; spanish: string; nasaYuwe: string };
      };
      const blocks: unknown[] = [];
      if (les.ficha) blocks.push({ id: "blk_seed_" + mi + "_" + li + "_w", type: "word", wordId: (await idDe(les.ficha)).id });
      if (les.palabras) {
        const ids: string[] = [];
        for (const x of les.palabras) ids.push((await idDe(x)).id);
        blocks.push({ id: "blk_seed_" + mi + "_" + li + "_v", type: "vocabulary", wordIds: ids });
      }
      if (les.flashcards) {
        const words: { id: string; spanish: string; nasaYuwe: string }[] = [];
        for (const x of les.flashcards) words.push(await idDe(x));
        const opts = words.map((w) => ({ text: w.nasaYuwe, correct: true }));
        // Quiz de reconocimiento: una pregunta por palabra, distractores del pool.
        const pool = await db.dictionaryWord.findMany({
          where: { status: "PUBLISHED" },
          select: { spanish: true, nasaYuwe: true },
          orderBy: { spanish: "asc" },
          take: 20,
        });
        const questions: any[] = [];

        for (const w of words) {
          const distract = pool
            .filter((d) => d.nasaYuwe !== w.nasaYuwe)
            .slice(0, 3)
            .map((d) => ({ text: d.nasaYuwe, correct: false }));
          questions.push({
            prompt: "Como se dice \"" + w.spanish + "\" en Nasa Yuwe?",
            options: [{ text: w.nasaYuwe, correct: true }, ...distract],
            explanation: w.spanish + " es " + w.nasaYuwe + ".",
          });
        }
        blocks.push({ id: "blk_seed_" + mi + "_" + li + "_q", type: "quiz", passScore: 50, questions });
      }
      if (les.completa) {
        const w = await idDe(les.completa);
        const pool = await db.dictionaryWord.findMany({
          where: { status: "PUBLISHED", NOT: { id: w.id } },
          select: { spanish: true },
          orderBy: { spanish: "asc" },
          take: 12,
        });
        const distract = pool.slice(0, 3).map((d) => ({ text: d.spanish, correct: false }));
        blocks.push({
          id: "blk_seed_" + mi + "_" + li + "_q",
          type: "quiz",
          passScore: 50,
          questions: [
            {
              prompt: "Como se dice \"" + w.spanish + "\" en Nasa Yuwe?",
              options: [{ text: w.nasaYuwe, correct: true }, ...distract],
              explanation: w.spanish + " es " + w.nasaYuwe + ".",
            },
          ],
        });
      }
      if (les.content) blocks.push(...les.content.blocks);
      const parsed = parseLessonContent({ version: 2, blocks });
      if (!parsed.ok) throw new Error("Bloques invalidos en " + les.title + ": " + parsed.errors.join(" | "));
      await db.lesson.create({
        data: {
          moduleId: created.id,
          title: les.title,
          order: li,
          lessonNumber: li + 1,
          content: parsed.content as unknown as Prisma.InputJsonValue,
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
