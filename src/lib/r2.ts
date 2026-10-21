import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * Cliente Cloudflare R2 (S3-compatible) para imágenes y audios de Piiyaak.
 *
 * Arquitectura: las URLs son PÚBLICAS y permanentes (se guardan en MariaDB y
 * las cachea el service worker offline). Nada de signed URLs con expiración.
 *
 * Variables de entorno:
 * - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 * - R2_PUBLIC_BASE_URL: base pública (dominio custom o https://<bucket>.<id>.r2.dev)
 * - R2_ENDPOINT_OVERRIDE: solo para tests (p. ej. MinIO local). Vacío en prod.
 */

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Falta variable de entorno ${name} (storage R2 no configurado)`)
  }
  return value
}

function endpoint(): string {
  const override = process.env.R2_ENDPOINT_OVERRIDE
  if (override) return override.replace(/\/$/, "")
  return `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`
}

let client: S3Client | null = null

export function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: endpoint(),
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
      // R2 no soporta los checksums nuevos del SDK por defecto; sin esto
      // los PUT fallan con errores de checksum.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  }
  return client
}

export function r2Bucket(): string {
  return requiredEnv("R2_BUCKET")
}

/** URL pública permanente de un objeto: https://cdn.tudominio.com/<key> */
export function publicUrl(key: string): string {
  const base = requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "")
  return `${base}/${key}`
}

export async function putObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }),
  )
}

/** true si el objeto existe en el bucket (verificación post-subida). */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }),
    )
    return true
  } catch {
    return false
  }
}

/**
 * URL prefirmada de SUBIDA (PUT directo navegador → R2).
 * Reservado para archivos grandes futuros: hoy la subida pasa por el
 * servidor para validar la firma binaria antes de guardar.
 */
export async function signUpload(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({ Bucket: r2Bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  )
}

/** URL prefirmada de LECTURA (casos puntuales; el flujo normal usa publicUrl). */
export async function signRead(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: r2Bucket(), Key: key }),
    { expiresIn },
  )
}

/** Solo tests: resetea el cliente cacheado entre casos. */
export function __resetR2ClientForTests(): void {
  client = null
}
