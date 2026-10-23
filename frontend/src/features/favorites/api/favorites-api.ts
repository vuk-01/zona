import type { Favorite } from '@/lib/favorite'
import { db, delay } from '@/lib/mock-db'

const newestFirst = (a: Favorite, b: Favorite) => b.createdAt.localeCompare(a.createdAt)

const isPair = (favorite: Favorite, userId: number, spaceId: number) =>
  favorite.userId === userId && favorite.spaceId === spaceId

// The rows live in src/lib/mock-db.ts, because the spaces mock reads them for GET /spaces?favoriteOf=.
// The mock takes the user's id; the backend takes it from the session. There is no get or update: a
// favorite is only saved or removed.
export const favoritesApi = {
  // GET /favorites: the signed-in user's favorites, newest first
  list: async (userId: number) => {
    await delay(undefined)
    return db.favorites.filter((f) => f.userId === userId).toSorted(newestFirst)
  },

  // POST /favorites { spaceId }. Saving a space twice changes nothing, so quick repeated clicks are safe.
  create: async (userId: number, spaceId: number) => {
    await delay(undefined)
    const saved = db.favorites.find((f) => isPair(f, userId, spaceId))
    if (saved) return saved
    const favorite: Favorite = { userId, spaceId, createdAt: new Date().toISOString() }
    db.favorites = [...db.favorites, favorite]
    return favorite
  },

  // DELETE /favorites/:spaceId, also fine when the space was not saved
  remove: async (userId: number, spaceId: number) => {
    await delay(undefined)
    db.favorites = db.favorites.filter((f) => !isPair(f, userId, spaceId))
  },
}
