import { unescapeCsvField } from './clean-quotes'
import * as fs from 'fs'
import * as path from 'path'

const CSV_PATH = path.join(__dirname, 'seed-data.csv')

function parseCSVLineRaw(line: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0
  while (i < line.length) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '""'
          i += 2
        } else {
          current += '"'
          inQuotes = false
          i++
        }
      } else {
        current += c
        i++
      }
    } else {
      if (c === '"' && current === '') {
        current += '"'
        inQuotes = true
        i++
      } else if (c === ',') {
        parts.push(current)
        current = ''
        i++
      } else {
        current += c
        i++
      }
    }
  }
  parts.push(current)
  return parts
}

function serializeField(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function processLine(line: string): { line: string; changed: boolean } {
  if (!line.trim()) return { line, changed: false }
  const fields = parseCSVLineRaw(line)
  let changed = false
  const out = fields.map((f) => {
    const c = unescapeCsvField(f)
    if (c !== f) {
      changed = true
      return serializeField(c!)
    }
    return f
  })
  return { line: out.join(','), changed }
}

function main(): void {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`No se encontró: ${CSV_PATH}`)
    process.exit(1)
  }

  const original = fs.readFileSync(CSV_PATH, 'utf-8')
  const rawLines = original.split('\n')

  const outLines: string[] = []
  let changedLines = 0

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].replace(/\r$/, '')
    if (raw === '') {
      outLines.push(rawLines[i])
      continue
    }
    const { line, changed } = processLine(raw)
    if (changed) changedLines++
    outLines.push(rawLines[i].endsWith('\r') ? line + '\r' : line)
  }

  const output = outLines.join('\n')

  console.log(`Líneas totales:    ${rawLines.filter((l) => l !== '').length}`)
  console.log(`Líneas corregidas: ${changedLines}`)

  if (changedLines === 0) {
    console.log('✓ CSV ya está limpio — no se hicieron cambios.')
    return
  }

  const bakPath = CSV_PATH + '.bak'
  fs.writeFileSync(bakPath, original)
  fs.writeFileSync(CSV_PATH, output)

  console.log(`✓ Backup:  ${bakPath}`)
  console.log(`✓ Corregido: ${CSV_PATH}`)
  console.log('')
  console.log('Para revertir: mv ' + path.basename(bakPath) + ' ' + path.basename(CSV_PATH))
}

if (import.meta.main) {
  main()
}
