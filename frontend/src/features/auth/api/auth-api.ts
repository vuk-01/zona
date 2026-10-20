import { type StoredUser, db, delay } from '@/lib/mock-db'
import type { User } from '@/lib/user'

import type { LoginInput, SignupInput } from '../types'

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

const toUser = ({ password: _password, ...user }: StoredUser): User => user

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
    const user = db.users.find((u) => u.id === readSession())
    return user ? toUser(user) : null
  },

  login: async ({ email, password }: LoginInput) => {
    await delay(undefined)
    const user = db.users.find((u) => u.email === normalizeEmail(email) && u.password === password)
    if (!user) throw new InvalidCredentialsError()
    writeSession(user.id)
    return toUser(user)
  },

  signup: async ({ name, email, password }: SignupInput) => {
    await delay(undefined)
    if (db.users.some((u) => u.email === normalizeEmail(email))) throw new EmailTakenError()
    const user: StoredUser = {
      id: Date.now(),
      name: name.trim(),
      email: normalizeEmail(email),
      password,
      avatarUrl: null,
      city: '',
      bio: '',
      isHost: false,
      mode: 'guest',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    db.users = [...db.users, user]
    writeSession(user.id)
    return toUser(user)
  },

  logout: async () => {
    await delay(undefined)
    writeSession(null)
  },
}
