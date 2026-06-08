export interface Word {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string | null
  examples: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  email: string
  name: string | null
  password: string | null
  role: string
  createdAt: Date
  updatedAt: Date
}

export const SEED_USERS: User[] = [
  {
    id: 'user-1',
    email: 'admin@nasayuwe.com',
    name: 'Administrador',
    password: '$2a$10$K5QXJ9hZ5v6rH5kQ7Y3rXe',
    role: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'user-2',
    email: 'juan@example.com',
    name: 'Juan Pérez',
    password: '$2a$10$Xj3K8mN5pQ9sL2wE4vR6Yu',
    role: 'user',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 'user-3',
    email: 'maria@example.com',
    name: 'María González',
    password: '$2a$10$Zm4nP6oR7tU8wX9yZ2aB5c',
    role: 'user',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
]

export const SEED_WORDS: Word[] = [
  { id: 'word-1', spanish: 'Luna', nasaYuwe: "A'te", pronunciation: "a'te", audioUrl: null, culturalContext: 'Constelación', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-2', spanish: 'Perro', nasaYuwe: 'Alku', pronunciation: 'alku', audioUrl: null, culturalContext: 'Animal - Mamífero doméstico', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-3', spanish: 'Sol', nasaYuwe: 'Sek', pronunciation: 'sek', audioUrl: null, culturalContext: 'Constelación', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-4', spanish: 'Agua', nasaYuwe: "Yu'", pronunciation: "yu'", audioUrl: null, culturalContext: 'Recurso', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-5', spanish: 'Tierra', nasaYuwe: 'Txiwe', pronunciation: 'txiwe', audioUrl: null, culturalContext: 'Palabra de la lengua Nasa Yuwe, dialecto Wila', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-6', spanish: 'Casa', nasaYuwe: 'Yat', pronunciation: 'yat', audioUrl: null, culturalContext: 'Construcción', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-7', spanish: 'Madre', nasaYuwe: 'Mama', pronunciation: 'mama', audioUrl: null, culturalContext: 'Familia', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-8', spanish: 'Padre', nasaYuwe: 'Tata', pronunciation: 'tata', audioUrl: null, culturalContext: 'Familia', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-9', spanish: 'Rojo', nasaYuwe: 'Beh', pronunciation: 'beh', audioUrl: null, culturalContext: 'Color', category: 'sustantivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-10', spanish: 'Verde', nasaYuwe: 'Çenx', pronunciation: 'çenx', audioUrl: null, culturalContext: 'Color', category: 'adjetivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-11', spanish: 'Blanco', nasaYuwe: 'Çxihme', pronunciation: 'çxihme', audioUrl: null, culturalContext: 'Color', category: 'adjetivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
  { id: 'word-12', spanish: 'Amarillo', nasaYuwe: 'Çxkiiy', pronunciation: 'çxkiiy', audioUrl: null, culturalContext: 'Color', category: 'adjetivo', examples: '[]', status: 'PUBLISHED', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
]