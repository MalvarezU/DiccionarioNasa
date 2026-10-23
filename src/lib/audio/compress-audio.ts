/**
 * Compresión de audios en el cliente a Ogg Opus 24kbps mono (libopus WASM).
 *
 * Misma filosofía que las imágenes: se comprime ANTES de subir para no
 * mover megas por 2G/3G. Un audio de palabra (2-4s) queda en ~6-12 KB
 * frente a ~40-120 KB del MP3 típico. El server solo valida por firma
 * binaria y sube a R2.
 *
 * El encoder corre en cualquier navegador (WASM, sin APIs nativas): Safari
 * incluido. La reproducción usa el decoder nativo de cada navegador.
 */

/** Bitrate objetivo: 24 kbps mono es voz clara para palabras habladas. */
export const OPUS_BITRATE_KBPS = 24

/** Mezcla N canales a mono promediando. Puro y testeable. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0)
  if (channels.length === 1) return channels[0]!
  const len = Math.max(...channels.map((c) => c.length))
  const out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let acc = 0
    for (const c of channels) acc += c[i] ?? 0
    out[i] = acc / channels.length
  }
  return out
}

/** Concatena los chunks Uint8Array del encoder en un solo buffer. */
export function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

export function opusFileName(original: string): string {
  const base = original.replace(/\.[^.]*$/, "") || "audio"
  return `${base}.ogg`
}

export type CompressAudioResult =
  | { ok: true; file: File; originalBytes: number; opusBytes: number }
  | { ok: false; file: File; reason: string }

/**
 * Comprime un archivo de audio a Ogg Opus mono 24kbps.
 * Import dinámico: el WASM (~260KB) solo se descarga al comprimir.
 * Ante cualquier fallo devuelve el original (nunca bloquea la subida).
 */
export async function compressToOpus(
  file: File,
  { bitrate = OPUS_BITRATE_KBPS }: { bitrate?: number } = {}
): Promise<CompressAudioResult> {
  const originalBytes = file.size
  try {
    const ctx = new AudioContext()
    let audio: AudioBuffer
    try {
      audio = await ctx.decodeAudioData(await file.arrayBuffer())
    } finally {
      await ctx.close().catch(() => {})
    }
    if (audio.numberOfChannels < 1 || audio.length === 0) {
      return { ok: false, file, reason: "audio vacío" }
    }

    const channels: Float32Array[] = []
    for (let c = 0; c < audio.numberOfChannels; c++) {
      channels.push(audio.getChannelData(c).slice())
    }
    const mono = downmixToMono(channels)

    // Lazy: el módulo WASM no entra al bundle principal.
    const { default: createEncoder } = await import("@audio/encode-opus")
    const enc = await createEncoder({
      sampleRate: audio.sampleRate,
      channels: 1,
      bitrate,
    })
    let body: Uint8Array
    try {
      const head = enc.encode([mono])
      const tail = enc.flush()
      body = concatChunks([head, tail])
    } finally {
      enc.free()
    }
    if (body.length === 0) return { ok: false, file, reason: "encode vacío" }

    const out = new File([body as unknown as BlobPart], opusFileName(file.name), {
      type: "audio/ogg",
    })
    return { ok: true, file: out, originalBytes, opusBytes: out.size }
  } catch (err) {
    return {
      ok: false,
      file,
      reason: err instanceof Error ? err.message : "error desconocido",
    }
  }
}
