/**
 * Seed del curso demo "Nasa Yuwe Básico" (B2.0).
 *
 * Idempotente: si ya existe un curso PUBLICADO con ese título, no hace nada.
 * Las lecciones READ referencian palabras reales por `spanish` (sin duplicar
 * contenido); si una palabra no existe, la lección queda sin wordId.
 * Uso: bun run prisma/seed-demo-course.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TITLE = "Nasa Yuwe Básico";

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

async function main() {
  const existing = await db.course.findFirst({
    where: { title: TITLE, status: "PUBLISHED" },
  });
  if (existing) {
    console.log("Curso demo ya existe, nada que hacer:", existing.id);
    return;
  }

  const course = await db.course.create({
    data: {
      title: TITLE,
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
      await db.lesson.create({
        data: {
          moduleId: created.id,
          title: les.title,
          type: les.type,
          order: li,
          wordId,
          payload: les.payload ? JSON.stringify(les.payload) : null,
        },
      });
    }
  }

  console.log("Curso demo creado:", course.id);
}

await main().finally(() => db.$disconnect());
