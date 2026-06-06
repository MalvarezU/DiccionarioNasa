import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

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

function parseCSV(content: string): WordData[] {
  const lines = content.trim().split('\n')
  const words: WordData[] = []

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].replace(/^\uFEFF/, '')
    const parts = line.split(',')

    if (parts.length < 2) continue

    const nasaYuwe = parts[0]?.trim() || ''
    const spanish = parts[1]?.trim() || ''
    const tipo1 = parts[2]?.trim() || ''
    const tipo2 = parts[3]?.trim() || ''
    const tipo3 = parts[4]?.trim() || ''
    const ejemploNy = parts[5]?.trim() || ''

    if (!nasaYuwe || !spanish) continue
    if (nasaYuwe === 'Ç' || nasaYuwe === 'K' || nasaYuwe === 'Ç') continue

    let category = 'sustantivo'
    if (tipo1 === 'Verbo') category = 'verbo'
    else if (tipo1 === 'Adjetivo') category = 'adjetivo'
    else if (tipo1 === 'Adverbio') category = 'adverbio'
    else if (tipo1 === 'Pronombre') category = 'pronombre'
    else if (tipo1 === 'Expresión') category = 'expresion'
    else if (tipo1 === 'Onomatopeya') category = 'onomatopeya'
    else if (tipo1 === 'Conector') category = 'conector'
    else if (tipo1 === 'Sufijo') continue

    let culturalContext = ''
    if (tipo2) culturalContext += tipo2
    if (tipo3) culturalContext += (culturalContext ? ' - ' : '') + tipo3

    const examples: { spanish: string; nasaYuwe: string }[] = []
    if (ejemploNy) {
      examples.push({ spanish: '', nasaYuwe: ejemploNy })
    }

    words.push({
      spanish,
      nasaYuwe,
      pronunciation: nasaYuwe.toLowerCase(),
      culturalContext: culturalContext || 'Palabra de la lengua Nasa Yuwe, dialecto Wila',
      category,
      audioUrl: null,
      examples: JSON.stringify(examples),
    })
  }

  return words
}

async function main() {
  console.log('Seeding database from CSV...')

  const csvPath = path.join(__dirname, '..', '..', 'Diccionario-Nasa-Yuwe_Dialecto-Wila-_1_.csv')

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