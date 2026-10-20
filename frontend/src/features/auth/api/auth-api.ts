import { delay } from '@/lib/mock-db'

import type { LoginInput, SignupInput, User } from '../types'

// The mock keeps passwords next to users; the real backend stores only a hash.
type StoredUser = User & { password: string }

let users: StoredUser[] = [
  {
    id: 1,
    name: 'Ana Petrović',
    email: 'ana@zona.app',
    password: 'zona1234',
    isHost: false,
    createdAt: '2026-09-02',
  },
  {
    id: 2,
    name: 'Marko Jovanović',
    email: 'marko@zona.app',
    password: 'zona1234',
    isHost: true,
    createdAt: '2026-08-14',
  },
  {
    id: 3,
    name: 'Jelena Nikolić',
    email: 'jelena@zona.app',
    password: 'zona1234',
    isHost: false,
    createdAt: '2026-10-05',
  },
]

// Only the signed-in user id is kept in the browser, so a reload keeps the session.
// Storage can be blocked (private mode), so the mock then simply forgets the session.
const SESSION_KEY = 'zona.session'

function readSession() {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value === null ? null : Number(value)
  } catch {
    return null
  }
}

function writeSession(userId: number | null) {
  try {
    if (userId === null) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, String(userId))
  } catch {
    // Session only lives in memory for this tab.
  }
}

const toUser = (user: StoredUser): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  isHost: user.isHost,
  createdAt: user.createdAt,
})

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Wrong email or password')
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super('Email already in use')
  }
}

export const authApi = {
  me: async (): Promise<User | null> => {
    await delay(undefined)
    const user = users.find((u) => u.id === readSession())
    return user ? toUser(user) : null
  },

  login: async ({ email, password }: LoginInput) => {
    await delay(undefined)
    const user = users.find((u) => u.email === normalizeEmail(email) && u.password === password)
    if (!user) throw new InvalidCredentialsError()
    writeSession(user.id)
    return toUser(user)
  },

  signup: async ({ name, email, password }: SignupInput) => {
    await delay(undefined)
    if (users.some((u) => u.email === normalizeEmail(email))) throw new EmailTakenError()
    const user: StoredUser = {
      id: Date.now(),
      name: name.trim(),
      email: normalizeEmail(email),
      password,
      isHost: false,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    users = [...users, user]
    writeSession(user.id)
    return toUser(user)
  },

  logout: async () => {
    await delay(undefined)
    writeSession(null)
  },
}
