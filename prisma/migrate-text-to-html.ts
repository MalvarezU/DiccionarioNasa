/**
 * Migración v1 → v2: bloque `text.markdown` → `text.html` (sanitizado).
 *
 * Idempotente: solo toca documentos con version === 1.
 * Uso (solo BD local/E2E; prod: backup primero):
 *   set -a; source .env; set +a; bun run prisma/migrate-text-to-html.ts
 */
import { PrismaClient } from "@prisma/client"
import { markdownToHtml } from "./legacy-markdown-to-html"

const db = new PrismaClient()

type LessonRow = { id: string; title: string; content: unknown }

async function main() {
  const rows = (await db.$queryRawUnsafe(
    "SELECT id, title, content FROM Lesson ORDER BY id ASC"
  )) as LessonRow[]
  let tocadas = 0
  for (const les of rows) {
    let raw = les.content as { version?: number; blocks?: Array<{ type: string; [k: string]: unknown }> } | null
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw) } catch { raw = null }
    }
    if (!raw || raw.version !== 1) continue
    const blocks = raw.blocks ?? []
    let cambio = false
    for (const b of blocks) {
      if (b.type === "text" && typeof b.markdown === "string") {
        b.html = markdownToHtml(b.markdown)
        delete b.markdown
        cambio = true
      }
    }
    if (!cambio) continue
    await db.$executeRawUnsafe(
      "UPDATE Lesson SET content = ? WHERE id = ?",
      JSON.stringify({ version: 2, blocks }),
      les.id
    )
    console.log(`migrada: "${les.title}"`)
    tocadas++
  }
  console.log(`Listo. Lecciones tocadas: ${tocadas}/${rows.length}`)
}

await main().finally(() => db.$disconnect())
