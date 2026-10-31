import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Favorite } from '../types'
import { favoritesApi } from './favorites-api'

// null: a visitor; undefined: the session is still loading. Neither has favorites to load. The API takes
// the user from the token; the id only keeps one user's favorites apart from another's in the cache.
type MaybeUserId = number | null | undefined

const favoritesKey = (userId: MaybeUserId) => ['favorites', { userId }] as const

// Outside the component, so TanStack Query only builds a new Set when the favorites change
const toSpaceIds = (favorites: Favorite[]) => new Set(favorites.map((f) => f.spaceId))

// The ids of the spaces the user saved. Every heart reads this one query, so a click on Explore also
// shows on Home, Favorites and the space page.
export function useFavoriteIds(userId: MaybeUserId) {
  return useQuery({
    queryKey: favoritesKey(userId),
    queryFn: typeof userId === 'number' ? ({ signal }) => favoritesApi.list(signal) : skipToken,
    select: toSpaceIds,
  })
}

type SetFavoriteInput = {
  userId: number
  spaceId: number
  // The state the user wants, not a toggle: after quick repeated clicks the last click wins
  saved: boolean
}

// Saves or removes a favorite. Every heart changes at once (optimistic update) and goes back if the
// request fails; the favorites reload once the last of several quick clicks is done, so an earlier
// answer never flips a heart back for a moment.
export function useSetFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['favorites'],
    mutationFn: async ({ spaceId, saved }: SetFavoriteInput) => {
      if (saved) await favoritesApi.create(spaceId)
      else await favoritesApi.remove(spaceId)
    },
    onMutate: async ({ userId, spaceId, saved }) => {
      const queryKey = favoritesKey(userId)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Favorite[]>(queryKey)
      queryClient.setQueryData<Favorite[]>(queryKey, (favorites = []) => {
        const others = favorites.filter((f) => f.spaceId !== spaceId)
        return saved ? [{ userId, spaceId, createdAt: new Date().toISOString() }, ...others] : others
      })
      return { previous }
    },
    onError: (_error, { userId }, onMutateResult) =>
      queryClient.setQueryData(favoritesKey(userId), onMutateResult?.previous),
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['favorites'] }) > 1) return
      return queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}
