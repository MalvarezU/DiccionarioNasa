import type { LessonBlock } from "@/lib/courses/blocks"
import {
  audioRefToKey,
  isAllowedCoverImageUrl,
  r2PublicBase,
} from "@/lib/media/storage"

/**
 * Constructor del manifiesto por referencias (Fase B W3c, spec §3.4).
 *
 * Funciones puras y testeables sin HTTP. Fuentes cerradas: solo contenido
 * PUBLISHED del bundle. El alcance del parser está fijado:
 * - `video.youtubeId` excluido por diseño (YouTube, no R2).
 * - `text.html` con `<img>` embebida NO se extrae: el sanitizador
 *   (`text-sanitizer`) opera con whitelist cerrada sin `img`, así que el
 *   HTML persistido nunca contiene imágenes referenciables. Si el whitelist
 *   incluye `img` en el futuro, este spec se enmienda y el extractor se
 *   extiende con fixture.
 */

const SAFE_KEY = /^[\w.\-/]+$/

function isSafeKey(key: string): boolean {
  return key.length > 0 && !key.includes("..") && SAFE_KEY.test(key)
}

export type WordMediaRef = {
  audioUrl: string | null
  illustrationUrl: string | null
}

export type CourseMediaRef = {
  coverImage: string | null
}

/** Todas las URLs R2 candidatas referenciadas por el contenido PUBLISHED. */
export function collectMediaRefs(input: {
  words: WordMediaRef[]
  courses: CourseMediaRef[]
  lessonBlocks: LessonBlock[][]
}): string[] {
  const refs: string[] = []

  for (const w of input.words) {
    if (w.audioUrl) refs.push(w.audioUrl)
    if (w.illustrationUrl) refs.push(w.illustrationUrl)
  }

  for (const c of input.courses) {
    // Portada: solo media propia bajo la base R2. El redirect legacy
    // `/api/media/<id>` pasa `isAllowedCoverImageUrl` pero no es objeto R2
    // directo → excluido del manifiesto (E8). Externa → excluida.
    const base = r2PublicBase()
    if (
      c.coverImage &&
      isAllowedCoverImageUrl(c.coverImage) &&
      base &&
      c.coverImage.startsWith(`${base}/`)
    ) {
      refs.push(c.coverImage)
    }
  }

  for (const blocks of input.lessonBlocks) {
    for (const b of blocks) {
      if (b.type === "image") {
        refs.push(b.url)
      } else if (b.type === "audio" || b.type === "listening") {
        if (b.media.url) refs.push(b.media.url)
      }
      // video / word / vocabulary / text / quiz: no aportan medios.
    }
  }

  return refs
}

/** Deriva la clave R2 de una URL pública por strip de la base. null si no deriva. */
export function publicUrlToKey(url: string): string | null {
  const base = r2PublicBase()
  if (!base || typeof url !== "string" || !url.startsWith(`${base}/`)) return null
  const key = url.slice(base.length + 1).split("?")[0] ?? ""
  return isSafeKey(key) ? key : null
}

/**
 * Filtra refs a claves R2 válidas y deduplica. Sin tabla completa.
 *
 * Orden de derivación: `publicUrlToKey` primero (única vía para imágenes).
 * Fallback `audioRefToKey` SOLO para refs de audio: URLs absolutas legacy
 * (Supabase `.../storage/v1/object/.../audios/...`) o claves relativas que
 * ya cuelguen de `audios/`. Una imagen fuera de la base nunca se prefija
 * como audio (evita fabricar `audios/images/...` inexistentes).
 */
export function refsToKeys(urls: readonly string[]): string[] {
  const keys = new Set<string>()
  for (const url of urls) {
    const direct = publicUrlToKey(url)
    if (direct) {
      keys.add(direct)
      continue
    }
    if (typeof url === "string" && (url.includes("://") || url.startsWith("audios/"))) {
      const legacy = audioRefToKey(url)
      if (legacy) keys.add(legacy)
    }
  }
  return [...keys]
}

/**
 * Test de coherencia R3(b): referencias del bundle sin fila con hash.
 * Retorna la lista de excluidos (vacía en verde). Una referencia cuenta
 * como presente solo si su fila existe y `sha256` no es nulo.
 */
export function missingMediaKeys(
  referencedKeys: readonly string[],
  present: ReadonlyArray<{ objectKey: string; sha256: string | null }>
): string[] {
  const ok = new Set(
    present.filter((p) => p.sha256).map((p) => p.objectKey)
  )
  return referencedKeys.filter((k) => !ok.has(k))
}
