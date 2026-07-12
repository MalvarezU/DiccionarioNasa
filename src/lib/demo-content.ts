/**
 * Datos hardcodeados para los mockups de Juegos Didácticos y Ruta de Aprendizaje.
 * No provienen de la base de datos — son solo para demostración visual.
 * Palabras tomadas del corpus real (prisma/seed-data.csv).
 */

// ─── Palabras para juegos (10 comunes, cortas y visuales) ──────────────────

export interface DemoWord {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string
  category: string
}

export const DEMO_WORDS: DemoWord[] = [
  { id: "w1", spanish: "Casa", nasaYuwe: "Yat", pronunciation: "yat", category: "sustantivo" },
  { id: "w2", spanish: "Agua", nasaYuwe: "Yu'", pronunciation: "yu'", category: "sustantivo" },
  { id: "w3", spanish: "Sol", nasaYuwe: "Ate", pronunciation: "ate", category: "sustantivo" },
  { id: "w4", spanish: "Perro", nasaYuwe: "Alku", pronunciation: "alku", category: "sustantivo" },
  { id: "w5", spanish: "Luna", nasaYuwe: "A'te", pronunciation: "a'te", category: "sustantivo" },
  { id: "w6", spanish: "Humo", nasaYuwe: "Ah", pronunciation: "ah", category: "sustantivo" },
  { id: "w7", spanish: "Rojo", nasaYuwe: "Beh", pronunciation: "beh", category: "color" },
  { id: "w8", spanish: "Lobo", nasaYuwe: "Alum", pronunciation: "alum", category: "sustantivo" },
  { id: "w9", spanish: "Fuego", nasaYuwe: "Tek", pronunciation: "tek", category: "sustantivo" },
  { id: "w10", spanish: "Gallina", nasaYuwe: "Atalx", pronunciation: "atalx", category: "sustantivo" },
]

// ─── Ruta de Aprendizaje (1 curso demo navegable) ──────────────────────────

export interface DemoLesson {
  id: string
  title: string
  type: "ficha" | "quiz"
  description: string
  content: {
    words?: DemoWord[]
    questions?: {
      question: string
      options: string[]
      correctIndex: number
    }[]
  }
}

export interface DemoModule {
  id: string
  title: string
  description: string
  lessons: DemoLesson[]
}

export interface DemoCourse {
  id: string
  title: string
  description: string
  level: "Básico" | "Intermedio" | "Avanzado"
  estimatedMinutes: number
  modules: DemoModule[]
}

export const DEMO_COURSES: DemoCourse[] = [
  {
    id: "curso-basico",
    title: "Nasa Yuwe Básico",
    description:
      "Aprende las palabras esenciales del Nasa Yuwe: saludos, animales y colores. Un primer paso para conectar con la lengua del pueblo Nasa.",
    level: "Básico",
    estimatedMinutes: 20,
    modules: [
      {
        id: "m1",
        title: "Módulo 1: Saludos y Presentaciones",
        description: "Palabras básicas para empezar a comunicarte",
        lessons: [
          {
            id: "l1-1",
            title: "Lección 1.1: Palabras básicas",
            type: "ficha",
            description: "Conoce las primeras palabras del Nasa Yuwe",
            content: {
              words: [
                DEMO_WORDS[0],
                DEMO_WORDS[1],
                DEMO_WORDS[2],
              ],
            },
          },
          {
            id: "l1-2",
            title: "Lección 1.2: Quiz de palabras básicas",
            type: "quiz",
            description: "Pon a prueba lo que aprendiste",
            content: {
              questions: [
                {
                  question: "¿Cómo se dice 'Casa' en Nasa Yuwe?",
                  options: ["Yat", "Ate", "Alku", "Beh"],
                  correctIndex: 0,
                },
                {
                  question: "¿Cómo se dice 'Agua' en Nasa Yuwe?",
                  options: ["Tek", "Yu'", "Ah", "Atalx"],
                  correctIndex: 1,
                },
              ],
            },
          },
        ],
      },
      {
        id: "m2",
        title: "Módulo 2: Animales",
        description: "Aprende los nombres de animales comunes",
        lessons: [
          {
            id: "l2-1",
            title: "Lección 2.1: Animales comunes",
            type: "ficha",
            description: "Descubre cómo se llaman los animales en Nasa Yuwe",
            content: {
              words: [
                DEMO_WORDS[3],
                DEMO_WORDS[7],
                DEMO_WORDS[9],
              ],
            },
          },
          {
            id: "l2-2",
            title: "Lección 2.2: Quiz de animales",
            type: "quiz",
            description: "¿Reconoces los animales en Nasa Yuwe?",
            content: {
              questions: [
                {
                  question: "¿Cómo se dice 'Perro' en Nasa Yuwe?",
                  options: ["Atalx", "Alku", "Alum", "Ate"],
                  correctIndex: 1,
                },
                {
                  question: "¿Cómo se dice 'Gallina' en Nasa Yuwe?",
                  options: ["Atalx", "Beh", "Yu'", "Tek"],
                  correctIndex: 0,
                },
              ],
            },
          },
        ],
      },
      {
        id: "m3",
        title: "Módulo 3: Colores y elementos",
        description: "Aprende colores y elementos de la naturaleza",
        lessons: [
          {
            id: "l3-1",
            title: "Lección 3.1: Colores y elementos",
            type: "ficha",
            description: "Explora los colores y elementos naturales",
            content: {
              words: [
                DEMO_WORDS[6],
                DEMO_WORDS[5],
                DEMO_WORDS[8],
              ],
            },
          },
          {
            id: "l3-2",
            title: "Lección 3.2: Quiz final",
            type: "quiz",
            description: "El reto final del curso básico",
            content: {
              questions: [
                {
                  question: "¿Cómo se dice 'Rojo' en Nasa Yuwe?",
                  options: ["Beh", "Yat", "Ah", "Alku"],
                  correctIndex: 0,
                },
                {
                  question: "¿Cómo se dice 'Fuego' en Nasa Yuwe?",
                  options: ["Ate", "Tek", "Yu'", "Alum"],
                  correctIndex: 1,
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "curso-intermedio",
    title: "Nasa Yuwe Intermedio",
    description:
      "Amplía tu vocabulario con frases cotidianas, verbos y expresiones culturales.",
    level: "Intermedio",
    estimatedMinutes: 35,
    modules: [],
  },
  {
    id: "curso-cultura",
    title: "Cultura y Tradición",
    description:
      "Conoce el contexto cultural, la cosmovisión y las prácticas tradicionales del pueblo Nasa.",
    level: "Avanzado",
    estimatedMinutes: 45,
    modules: [],
  },
]