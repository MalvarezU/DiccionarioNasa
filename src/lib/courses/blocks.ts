/**
 * Contrato del contenido de una lección.
 *
 * Una lección es un documento: `{ version, blocks[] }`. Cada bloque es una
 * pieza tipada (texto, imagen, audio, video, palabra, vocabulario, quiz,
 * escucha, juego).
 *
 * Este archivo es la ÚNICA fuente de verdad: lo usan el editor del admin, la
 * API que guarda y el render del estudiante. Si el tipo y la validación viven
 * en un solo lugar, el editor no puede guardar algo que el render no entienda.
 *
 * La validación es a mano (sin zod) siguiendo el estilo del proyecto, y es
 * deliberadamente estricta: el contenido lo escribe un editor y lo renderiza
 * el navegador de cualquier visitante, así que es una superficie de seguridad
 * real. En particular `isSafeMediaUrl` corta `javascript:` y `data:`.
 */

export const LESSON_CONTENT_VERSION = 1

/** Límites. Acotados a propósito: el documento entra en un JSONB. */
export const LIMITS = {
  maxBlocks: 100,
  maxMarkdown: 20_000,
  maxQuestions: 50,
  minOptions: 2,
  maxOptions: 6,
  maxPrompt: 2_000,
  maxOptionText: 500,
  maxExplanation: 2_000,
  maxWordIds: 60,
  maxTitle: 200,
  maxAlt: 300,
  maxCaption: 300,
  maxId: 64,
} as const

export const BLOCK_TYPES = [
  "text",
  "image",
  "audio",
  "video",
  "word",
  "vocabulary",
  "quiz",
  "listening",
  "game",
  "legacy-quiz-words",
  "legacy-complete-word",
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export type MediaSource = "upload" | "youtube"
export type GameKind = "memory" | "flashcards"
export type GameDifficulty = "easy" | "medium" | "hard"

/** Fuente de audio o video. Si es `youtube`, manda `youtubeId`. */
export type MediaRef = {
  source: MediaSource
  /** Solo cuando `source === "upload"`. */
  url?: string
  /** Solo cuando `source === "youtube"`. */
  youtubeId?: string
}

export type QuizOption = { text: string; correct: boolean }
export type QuizQuestion = {
  prompt: string
  options: QuizOption[]
  explanation?: string
}

export type TextBlock = { id: string; type: "text"; markdown: string }
export type ImageBlock = {
  id: string
  type: "image"
  url: string
  alt: string
  caption?: string
}
export type AudioBlock = {
  id: string
  type: "audio"
  media: MediaRef
  title?: string
}
export type VideoBlock = {
  id: string
  type: "video"
  youtubeId: string
  title: string
}
export type WordBlock = { id: string; type: "word"; wordId: string }
export type VocabularyBlock = {
  id: string
  type: "vocabulary"
  wordIds: string[]
}
export type QuizBlock = {
  id: string
  type: "quiz"
  questions: QuizQuestion[]
  /** Porcentaje (0-100) para aprobar el bloque. */
  passScore: number
}
export type ListeningBlock = {
  id: string
  type: "listening"
  media: MediaRef
  question: string
  options: QuizOption[]
}
export type GameBlock = {
  id: string
  type: "game"
  game: GameKind
  wordIds: string[]
  difficulty: GameDifficulty
}

/**
 * Bloques legacy: solo los produce el backfill, para que las lecciones que ya
 * existían se comporten EXACTAMENTE igual que antes. La limpieza posterior los
 * migra a los tipos nuevos.
 */
export type LegacyQuizWordsBlock = {
  id: string
  type: "legacy-quiz-words"
  words: string[]
}
export type LegacyCompleteWordBlock = {
  id: string
  type: "legacy-complete-word"
  wordId: string
}

export type LessonBlock =
  | TextBlock
  | ImageBlock
  | AudioBlock
  | VideoBlock
  | WordBlock
  | VocabularyBlock
  | QuizBlock
  | ListeningBlock
  | GameBlock
  | LegacyQuizWordsBlock
  | LegacyCompleteWordBlock

export type LessonContent = { version: number; blocks: LessonBlock[] }

export type ParseResult =
  | { ok: true; content: LessonContent }
  | { ok: false; errors: string[] }

/** Bloques que exigen que el estudiante interactúe para completar la lección. */
export function isInteractive(block: LessonBlock): boolean {
  return (
    block.type === "quiz" ||
    block.type === "listening" ||
    block.type === "game" ||
    block.type === "legacy-quiz-words" ||
    block.type === "legacy-complete-word"
  )
}

export function emptyContent(): LessonContent {
  return { version: LESSON_CONTENT_VERSION, blocks: [] }
}

const ID_RE = /^[A-Za-z0-9_-]+$/
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/

/**
 * Solo https absoluto o ruta relativa que empieza con un único "/".
 * Corta `javascript:`, `data:`, `vbscript:`, `file:` y `//host` (protocolo
 * relativo, que redirigiría a otro origen).
 */
export function isSafeMediaUrl(value: string): boolean {
  if (value.startsWith("//")) return false
  if (value.startsWith("/")) return !/\s/.test(value)
  return value.startsWith("https://") && !/\s/.test(value)
}

// ---------------------------------------------------------------- helpers ---

function fail(errors: string[], path: string, message: string): void {
  errors.push(`${path}: ${message}`)
}

function readString(
  value: unknown,
  path: string,
  max: number,
  errors: string[],
  { required = true } = {}
): string | undefined {
  if (value === undefined || value === null) {
    if (required) fail(errors, path, "es obligatorio")
    return undefined
  }
  if (typeof value !== "string") {
    fail(errors, path, "tiene que ser texto")
    return undefined
  }
  const trimmed = value.trim()
  if (required && trimmed.length === 0) {
    fail(errors, path, "no puede estar vacío")
    return undefined
  }
  if (trimmed.length > max) {
    fail(errors, path, `supera el máximo de ${max} caracteres`)
    return undefined
  }
  return trimmed
}

function readId(value: unknown, path: string, errors: string[]): string | undefined {
  const raw = readString(value, path, LIMITS.maxId, errors)
  if (raw === undefined) return undefined
  if (!ID_RE.test(raw)) {
    fail(errors, path, "solo admite letras, números, guion y guion bajo")
    return undefined
  }
  return raw
}

function readStringArray(
  value: unknown,
  path: string,
  max: number,
  errors: string[]
): string[] | undefined {
  if (!Array.isArray(value)) {
    fail(errors, path, "tiene que ser una lista")
    return undefined
  }
  if (value.length === 0) {
    fail(errors, path, "no puede estar vacía")
    return undefined
  }
  if (value.length > max) {
    fail(errors, path, `supera el máximo de ${max} elementos`)
    return undefined
  }
  const out: string[] = []
  value.forEach((item, i) => {
    const id = readId(item, `${path}[${i}]`, errors)
    if (id !== undefined) out.push(id)
  })
  // Un duplicado casi siempre es un error del editor, no una intención.
  if (new Set(out).size !== out.length) {
    fail(errors, path, "tiene elementos repetidos")
  }
  return out
}

function readMediaRef(
  value: unknown,
  path: string,
  errors: string[]
): MediaRef | undefined {
  if (typeof value !== "object" || value === null) {
    fail(errors, path, "tiene que ser un objeto de medio")
    return undefined
  }
  const v = value as Record<string, unknown>
  const source = v.source
  if (source !== "upload" && source !== "youtube") {
    fail(errors, `${path}.source`, 'tiene que ser "upload" o "youtube"')
    return undefined
  }
  if (source === "youtube") {
    const yt = readString(v.youtubeId, `${path}.youtubeId`, 32, errors)
    if (yt !== undefined && !YOUTUBE_ID_RE.test(yt)) {
      fail(errors, `${path}.youtubeId`, "no es un ID de YouTube válido")
      return undefined
    }
    if (yt === undefined) return undefined
    return { source, youtubeId: yt }
  }
  const url = readString(v.url, `${path}.url`, 2_000, errors)
  if (url === undefined) return undefined
  if (!isSafeMediaUrl(url)) {
    fail(errors, `${path}.url`, "tiene que ser https:// o una ruta que empiece con /")
    return undefined
  }
  return { source, url }
}

function readOptions(
  value: unknown,
  path: string,
  errors: string[]
): QuizOption[] | undefined {
  if (!Array.isArray(value)) {
    fail(errors, path, "tiene que ser una lista de opciones")
    return undefined
  }
  if (value.length < LIMITS.minOptions || value.length > LIMITS.maxOptions) {
    fail(
      errors,
      path,
      `tiene que tener entre ${LIMITS.minOptions} y ${LIMITS.maxOptions} opciones`
    )
    return undefined
  }
  const out: QuizOption[] = []
  value.forEach((item, i) => {
    if (typeof item !== "object" || item === null) {
      fail(errors, `${path}[${i}]`, "tiene que ser un objeto")
      return
    }
    const o = item as Record<string, unknown>
    const text = readString(o.text, `${path}[${i}].text`, LIMITS.maxOptionText, errors)
    if (typeof o.correct !== "boolean") {
      fail(errors, `${path}[${i}].correct`, "tiene que ser true o false")
      return
    }
    if (text !== undefined) out.push({ text, correct: o.correct })
  })
  // Exactamente una correcta: con cero el ejercicio no se puede aprobar, con
  // dos o más la respuesta deja de ser única.
  const correctas = out.filter((o) => o.correct).length
  if (out.length === value.length && correctas !== 1) {
    fail(errors, path, `tiene que haber exactamente una opción correcta (hay ${correctas})`)
  }
  return out
}

function readQuestions(
  value: unknown,
  path: string,
  errors: string[]
): QuizQuestion[] | undefined {
  if (!Array.isArray(value)) {
    fail(errors, path, "tiene que ser una lista de preguntas")
    return undefined
  }
  if (value.length === 0) {
    fail(errors, path, "no puede estar vacía")
    return undefined
  }
  if (value.length > LIMITS.maxQuestions) {
    fail(errors, path, `supera el máximo de ${LIMITS.maxQuestions} preguntas`)
    return undefined
  }
  const out: QuizQuestion[] = []
  value.forEach((item, i) => {
    if (typeof item !== "object" || item === null) {
      fail(errors, `${path}[${i}]`, "tiene que ser un objeto")
      return
    }
    const q = item as Record<string, unknown>
    const prompt = readString(q.prompt, `${path}[${i}].prompt`, LIMITS.maxPrompt, errors)
    const options = readOptions(q.options, `${path}[${i}].options`, errors)
    const explanation = readString(
      q.explanation,
      `${path}[${i}].explanation`,
      LIMITS.maxExplanation,
      errors,
      { required: false }
    )
    if (prompt === undefined || options === undefined) return
    out.push(explanation === undefined ? { prompt, options } : { prompt, options, explanation })
  })
  return out
}

function readGameKind(
  value: unknown,
  path: string,
  errors: string[]
): GameKind | undefined {
  if (value !== "memory" && value !== "flashcards") {
    fail(errors, path, 'tiene que ser "memory" o "flashcards"')
    return undefined
  }
  return value
}

function readDifficulty(
  value: unknown,
  path: string,
  errors: string[]
): GameDifficulty | undefined {
  if (value === undefined) return "medium"
  if (value !== "easy" && value !== "medium" && value !== "hard") {
    fail(errors, path, 'tiene que ser "easy", "medium" o "hard"')
    return undefined
  }
  return value
}

// ---------------------------------------------------------------- validador ---

type BlockResult = { ok: true; block: LessonBlock } | { ok: false; errors: string[] }

function parseBlock(value: unknown, index: number): BlockResult {
  const path = `blocks[${index}]`
  const errors: string[] = []

  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: [`${path}: tiene que ser un objeto`] }
  }
  const raw = value as Record<string, unknown>
  const id = readId(raw.id, `${path}.id`, errors)
  const type = raw.type
  if (typeof type !== "string" || !(BLOCK_TYPES as readonly string[]).includes(type)) {
    fail(errors, `${path}.type`, `tipo de bloque desconocido: ${String(type)}`)
    return { ok: false, errors }
  }
  if (id === undefined) return { ok: false, errors }

  // Cada rama ARMA el bloque; ninguna retorna. La salida única de abajo es la
  // que decide. Antes cada `case` retornaba por su cuenta y varios se olvidaban
  // de revisar `errors`, así que un error de un helper (p. ej. opciones
  // repetidas) se descartaba y el bloque inválido se guardaba igual.
  let block: LessonBlock | undefined

  switch (type as BlockType) {
    case "text": {
      const markdown = readString(raw.markdown, `${path}.markdown`, LIMITS.maxMarkdown, errors)
      if (markdown !== undefined) block = { id, type: "text", markdown }
      break
    }
    case "image": {
      const url = readString(raw.url, `${path}.url`, 2_000, errors)
      const alt = readString(raw.alt, `${path}.alt`, LIMITS.maxAlt, errors)
      const caption = readString(raw.caption, `${path}.caption`, LIMITS.maxCaption, errors, {
        required: false,
      })
      if (url !== undefined && !isSafeMediaUrl(url)) {
        fail(errors, `${path}.url`, "tiene que ser https:// o una ruta que empiece con /")
      }
      if (url !== undefined && alt !== undefined) {
        block =
          caption === undefined
            ? { id, type: "image", url, alt }
            : { id, type: "image", url, alt, caption }
      }
      break
    }
    case "audio": {
      const media = readMediaRef(raw.media, `${path}.media`, errors)
      const title = readString(raw.title, `${path}.title`, LIMITS.maxTitle, errors, {
        required: false,
      })
      if (media !== undefined) {
        block = title === undefined ? { id, type: "audio", media } : { id, type: "audio", media, title }
      }
      break
    }
    case "video": {
      const youtubeId = readString(raw.youtubeId, `${path}.youtubeId`, 32, errors)
      const title = readString(raw.title, `${path}.title`, LIMITS.maxTitle, errors)
      if (youtubeId !== undefined && !YOUTUBE_ID_RE.test(youtubeId)) {
        fail(errors, `${path}.youtubeId`, "no es un ID de YouTube válido")
      }
      if (youtubeId !== undefined && title !== undefined) {
        block = { id, type: "video", youtubeId, title }
      }
      break
    }
    case "word": {
      const wordId = readId(raw.wordId, `${path}.wordId`, errors)
      if (wordId !== undefined) block = { id, type: "word", wordId }
      break
    }
    case "vocabulary": {
      const wordIds = readStringArray(raw.wordIds, `${path}.wordIds`, LIMITS.maxWordIds, errors)
      if (wordIds !== undefined) block = { id, type: "vocabulary", wordIds }
      break
    }
    case "quiz": {
      const questions = readQuestions(raw.questions, `${path}.questions`, errors)
      const passScoreRaw = raw.passScore
      let passScore = 70
      if (passScoreRaw !== undefined) {
        if (
          typeof passScoreRaw !== "number" ||
          !Number.isInteger(passScoreRaw) ||
          passScoreRaw < 0 ||
          passScoreRaw > 100
        ) {
          fail(errors, `${path}.passScore`, "tiene que ser un entero entre 0 y 100")
        } else {
          passScore = passScoreRaw
        }
      }
      if (questions !== undefined) block = { id, type: "quiz", questions, passScore }
      break
    }
    case "listening": {
      const media = readMediaRef(raw.media, `${path}.media`, errors)
      const question = readString(raw.question, `${path}.question`, LIMITS.maxPrompt, errors)
      const options = readOptions(raw.options, `${path}.options`, errors)
      if (media !== undefined && question !== undefined && options !== undefined) {
        block = { id, type: "listening", media, question, options }
      }
      break
    }
    case "game": {
      const game = readGameKind(raw.game, `${path}.game`, errors)
      const wordIds = readStringArray(raw.wordIds, `${path}.wordIds`, LIMITS.maxWordIds, errors)
      const difficulty = readDifficulty(raw.difficulty, `${path}.difficulty`, errors)
      if (game !== undefined && wordIds !== undefined && difficulty !== undefined) {
        block = { id, type: "game", game, wordIds, difficulty }
      }
      break
    }
    case "legacy-quiz-words": {
      if (!Array.isArray(raw.words) || raw.words.some((w) => typeof w !== "string")) {
        fail(errors, `${path}.words`, "tiene que ser una lista de textos")
      } else {
        block = { id, type: "legacy-quiz-words", words: raw.words as string[] }
      }
      break
    }
    case "legacy-complete-word": {
      const wordId = readId(raw.wordId, `${path}.wordId`, errors)
      if (wordId !== undefined) block = { id, type: "legacy-complete-word", wordId }
      break
    }
  }

  // Salida única: si CUALQUIER helper dejó un error, el bloque no entra,
  // aunque se haya podido armar.
  if (errors.length > 0) return { ok: false, errors }
  if (block === undefined) {
    return { ok: false, errors: [`${path}: bloque "${type}" incompleto`] }
  }
  return { ok: true, block }
}

/**
 * Valida un documento de contenido. Devuelve el documento normalizado (con
 * espacios recortados y `passScore` por defecto) o la lista de errores.
 */
export function parseLessonContent(input: unknown): ParseResult {
  const errors: string[] = []

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["content: tiene que ser un objeto"] }
  }
  const raw = input as Record<string, unknown>

  if (raw.version !== undefined && raw.version !== LESSON_CONTENT_VERSION) {
    errors.push(`content.version: versión no soportada (${String(raw.version)})`)
  }
  if (!Array.isArray(raw.blocks)) {
    return { ok: false, errors: [...errors, "content.blocks: tiene que ser una lista"] }
  }
  if (raw.blocks.length > LIMITS.maxBlocks) {
    errors.push(`content.blocks: supera el máximo de ${LIMITS.maxBlocks} bloques`)
  }

  const blocks: LessonBlock[] = []
  const seenIds = new Set<string>()
  raw.blocks.slice(0, LIMITS.maxBlocks).forEach((item, i) => {
    const res = parseBlock(item, i)
    if (!res.ok) {
      errors.push(...res.errors)
      return
    }
    if (seenIds.has(res.block.id)) {
      errors.push(`blocks[${i}].id: id de bloque repetido (${res.block.id})`)
      return
    }
    seenIds.add(res.block.id)
    blocks.push(res.block)
  })

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, content: { version: LESSON_CONTENT_VERSION, blocks } }
}

/** Genera un id de bloque. El editor lo usa al agregar un bloque. */
export function newBlockId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/** Bloque nuevo con valores por defecto, para el editor. */
export function createBlock(type: BlockType): LessonBlock {
  const id = newBlockId()
  switch (type) {
    case "text":
      return { id, type, markdown: "" }
    case "image":
      return { id, type, url: "", alt: "" }
    case "audio":
      return { id, type, media: { source: "upload" } }
    case "video":
      return { id, type, youtubeId: "", title: "" }
    case "word":
      return { id, type, wordId: "" }
    case "vocabulary":
      return { id, type, wordIds: [] }
    case "quiz":
      return {
        id,
        type,
        passScore: 70,
        questions: [{ prompt: "", options: [{ text: "", correct: true }, { text: "", correct: false }] }],
      }
    case "listening":
      return {
        id,
        type,
        media: { source: "upload" },
        question: "",
        options: [{ text: "", correct: true }, { text: "", correct: false }],
      }
    case "game":
      return { id, type, game: "flashcards", wordIds: [], difficulty: "medium" }
    case "legacy-quiz-words":
      return { id, type, words: [] }
    case "legacy-complete-word":
      return { id, type, wordId: "" }
  }
}
