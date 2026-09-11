import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'
import { parseSeedCSV } from './seed-csv'

const prisma = new PrismaClient()

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@nasayuwe.com'
  const password = process.env.ADMIN_PASSWORD || 'AdminNasa2024!'
  const name = process.env.ADMIN_NAME || 'Administrador'

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    if (existing.role === 'admin') {
      console.log('✓ Admin user already exists')
      return
    }
    await prisma.user.update({ where: { email }, data: { role: 'admin' } })
    console.log('✓ Existing user promoted to admin')
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { email, password: hashedPassword, name, role: 'admin' },
  })
  console.log('✓ Admin user created: admin@nasayuwe.com / AdminNasa2024!')
}

function parseCSV(content: string) {
  // Parser real con comillas (B1.11): ver seed-csv.ts
  return parseSeedCSV(content).words;
}

async function main() {
  console.log('Seeding database...\n')

  await createAdmin()
  console.log('')

  const csvPath = path.join(__dirname, 'seed-data.csv')

  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath)
    process.exit(1)
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const { words, skippedDup } = parseSeedCSV(csvContent)

  console.log(`Parsed ${words.length} words from CSV (${skippedDup} duplicadas omitidas)`)

  const existingCount = await prisma.dictionaryWord.count()
  // Seguro anti-borrado: el seed hace deleteMany (¡borra favoritos/historial
  // por cascada y pone audioUrl en null!). Solo con --force en BD con datos.
  if (existingCount > 0 && !process.argv.includes('--force')) {
    console.error(
      `La BD ya tiene ${existingCount} fichas. El seed las BORRARÍA (incluye audioUrl, favoritos e historial). ` +
      `Revisa el backup y re-ejecuta con --force. Nada modificado.`
    )
    process.exit(2)
  }

  await prisma.dictionaryWord.deleteMany()
  console.log('Cleared existing words')

  for (const word of words) {
    await prisma.dictionaryWord.create({
      data: {
        spanish: word.spanish,
        nasaYuwe: word.nasaYuwe,
        pronunciation: word.pronunciation,
        culturalContext: word.culturalContext,
        category: word.category,
        audioUrl: word.audioUrl,
        examples: word.examples,
        status: 'PUBLISHED',
      },
    })
  }

  console.log(`Successfully seeded ${words.length} words!`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })