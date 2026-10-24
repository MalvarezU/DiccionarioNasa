/**
 * Detección de audio por FIRMA BINARIA (magic bytes), espejo de image.ts.
 *
 * El `Content-Type` de un multipart lo elige quien sube el archivo: un WAV
 * renombrado a .mp3 pasaría una validación ingenua. Acá manda el contenido.
 */

export type AudioMime = "audio/mpeg" | "audio/wav" | "audio/ogg"

const EXT_BY_MIME: Record<AudioMime, string[]> = {
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/ogg": [".ogg"],
}

export function expectedExtensions(mime: AudioMime): string[] {
  return EXT_BY_MIME[mime]
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = ""
  for (let i = offset; i < offset + length; i++) {
    if (i >= bytes.length) return out
    out += String.fromCharCode(bytes[i]!)
  }
  return out
}

/** Devuelve el MIME real según los primeros bytes, o null si no es audio admitido. */
export function detectAudioMime(bytes: Uint8Array): AudioMime | null {
  if (bytes.length < 4) return null

  // MP3 con etiqueta ID3 (lo más común)
  if (ascii(bytes, 0, 3) === "ID3") return "audio/mpeg"

  // MP3 crudo: frame sync (11 bits en 1) + versión/capa válidas
  if (
    bytes[0] === 0xff &&
    ((bytes[1]! & 0xe0) === 0xe0) &&
    ((bytes[1]! & 0x18) !== 0x08)
  ) {
    return "audio/mpeg"
  }

  // WAV: contenedor RIFF con marca WAVE
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return "audio/wav"
  }

  // Ogg (Vorbis u Opus, incluido el nuestro): página OggS.
  // Si se quiere exigir Opus, buscar "OpusHead" tras "OggS".
  if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg"

  return null
}

/** ¿El contenido es audio Opus dentro de Ogg? (nuestro formato de salida). */
export function isOpusOgg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 4000))
  return head.startsWith("OggS") && head.includes("OpusHead")
}
