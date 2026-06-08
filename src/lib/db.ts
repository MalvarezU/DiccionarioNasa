import { SEED_WORDS, SEED_USERS, Word, User } from './demo-data'

const isDemoMode = process.env.DEMO_MODE === 'true'

const globalForWords = globalThis as unknown as {
  words: Word[]
}

const globalForUsers = globalThis as unknown as {
  users: User[]
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
  },
} as any

if (process.env.NODE_ENV !== 'production') {
  ;(globalForWords as any).words = undefined
  ;(globalForUsers as any).users = undefined
}