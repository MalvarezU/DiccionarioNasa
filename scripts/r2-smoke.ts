/**
 * Smoke test R2 (Fase 0): PUT → HEAD → GET público → DELETE.
 * No toca la BD ni la app: verifica credenciales, bucket y URL pública.
 * Uso: set -a; . ./.env.r2.test; set +a; bun scripts/r2-smoke.ts
 */
import {
  putObject,
  objectExists,
  deleteObject,
  publicUrl,
  r2Bucket,
} from "../src/lib/r2"

async function main() {
  console.log("bucket:", r2Bucket())
  const key = `smoke/smoke-${Date.now()}.txt`
  const body = new TextEncoder().encode(`r2 smoke ${new Date().toISOString()}`)

  await putObject(key, body, "text/plain")
  console.log("PUT ok:", key)

  const exists = await objectExists(key)
  console.log("HEAD exists:", exists)
  if (!exists) throw new Error("HEAD no encontró el objeto recién subido")

  const url = publicUrl(key)
  const res = await fetch(url)
  const text = await res.text()
  console.log("GET público:", res.status, JSON.stringify(text.slice(0, 80)))
  if (!res.ok || !text.includes("r2 smoke")) {
    throw new Error(`GET público falló (${res.status})`)
  }

  await deleteObject(key)
  const gone = !(await objectExists(key))
  console.log("DELETE ok, ya no existe:", gone)
  if (!gone) throw new Error("DELETE no borró el objeto")

  console.log("\nSMOKE OK: credenciales + bucket + URL pública funcionan")
}

await main()
