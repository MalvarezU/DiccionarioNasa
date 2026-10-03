/**
 * Backfill: convierte las lecciones existentes al documento de bloques.
 *
 * Es idempotente: solo toca lecciones con `content` en null, así que se puede
 * correr las veces que haga falta sin duplicar nada.
 *
 * El mapeo legacy -> bloques vive en src/lib/courses/legacy-migration.ts,
 * donde está testeado sin base de datos.
 *
 * Uso:  set -a; . ./.env.test; set +a; bun run prisma/backfill-lesson-blocks.ts
 */

import { PrismaClient, Prisma } from "@prisma/client"
import {
  blocksForLegacyLesson,
  deterministicBlockId,
} from "../src/lib/courses/legacy-migration"

const db = new PrismaClient()

async function main() {
  const pendientes = await db.lesson.findMany({
    where: { content: { equals: Prisma.DbNull } },
    select: { id: true, title: true, type: true, wordId: true, payload: true },
    orderBy: { id: "asc" },
  })

  console.log(`Lecciones sin contenido: ${pendientes.length}`)

  let conBloques = 0
  let vacias = 0

  for (const lesson of pendientes) {
    const blocks = blocksForLegacyLesson(lesson, deterministicBlockId)
    if (blocks.length > 0) conBloques++
    else vacias++

    await db.lesson.update({
      where: { id: lesson.id },
      data: { content: { version: 1, blocks } },
    })
  }

  const restantes = await db.lesson.count({ where: { content: { equals: Prisma.DbNull } } })
  console.log(`  con bloques: ${conBloques}`)
  console.log(`  sin contenido (vacías): ${vacias}`)
  console.log(
    `Lecciones aún sin content: ${restantes} ${restantes === 0 ? "OK" : "<-- REVISAR"}`
  )
}

main()
  .catch((err) => {
    console.error("Backfill falló:", err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
