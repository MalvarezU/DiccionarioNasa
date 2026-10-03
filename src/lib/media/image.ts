/**
 * Validación de imágenes para el contenido de cursos.
 *
 * Las imágenes se guardan en Postgres (columna `bytea` de MediaAsset) y se
 * sirven por /api/media/[id]. Por eso el límite de tamaño importa: cada byte
 * queda en la base.
 *
 * El tipo se detecta por FIRMA BINARIA, nunca por lo que declara el cliente:
 * el `Content-Type` de un multipart lo elige quien sube el archivo. Un SVG
 * renombrado a .png con MIME image/png pasaría una validación ingenua y, servido
 * como imagen, es un vector de XSS. Acá no pasa.
 */

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export type ImageFormat = {
  mimeType: string
  /** Extensión canónica que se usa al guardar. */
  ext: string
  /** Extensiones aceptadas al validar (alias incluidos). */
  aliases: string[]
}

export const IMAGE_FORMATS: readonly ImageFormat[] = [
  { mimeType: "image/png", ext: "png", aliases: ["png"] },
  { mimeType: "image/jpeg", ext: "jpg", aliases: ["jpg", "jpeg"] },
  { mimeType: "image/webp", ext: "webp", aliases: ["webp"] },
  { mimeType: "image/avif", ext: "avif", aliases: ["avif"] },
] as const

export const ACCEPTED_MIME_TYPES: readonly string[] = IMAGE_FORMATS.map((f) => f.mimeType)
/** Para el atributo `accept` del input de archivo. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(",")

export function humanMaxSize(): string {
  return `${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB`
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = ""
  for (let i = offset; i < offset + length; i++) {
    if (i >= bytes.length) return out
    out += String.fromCharCode(bytes[i]!)
  }
  return out
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((b, i) => bytes[i] === b)
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Devuelve el MIME real de la imagen según sus primeros bytes, o null si no es
 * uno de los formatos admitidos.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png"

  // JPEG: SOI (FF D8) + marcador (FF)
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }

  // WebP: contenedor RIFF con marca WEBP en el offset 8
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp"
  }

  // AVIF: caja ISO-BMFF con marca avif/avis
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4)
    if (brand === "avif" || brand === "avis") return "image/avif"
  }

  return null
}

/** SVG es texto: se detecta por contenido, no por firma. */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = ascii(bytes, 0, 512).toLowerCase()
  return head.includes("<svg") || head.includes("<?xml")
}

export function looksLikeGif(bytes: Uint8Array): boolean {
  return ascii(bytes, 0, 4) === "GIF8"
}

export type ImageValidation =
  | { ok: true; mimeType: string; ext: string }
  | { ok: false; message: string }

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot === -1 || dot === filename.length - 1) return ""
  return filename.slice(dot + 1).toLowerCase()
}

/**
 * Valida una subida de imagen. El MIME que declara el cliente se ignora a
 * propósito: el que vale es el detectado.
 */
export function validateImageUpload(input: {
  filename: string
  size: number
  bytes: Uint8Array
}): ImageValidation {
  const { filename, size, bytes } = input

  if (size <= 0) {
    return { ok: false, message: "El archivo está vacío" }
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: false, message: `La imagen no puede superar los ${humanMaxSize()}` }
  }

  // SVG primero: es la amenaza concreta, y merece un mensaje propio.
  if (looksLikeSvg(bytes)) {
    return {
      ok: false,
      message: "No se admiten archivos SVG por seguridad. Usa PNG, JPG, WebP o AVIF",
    }
  }
  if (looksLikeGif(bytes)) {
    return { ok: false, message: "No se admiten GIF. Usa PNG, JPG, WebP o AVIF" }
  }

  const mimeType = detectImageType(bytes)
  if (mimeType === null) {
    return { ok: false, message: "Formato no soportado. Usa PNG, JPG, WebP o AVIF" }
  }

  const formato = IMAGE_FORMATS.find((f) => f.mimeType === mimeType)!
  const ext = extensionOf(filename)

  // Sin extensión se acepta (manda el contenido). Con extensión, tiene que
  // coincidir: una discrepancia es un error honesto o un intento de disfraz.
  if (ext !== "" && !formato.aliases.includes(ext)) {
    return {
      ok: false,
      message: `La extensión .${ext} no coincide con el contenido real (${formato.ext})`,
    }
  }

  return { ok: true, mimeType, ext: formato.ext }
}
