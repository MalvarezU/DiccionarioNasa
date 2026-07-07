import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

interface WordData {
  spanish: string
  nasaYuwe: string
  pronunciation: string
  culturalContext: string
  category: string
  audioUrl: string | null
  examples: string
}

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

  const hashedPassword = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: { email, password: hashedPassword, name, role: 'admin' },
  })
  console.log('✓ Admin user created: admin@nasayuwe.com / AdminNasa2024!')
}

function parseCSV(content: string): WordData[] {
  const lines = content.trim().split('\n')
  const words: WordData[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/^\uFEFF/, '')
    const parts = line.split(',')

    if (parts.length < 2) continue

    const nasaYuwe = parts[0]?.trim() || ''
    const spanish = parts[1]?.trim() || ''
    const category = parts[2]?.trim() || 'sustantivo'
    const pronunciation = parts[3]?.trim() || nasaYuwe.toLowerCase()
    const culturalContext = parts[4]?.trim() || ''
    const examples = parts[5]?.trim() || '[]'

    if (!nasaYuwe || !spanish) continue

    words.push({
      spanish,
      nasaYuwe,
      pronunciation,
      culturalContext: culturalContext || 'Palabra de la lengua Nasa Yuwe, dialecto Wila',
      category,
      audioUrl: null,
      examples,
    })
  }

  return words
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
  const words = parseCSV(csvContent)

  console.log(`Parsed ${words.length} words from CSV`)

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