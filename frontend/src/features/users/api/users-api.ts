import { NotFoundError, type StoredUser, db, delay } from '@/lib/mock-db'
import type { PublicUser, User } from '@/lib/user'

import type { NewUser, ProfileChanges, UserFilters } from '../types'

export class InvalidProfileError extends Error {}

// Other people's profiles never include the email or the current mode.
const toPublicUser = ({ password: _password, email: _email, mode: _mode, ...user }: StoredUser): PublicUser =>
  user

// The user's own profile: everything except the password.
const toUser = ({ password: _password, ...user }: StoredUser): User => user

function findUser(id: number) {
  const user = db.users.find((u) => u.id === id)
  if (!user) throw new NotFoundError('User', id)
  return user
}

function normalize(changes: ProfileChanges): ProfileChanges {
  const next = { ...changes }
  if (next.name !== undefined) {
    next.name = next.name.trim()
    if (next.name.length < 2 || next.name.length > 60)
      throw new InvalidProfileError('Name must be 2–60 characters')
  }
  if (next.city !== undefined) next.city = next.city.trim()
  if (next.bio !== undefined) {
    next.bio = next.bio.trim()
    if (next.bio.length > 200) throw new InvalidProfileError('Keep your bio under 200 characters')
  }
  return next
}

const matches = (user: StoredUser, { search = '', isHost }: UserFilters) =>
  user.name.toLowerCase().includes(search.toLowerCase()) && (isHost === undefined || user.isHost === isHost)

export const usersApi = {
  list: async (filters: UserFilters = {}) => {
    await delay(undefined)
    return db.users.filter((u) => matches(u, filters)).map(toPublicUser)
  },

  get: async (id: number) => {
    await delay(undefined)
    return toPublicUser(findUser(id))
  },

  create: async ({ name, email, password }: NewUser) => {
    await delay(undefined)
    const normalizedEmail = email.trim().toLowerCase()
    if (db.users.some((u) => u.email === normalizedEmail))
      throw new InvalidProfileError('Email already in use')
    const user: StoredUser = {
      id: Date.now(),
      name: name.trim(),
      email: normalizedEmail,
      password,
      avatarUrl: null,
      city: '',
      bio: '',
      isHost: false,
      mode: 'guest',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    db.users = [...db.users, user]
    return toUser(user)
  },

  // Switching to host mode turns hosting on for good; switching back to guest keeps isHost.
  update: async (id: number, changes: ProfileChanges) => {
    await delay(undefined)
    const current = findUser(id)
    const next = { ...current, ...normalize(changes) }
    if (next.mode === 'host') next.isHost = true
    db.users = db.users.map((u) => (u.id === id ? next : u))
    return toUser(next)
  },

  remove: async (id: number) => {
    await delay(undefined)
    findUser(id)
    db.users = db.users.filter((u) => u.id !== id)
  },
}
