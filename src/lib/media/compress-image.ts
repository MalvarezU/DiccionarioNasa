/**
 * Compresión de imágenes en el cliente antes de subirlas a Postgres.
 *
 * Es la condición para que el límite de 3 MB del lado servidor no rechace
 * fotos de celular (que salen de cámara en 3-6 MB). Redimensionar a un lado
 * máximo de 1600px y re-encodar con canvas baja esas fotos a ~100-300 KB,
 * que es más que suficiente para una lección.
 */

/** Lado máximo (px) de una imagen de curso. 1600 queda nítido a ancho completo. */
export const IMAGE_MAX_DIMENSION = 1600

export function targetDimensions(
  width: number,
  height: number,
  max = IMAGE_MAX_DIMENSION
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    return { width: max, height: max }
  }
  const longest = Math.max(width, height)
  if (longest <= max) return { width: width, height: height }

  // Redimensiona preservando el ratio, redondeado hacia abajo para no
  // exceder nunca el máximo.
  const escala = max / longest
  return { width: Math.floor(width * escala), height: Math.floor(height * escala) }
}

/**
 * Extensión honesta para la salida. El servidor valida que la extensión
 * coincida con la firma del contenido, así que el nombre no puede mentir.
 */
export function filenameForBlob(original: string, outType: string): string {
  const parte = original.replace(/\.[^.]*$/, "")
  if (outType === "image/webp") return `${parte}.webp`
  if (outType === "image/png") return `${parte}.png`
  return `${parte}.jpg`
}

/**
 * Re-encoda la imagen al tamaño objetivo. Si el navegador no soporta
 * re-encode (raro), devuelve el archivo original y que lo juzgue el server.
 */
export async function compressImageForWeb(
  file: File,
  { max = IMAGE_MAX_DIMENSION, quality = 0.85 }: { max?: number; quality?: number } = {}
): Promise<File> {
  try {
    // Los PNG necesitan conservar transparencia: los re-encodeamos a WebP
    // (compacta y con canal alfa). El resto va a JPEG, que es más liviano.
    const quieroWebp = file.type === "image/png"
    const salida = quieroWebp ? "image/webp" : "image/jpeg"

    const bitmap = await createImageBitmap(file)
    const { width, height } = targetDimensions(bitmap.width, bitmap.height, max)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), salida, quality)
    })
    if (!blob || blob.size === 0) return file

    // Si el navegador no cumplió con el tipo pedido, lo respetamos en el nombre.
    const nombre = filenameForBlob(file.name, blob.type)
    return new File([blob], nombre, { type: blob.type })
  } catch {
    // OffscreenCanvas/canvas KO: subimos el original y que lo juzgue el server.
    return file
  }
}
