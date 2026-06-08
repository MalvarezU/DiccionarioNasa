import { SEED_WORDS, SEED_USERS, Word, User } from './demo-data'

const isDemoMode = process.env.DEMO_MODE === 'true'

const globalForWords = globalThis as unknown as {
  words: Word[]
}

const globalForUsers = globalThis as unknown as {
  users: User[]
}

const globalForFavorites = globalThis as unknown as {
  favorites: any[]
  favIdCounter: number
}

const globalForHistory = globalThis as unknown as {
  history: any[]
  histIdCounter: number
}

const globalForAudit = globalThis as unknown as {
  logs: any[]
  auditIdCounter: number
}

function getWords(): Word[] {
  if (!globalForWords.words) {
    globalForWords.words = [...SEED_WORDS]
  }
  return globalForWords.words
}

function getUsers(): User[] {
  if (!globalForUsers.users) {
    globalForUsers.users = [...SEED_USERS]
  }
  return globalForUsers.users
}

function getFavorites() {
  if (!globalForFavorites.favorites) {
    globalForFavorites.favorites = []
    globalForFavorites.favIdCounter = 1
  }
  return globalForFavorites.favorites
}

function nextFavId() {
  return `fav-${globalForFavorites.favIdCounter++}`
}

function getHistory() {
  if (!globalForHistory.history) {
    globalForHistory.history = []
    globalForHistory.histIdCounter = 1
  }
  return globalForHistory.history
}

function nextHistId() {
  return `hist-${globalForHistory.histIdCounter++}`
}

function getAuditLogs() {
  if (!globalForAudit.logs) {
    globalForAudit.logs = []
    globalForAudit.auditIdCounter = 1
  }
  return globalForAudit.logs
}

function nextAuditId() {
  return `audit-${globalForAudit.auditIdCounter++}`
}

export const db = {
  dictionaryWord: {
    findMany: async (options?: {
      select?: any
      where?: any
      orderBy?: any
      skip?: number
      take?: number
    }) => {
      const words = getWords()
      let filtered = words.filter(w => w.status === 'PUBLISHED')

      if (options?.orderBy?.spanish) {
        filtered = [...filtered].sort((a, b) => a.spanish.localeCompare(b.spanish, 'es'))
      }

      const skip = options?.skip ?? 0
      const take = options?.take ?? 100

      return filtered.slice(skip, skip + take)
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      return getWords().find(w => w.id === where.id) ?? null
    },
    count: async ({ where }: { where?: { status?: string } } = {}) => {
      const words = getWords()
      if (where?.status) {
        return words.filter(w => w.status === where.status).length
      }
      return words.length
    },
  },
  user: {
    findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
      const users = getUsers()
      if (where.email) return users.find(u => u.email === where.email) ?? null
      if (where.id) return users.find(u => u.id === where.id) ?? null
      return null
    },
    findMany: async () => getUsers(),
    create: async ({ data }: { data: any }) => {
      const users = getUsers()
      const newUser: User = {
        id: `user-${Date.now()}`,
        email: data.email,
        name: data.name ?? null,
        password: data.password ?? null,
        role: data.role ?? 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      users.push(newUser)
      return newUser
    },
    update: async ({ where, data }: { where: any; data: any }) => {
      const users = getUsers()
      const idx = users.findIndex(u => u.id === where.id)
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...data }
        return users[idx]
      }
      return null
    },
    count: async () => getUsers().length,
  },
  favorite: {
    findUnique: async ({ where }: { where: { userId_wordId?: { userId: string; wordId: string }; id?: string } }) => {
      const favs = getFavorites()
      if (where.userId_wordId) {
        return favs.find(f => f.userId === where.userId_wordId!.userId && f.wordId === where.userId_wordId!.wordId) ?? null
      }
      if (where.id) {
        return favs.find(f => f.id === where.id) ?? null
      }
      return null
    },
    findMany: async ({ where, select, orderBy, take }: any = {}) => {
      let favs = getFavorites().filter(f => !where || f.userId === where.userId)
      if (orderBy?.createdAt === 'desc') {
        favs = [...favs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }
      if (select?.word) {
        const words = getWords()
        favs = favs.map(f => ({
          ...f,
          word: words.find(w => w.id === f.wordId) ?? null,
        }))
      }
      if (take) {
        favs = favs.slice(0, take)
      }
      return favs
    },
    create: async ({ data }: { data: { userId: string; wordId: string } }) => {
      const fav = {
        id: nextFavId(),
        userId: data.userId,
        wordId: data.wordId,
        createdAt: new Date().toISOString(),
      }
      getFavorites().push(fav)
      return fav
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const favs = getFavorites()
      const idx = favs.findIndex(f => f.id === where.id)
      if (idx !== -1) {
        favs.splice(idx, 1)
      }
    },
    count: async () => getFavorites().length,
  },
  viewHistory: {
    findMany: async ({ where, select, orderBy }: any = {}) => {
      let hist = getHistory().filter(h => !where || h.userId === where.userId)
      if (orderBy?.createdAt === 'desc') {
        hist = [...hist].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }
      if (select?.word) {
        const words = getWords()
        hist = hist.map(h => ({
          ...h,
          word: words.find(w => w.id === h.wordId) ?? null,
        }))
      }
      return hist
    },
    upsert: async ({ where, create, update }: any) => {
      const hist = getHistory()
      const idx = hist.findIndex(h => h.userId === where.userId_wordId.userId && h.wordId === where.userId_wordId.wordId)
      if (idx !== -1) {
        hist[idx] = { ...hist[idx], ...update }
        return hist[idx]
      }
      const entry = {
        id: nextHistId(),
        userId: create.userId,
        wordId: create.wordId,
        createdAt: new Date().toISOString(),
      }
      hist.push(entry)
      return entry
    },
    deleteMany: async ({ where }: any) => {
      const hist = getHistory()
      globalForHistory.history = hist.filter(h => h.userId !== where.userId)
    },
    count: async () => getHistory().length,
  },
  auditLog: {
    findMany: async ({ take, orderBy, select }: any = {}) => {
      let logs = [...getAuditLogs()]
      if (orderBy?.createdAt === 'desc') {
        logs.reverse()
      }
      if (take) {
        logs = logs.slice(0, take)
      }
      if (select) {
        logs = logs.map(l => {
          const result: any = {}
          select.id && (result.id = l.id)
          select.action && (result.action = l.action)
          select.entity && (result.entity = l.entity)
          select.entityId && (result.entityId = l.entityId)
          select.changes && (result.changes = l.changes)
          select.userId && (result.userId = l.userId)
          select.createdAt && (result.createdAt = l.createdAt)
          return result
        })
      }
      return logs
    },
    create: async ({ data }: any) => {
      const log = {
        id: nextAuditId(),
        ...data,
        createdAt: new Date().toISOString(),
      }
      getAuditLogs().push(log)
      return log
    },
    count: async () => getAuditLogs().length,
  },
} as any

if (process.env.NODE_ENV !== 'production') {
  ;(globalForWords as any).words = undefined
  ;(globalForUsers as any).users = undefined
  ;(globalForFavorites as any).favorites = undefined
  ;(globalForHistory as any).history = undefined
  ;(globalForAudit as any).logs = undefined
}