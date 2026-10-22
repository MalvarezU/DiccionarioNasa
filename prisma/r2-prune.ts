/**
 * Podador de huérfanos R2 (Fase 6): objetos en images/ o audios/ sin fila que
 * los referencie (p. ej. restos de corridas E2E tras el teardown de BD).
 *
 * Referencias válidas: MediaAsset.objectKey + claves derivadas de
 * DictionaryWord.audioUrl. Prefijos fuera de images/|audios/ no se tocan.
 *
 * Uso:
 *   bun run prisma/r2-prune.ts                  # dry-run (default)
 *   bun run prisma/r2-prune.ts --apply --confirm <bucket>
 */
import { PrismaClient } from "@prisma/client"
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3"
import { getR2Client, r2Bucket } from "../src/lib/r2"
import { audioRefToKey } from "../src/lib/media/storage"

const db = new PrismaClient()

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const confirmIdx = args.indexOf("--confirm")
const CONFIRM_BUCKET = confirmIdx === -1 ? null : args[confirmIdx + 1] ?? null

const MANAGED_PREFIXES = ["images/", "audios/"]

async function listAll(bucket: string, client: S3Client): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined
  for (;;) {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000, ContinuationToken: token })
    )
    for (const o of res.Contents ?? []) {
      if (o.Key && MANAGED_PREFIXES.some((p) => o.Key!.startsWith(p))) keys.push(o.Key)
    }
    if (!res.IsTruncated) break
    token = res.NextContinuationToken
  }
  return keys
}

async function referencedKeys(): Promise<Set<string>> {
  const refs = new Set<string>()
  const media = (await db.$queryRawUnsafe(`SELECT objectKey FROM MediaAsset`)) as Array<{
    objectKey: string
  }>
  for (const m of media) refs.add(m.objectKey)
  const words = (await db.$queryRawUnsafe(
    `SELECT audioUrl FROM DictionaryWord WHERE audioUrl IS NOT NULL`
  )) as Array<{ audioUrl: string }>
  for (const w of words) {
    const key = audioRefToKey(w.audioUrl)
    if (key) refs.add(key)
  }
  return refs
}

async function main() {
  const bucket = r2Bucket()
  const client = getR2Client() // valida env (lanza si falta R2_*)

  if (APPLY) {
    if (CONFIRM_BUCKET !== bucket) {
      console.error(`REHUSADO: --apply exige --confirm <bucket> igual a R2_BUCKET (${bucket}).`)
      process.exit(2)
    }
    console.log("⚠️  APPLY: se borrarán objetos huérfanos del bucket de test.\n")
  } else {
    console.log("DRY-RUN: no se borra nada. Usa --apply --confirm <bucket> para ejecutar.\n")
  }

  const [all, refs] = await Promise.all([listAll(bucket, client), referencedKeys()])
  const orphans = all.filter((k) => !refs.has(k))
  console.log(`objetos: ${all.length} | referenciados: ${refs.size} | huérfanos: ${orphans.length}`)
  for (const k of orphans.slice(0, 50)) console.log(`  · ${k}`)
  if (orphans.length > 50) console.log(`  … y ${orphans.length - 50} más`)

  if (APPLY && orphans.length > 0) {
    for (let i = 0; i < orphans.length; i += 1000) {
      const batch = orphans.slice(i, i + 1000)
      await client.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key) => ({ Key })) } })
      )
    }
    console.log(`borrados: ${orphans.length}`)
  }

  await db.$disconnect()
}

await main()
