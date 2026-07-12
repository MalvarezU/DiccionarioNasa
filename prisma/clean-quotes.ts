import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const STRING_FIELDS = [
  'spanish',
  'nasaYuwe',
  'pronunciation',
  'culturalContext',
  'category',
  'examples',
] as const

type StringField = (typeof STRING_FIELDS)[number]

export function unescapeCsvField(s: string | null | undefined): string | null | undefined {
  if (s == null || s === '') return s
  if (s.startsWith('"""') && s.endsWith('"') && s.length >= 4) {
    return s.slice(3, -1).replace(/""/g, '"')
  }
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2 && s.includes('""')) {
    return s.slice(1, -1).replace(/""/g, '"')
  }
  if (s.includes('""')) {
    return s.replace(/""/g, '"')
  }
  return s
}

export function isCsvCorrupted(s: string | null | undefined): boolean {
  if (s == null || s === '') return false
  return unescapeCsvField(s) !== s
}

type Change = {
  id: string
  field: StringField
  before: string
  after: string
  examplesValid: boolean | null
}

type Plan = {
  total: number
  toUpdate: number
  changes: Change[]
  warnings: string[]
}

function buildPlan(): Plan {
  return { total: 0, toUpdate: 0, changes: [], warnings: [] }
}

async function populatePlan(plan: Plan): Promise<void> {
  const words = await prisma.dictionaryWord.findMany({
    where: { status: { in: ['PUBLISHED', 'DRAFT'] } },
  })
  plan.total = words.length

  for (const w of words) {
    const update: Record<string, string> = {}
    for (const field of STRING_FIELDS) {
      const before = (w as Record<string, unknown>)[field] as string | null
      if (before == null) continue
      if (!isCsvCorrupted(before)) continue

      const after = unescapeCsvField(before)!
      let examplesValid: boolean | null = null
      if (field === 'examples') {
        try {
          JSON.parse(after)
          examplesValid = true
        } catch {
          examplesValid = false
          plan.warnings.push(
            `id=${w.id} field=examples: JSON inválido tras unescape (se conserva valor sin tocar si --apply)`
          )
          continue
        }
      }
      update[field] = after
      plan.changes.push({ id: w.id, field, before, after, examplesValid })
    }
    if (Object.keys(update).length > 0) plan.toUpdate++
  }
}

function printTable(plan: Plan): void {
  console.log('')
  console.log('================================================================')
  console.log('DRY-RUN — Cambios propuestos en DictionaryWord')
  console.log('================================================================')
  console.log(`Total de palabras escaneadas: ${plan.total}`)
  console.log(`Palabras con al menos un cambio: ${plan.toUpdate}`)
  console.log(`Cambios totales por campo: ${plan.changes.length}`)
  console.log('')

  if (plan.changes.length === 0) {
    console.log('✓ Nada que limpiar — la base de datos ya está limpia.')
    return
  }

  const idW = Math.max(2, ...plan.changes.map((c) => c.id.length))
  console.log(
    `${'ID'.padEnd(idW)}  ${'CAMPO'.padEnd(16)}  ANTES  →  DESPUÉS`
  )
  console.log('-'.repeat(120))
  for (const c of plan.changes) {
    const before = c.before.length > 40 ? c.before.slice(0, 37) + '...' : c.before
    const after = c.after.length > 40 ? c.after.slice(0, 37) + '...' : c.after
    const flag = c.examplesValid === false ? ' (JSON inválido — se omite)' : ''
    console.log(`${c.id.padEnd(idW)}  ${c.field.padEnd(16)}  ${before}  →  ${after}${flag}`)
  }

  if (plan.warnings.length > 0) {
    console.log('')
    console.log('Advertencias:')
    for (const w of plan.warnings) console.log(`  ! ${w}`)
  }
}

async function apply(plan: Plan): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const logPath = path.join(__dirname, `clean-quotes-${ts}.log.json`)

  const byId = new Map<string, Record<string, string>>()
  for (const c of plan.changes) {
    const row = byId.get(c.id) ?? {}
    row[c.field] = c.after
    byId.set(c.id, row)
  }

  const audit: unknown[] = []
  for (const [id, data] of byId.entries()) {
    await prisma.dictionaryWord.update({ where: { id }, data })
    audit.push({ id, data, at: new Date().toISOString() })
  }

  fs.writeFileSync(logPath, JSON.stringify({ audit, warnings: plan.warnings }, null, 2))
  return logPath
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const applyMode = args.includes('--apply')
  const filterIdx = args.findIndex((a) => a.startsWith('--filter='))
  const filterField = filterIdx >= 0 ? (args[filterIdx].split('=')[1] as StringField) : null

  if (filterField && !STRING_FIELDS.includes(filterField)) {
    console.error(`Campo inválido: ${filterField}. Permitidos: ${STRING_FIELDS.join(', ')}`)
    process.exit(2)
  }

  console.log(`Modo: ${applyMode ? 'APPLY (escribe a BD)' : 'DRY-RUN (solo lectura)'}`)
  if (filterField) console.log(`Filtro de campo: ${filterField}`)

  const plan: Plan = buildPlan()
  await populatePlan(plan)

  if (filterField) {
    plan.changes = plan.changes.filter((c) => c.field === filterField)
    plan.toUpdate = new Set(plan.changes.map((c) => c.id)).size
  }

  printTable(plan)

  if (applyMode && plan.changes.length > 0) {
    const logPath = await apply(plan)
    console.log('')
    console.log(`✓ Aplicado. Log: ${logPath}`)
  } else if (applyMode) {
    console.log('')
    console.log('✓ Sin cambios que aplicar.')
  } else {
    console.log('')
    console.log('Para aplicar ejecuta: bun run db:clean-quotes:apply')
  }
}

if (import.meta.main) {
  main()
    .catch((e) => {
      console.error('Error:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export { STRING_FIELDS }
export type { StringField, Change, Plan }
