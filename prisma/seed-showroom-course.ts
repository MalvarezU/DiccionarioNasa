/**
 * Seed del curso mostrario "Mostrario · Todos los bloques".
 *
 * Crea UN curso PUBLISHED con 3 módulos y 6 lecciones que cubren los 9 tipos
 * de bloque del contrato (src/lib/courses/blocks.ts): text, image, video,
 * audio, word, vocabulary, quiz, listening y game. Los legacy quedan fuera a
 * propósito (están deprecados).
 *
 * Idempotente: si ya existe un curso con ese título, lo borra y lo recrea.
 * Uso: set -a; source .env.local; set +a; bun run prisma/seed-showroom-course.ts
 * SOLO contra BD local/E2E. Jamás contra prod.
 */
import { PrismaClient } from "@prisma/client";
import { parseLessonContent, type LessonContent } from "../src/lib/courses/blocks";

const db = new PrismaClient();

const TITLE = "Mostrario · Todos los bloques";

const WORDS = ["Casa", "Agua", "Perro", "Sol", "Luna", "Gallina", "Fuego"] as const;

function mustContent(label: string, content: LessonContent): string {
  const parsed = parseLessonContent(content);
  if (!parsed.ok) {
    throw new Error(`Contenido inválido en ${label}: ${parsed.errors.join(" | ")}`);
  }
  return JSON.stringify({ version: parsed.content.version, blocks: parsed.content.blocks });
}

async function main() {
  const ids = new Map<string, string>();
  for (const spanish of WORDS) {
    const w = await db.dictionaryWord.findFirst({
      where: { spanish, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!w) throw new Error(`Palabra PUBLISHED no encontrada: ${spanish}`);
    ids.set(spanish, w.id);
  }
  const id = (s: string) => ids.get(s)!;

  const existing = await db.course.findFirst({ where: { title: TITLE } });
  if (existing) {
    await db.course.delete({ where: { id: existing.id } });
    console.log("Mostrario anterior eliminado:", existing.id);
  }

  const course = await db.course.create({
    data: {
      title: TITLE,
      description:
        "Curso de muestra para revisar cada elemento visual: texto, imagen, video, audio, palabra, vocabulario, quiz, escucha y juegos.",
      status: "PUBLISHED",
      sequential: false,
    },
  });

  const lessons: Array<{ module: string; title: string; content: LessonContent }> = [
    {
      module: "Módulo 1: Contenido",
      title: "Texto, imagen y video",
      content: {
        version: 2,
        blocks: [
          {
            id: "intro",
            type: "text",
            html: "<h1>Bienvenido al mostrario</h1><p>Este bloque de <strong>texto</strong> acepta <em>markdown</em>: listas, enlaces y énfasis.</p><ul><li>Primer punto</li><li>Segundo punto</li></ul><p>Así se ve un párrafo largo en la lección del estudiante.</p>",
          },
          {
            id: "foto",
            type: "image",
            url: "https://picsum.photos/seed/nasa-yuwe/800/400",
            alt: "Fotografía de ejemplo del mostrario",
            caption: "Pie de imagen: así se ve una ilustración dentro de la lección.",
          },
          { id: "clip", type: "video", youtubeId: "aqz-KE-bpKQ", title: "Video de ejemplo" },
        ],
      },
    },
    {
      module: "Módulo 1: Contenido",
      title: "Audio, palabra y vocabulario",
      content: {
        version: 2,
        blocks: [
          {
            id: "pista",
            type: "audio",
            media: { source: "upload", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
            title: "Audio de ejemplo",
          },
          { id: "ficha", type: "word", wordId: id("Casa") },
          { id: "vocab", type: "vocabulary", wordIds: [id("Casa"), id("Agua"), id("Perro")] },
        ],
      },
    },
    {
      module: "Módulo 2: Práctica",
      title: "Quiz de ejemplo",
      content: {
        version: 2,
        blocks: [
          {
            id: "quiz1",
            type: "quiz",
            passScore: 70,
            questions: [
              {
                prompt: "¿Cuál de estas palabras significa lo mismo que la ficha de Casa?",
                options: [
                  { text: "Casa", correct: true },
                  { text: "Perro", correct: false },
                  { text: "Luna", correct: false },
                ],
                explanation: "La ficha enlazada arriba dice Casa.",
              },
              {
                prompt: "Elige la palabra de la lista de vocabulario",
                options: [
                  { text: "Sol", correct: false },
                  { text: "Agua", correct: true },
                  { text: "Fuego", correct: false },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      module: "Módulo 2: Práctica",
      title: "Escucha de ejemplo",
      content: {
        version: 2,
        blocks: [
          {
            id: "oido",
            type: "listening",
            media: { source: "upload", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
            question: "Escucha la pista y elige la palabra correcta",
            options: [
              { text: "Casa", correct: true },
              { text: "Agua", correct: false },
              { text: "Perro", correct: false },
            ],
          },
        ],
      },
    },
    {
      module: "Módulo 3: Práctica extra",
      title: "Quiz de reconocimiento",
      content: {
        version: 2,
        blocks: [
          {
            id: "quiz2",
            type: "quiz",
            passScore: 60,
            questions: [
              {
                prompt: "¿Cuál es la palabra para 'Casa'?",
                options: [
                  { text: "Yat", correct: true },
                  { text: "Yu'", correct: false },
                  { text: "Sek", correct: false },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      module: "Módulo 3: Práctica extra",
      title: "Vocabulario de ejemplo",
      content: {
        version: 2,
        blocks: [
          { id: "vocab2", type: "vocabulary", wordIds: [id("Sol"), id("Luna"), id("Fuego")] },
        ],
      },
    },
  ];

  const moduleIds = new Map<string, string>();
  let order = 0;
  for (const les of lessons) {
    let moduleId = moduleIds.get(les.module);
    if (!moduleId) {
      const mod = await db.module.create({
        data: { courseId: course.id, title: les.module, order: moduleIds.size },
      });
      moduleIds.set(les.module, mod.id);
      moduleId = mod.id;
    }
    await db.lesson.create({
      data: {
        moduleId,
        title: les.title,
        order: order++,
        lessonNumber: order,
        content: mustContent(les.title, les.content),
      },
    });
  }

  console.log("Mostrario creado:", course.id, "| módulos:", moduleIds.size, "| lecciones:", lessons.length);
}

await main().finally(() => db.$disconnect());
