import { type Page, api } from '@/lib/api-client'

import type { Favorite } from '../types'

// The signed-in user's favorites (docs/entities.md, Favorite); the backend takes the user from the
// token. There is no get or update: a favorite is only saved or removed, and both are idempotent.
export const favoritesApi = {
  // GET /favorites, newest first. The hearts need every saved space, so the largest page (500).
  list: async (signal?: AbortSignal) => {
    const page = await api.get<Page<Favorite>>('/favorites', { params: { size: 500 }, signal })
    return page.items
  },

  // 201 when it is new, 200 when it was already saved: both are success, so quick repeated clicks are safe
  create: (spaceId: number) => api.post<Favorite>('/favorites', { spaceId }),

  // 204, also when the space was not saved
  remove: (spaceId: number) => api.delete(`/favorites/${spaceId}`),
}
