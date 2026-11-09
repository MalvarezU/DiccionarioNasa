/**
 * Zip mínimo de método `stored` (sin compresión), determinista.
 *
 * El generador del seed (Fase C, W1) no puede sumar dependencias: `npm
 * install` está vetado en este slice y el layout exigido por el spec
 * (§2.6) es trivial (raíz + `media/`, sin subdirectorios anidados ni
 * features). Writer + reader propios con CRC32, timestamps fijos y
 * entradas ordenadas por nombre: misma entrada → mismos bytes.
 *
 * Límites asumidos y documentados: nombres UTF-8 < 64 KiB, datos < 4 GiB
 * por entrada (u32), sin Zip64, sin cifrado, sin Unix extras más allá del
 * modo fijo 0644. El lector rechaza firmas que no sean `stored`.
 */

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50
const METHOD_STORED = 0
/** Fecha DOS fija (2024-01-01 00:00:00): el zip no depende del reloj. */
const DOS_TIME = (0 << 11) | (0 << 5) | 0
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntryInput {
  name: string
  data: Uint8Array
}

export interface ZipEntry {
  name: string
  data: Buffer
}

function encodeName(name: string): Buffer {
  return Buffer.from(name, "utf8")
}

/**
 * Empaqueta entradas `stored` con cabeceras deterministas. Ordena por
 * nombre: el orden de inserción del llamante no afecta el resultado.
 */
export function createStoredZip(entries: ZipEntryInput[]): Buffer {
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const entry of sorted) {
    const name = encodeName(entry.name)
    if (name.length > 0xffff) throw new Error(`[seed-zip] nombre demasiado largo: ${entry.name}`)
    if (entry.data.length > 0xffffffff) throw new Error(`[seed-zip] entrada demasiado grande: ${entry.name}`)
    const crc = crc32(entry.data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_SIG, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // flag: nombres UTF-8
    local.writeUInt16LE(METHOD_STORED, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(entry.data.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, name, Buffer.from(entry.data))

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(CENTRAL_SIG, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(METHOD_STORED, 10)
    centralHeader.writeUInt16LE(DOS_TIME, 12)
    centralHeader.writeUInt16LE(DOS_DATE, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(entry.data.length, 20)
    centralHeader.writeUInt32LE(entry.data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0o100644 * 0x10000, 38)
    centralHeader.writeUInt32LE(offset, 42)
    central.push(centralHeader, name)

    offset += local.length + name.length + entry.data.length
  }

  const centralDir = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(EOCD_SIG, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(sorted.length, 8)
  eocd.writeUInt16LE(sorted.length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...chunks, centralDir, eocd])
}

/** Lee un zip `stored` (verificación y tests). Rechaza métodos != 0. */
export function readStoredZip(zip: Uint8Array): ZipEntry[] {
  const buf = Buffer.from(zip)
  const out: ZipEntry[] = []
  let pos = 0
  while (pos + 30 <= buf.length) {
    const sig = buf.readUInt32LE(pos)
    if (sig === EOCD_SIG || sig === CENTRAL_SIG) break
    if (sig !== LOCAL_SIG) throw new Error(`[seed-zip] firma inesperada en offset ${pos}`)
    const method = buf.readUInt16LE(pos + 8)
    if (method !== METHOD_STORED) throw new Error(`[seed-zip] método no soportado: ${method}`)
    const crc = buf.readUInt32LE(pos + 14)
    const size = buf.readUInt32LE(pos + 22)
    const nameLen = buf.readUInt16LE(pos + 26)
    const extraLen = buf.readUInt16LE(pos + 28)
    const name = buf.subarray(pos + 30, pos + 30 + nameLen).toString("utf8")
    const start = pos + 30 + nameLen + extraLen
    const data = buf.subarray(start, start + size)
    if (crc32(data) !== crc) throw new Error(`[seed-zip] CRC distinto en ${name}`)
    out.push({ name, data: Buffer.from(data) })
    pos = start + size
  }
  return out
}
