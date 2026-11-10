import { db } from "@/lib/db"
import { audioRefToKey, illustrationRefToAssetRef } from "./storage"

/**
 * F1-a: sha256 de los medios por palabra para sync/seed.
 *
 * Resuelve `audioUrl` por `objectKey` (vía `audioRefToKey`) e
 * `illustrationUrl` por id legacy (`/api/media/<id>`) u `objectKey`
 * (URL pública R2), con UNA sola query a `MediaAsset` por página
 * (sin N+1). Aditivo: `string | null` — null si no hay referencia
 * resoluble, no hay fila, o la fila no tiene hash (R3(b): el hash
 * permanece nullable hasta completar el backfill).
 */

export interface WordMediaInput {
  id: string
  audioUrl: string | null | undefined
  illustrationUrl: string | null | undefined
}

export interface WordMediaHashes {
  audioSha256: string | null
  illustrationSha256: string | null
}

export async function resolveWordMediaSha256(
  words: WordMediaInput[]
): Promise<Map<string, WordMediaHashes>> {
  const audioKeyOf = new Map<string, string>()
  const audioKeys = new Set<string>()
  const illKeys = new Set<string>()
  const illIds = new Set<string>()
  const illRefOf = new Map<string, { kind: "id"; id: string } | { kind: "key"; objectKey: string }>()

  for (const w of words) {
    const aKey = audioRefToKey(w.audioUrl)
    if (aKey) {
      audioKeys.add(aKey)
      audioKeyOf.set(w.id, aKey)
    }
    const ill = illustrationRefToAssetRef(w.illustrationUrl)
    if (ill) {
      illRefOf.set(w.id, ill)
      if (ill.kind === "id") illIds.add(ill.id)
      else illKeys.add(ill.objectKey)
    }
  }

  const keys = [...audioKeys, ...illKeys]
  const assets =
    keys.length === 0 && illIds.size === 0
      ? []
      : await db.mediaAsset.findMany({
          where: {
            OR: [
              ...(keys.length > 0 ? [{ objectKey: { in: keys } }] : []),
              ...(illIds.size > 0 ? [{ id: { in: [...illIds] } }] : []),
            ],
          },
          select: { id: true, objectKey: true, sha256: true },
        })

  const shaByKey = new Map<string, string | null>()
  const shaById = new Map<string, string | null>()
  for (const a of assets) {
    shaByKey.set(a.objectKey, a.sha256 ?? null)
    shaById.set(a.id, a.sha256 ?? null)
  }

  const out = new Map<string, WordMediaHashes>()
  for (const w of words) {
    const aKey = audioKeyOf.get(w.id)
    const ill = illRefOf.get(w.id)
    out.set(w.id, {
      audioSha256: aKey ? (shaByKey.get(aKey) ?? null) : null,
      illustrationSha256: ill
        ? ill.kind === "id"
          ? (shaById.get(ill.id) ?? null)
          : (shaByKey.get(ill.objectKey) ?? null)
        : null,
    })
  }
  return out
}
