import {
  type QueryClient,
  mutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { clearToken } from '@/lib/auth-token'
import { type UserMode, currentUserQueryKey } from '@/lib/user'

import type { ProfileChanges, UserFilters } from '../types'
import { usersApi } from './users-api'

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: ({ signal }) => usersApi.list(filters, signal),
  })
}

// A missing profile (404) is not tried again: the global retry in src/app/providers.tsx skips it.
export function useUser(id: number) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: ({ signal }) => usersApi.get(id, signal),
  })
}

// A profile change refreshes both the users queries and the signed-in user, so the header and the
// guest/host navigation update right away.
function useRefreshUsers() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
    ])
}

export function useUpdateProfile() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: ProfileChanges }) => usersApi.update(id, changes),
    onSuccess: refresh,
  })
}

// The saved user goes straight into the signed-in user's cache before `onSwitched` (navigation to the
// new mode's home), so the host pages already see host mode when we get there.
export function useSwitchMode(onSwitched?: (mode: UserMode) => void | Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, mode }: { id: number; mode: UserMode }) => usersApi.update(id, { mode }),
    onSuccess: async (user) => {
      queryClient.setQueryData(currentUserQueryKey, user)
      await onSwitched?.(user.mode)
      return queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// After a DELETE the token answers 401 invalid_token, so the session ends here. Unlike useLogout
// (features/auth/api/use-auth.ts) the token goes first: it is dead, and the page `onDeleted` opens
// would otherwise load its lists with it (a 401 the session end then ignores, leaving the list in its
// error state). `onDeleted` (leaving the page) runs next, like useLogout's onLoggedOut, while the user
// is still in the cache: clearing the user first would let RequireAuth send them to
// /login?redirect=/profile. Then what is in flight for the user and the private lists is cancelled
// (an /auth/me would otherwise put the user back), the user is cleared, the private lists (favorites,
// bookings) leave the cache without a request, and the public lists load again (the user's spaces and
// profile are gone with the account). Outside the hook so use-users.test.ts can run it without React.
export const deleteAccountOptions = (queryClient: QueryClient, onDeleted?: () => void) =>
  mutationOptions({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: async () => {
      clearToken()
      onDeleted?.()
      await Promise.all(
        [currentUserQueryKey, ['favorites'], ['bookings']].map((queryKey) =>
          queryClient.cancelQueries({ queryKey }),
        ),
      )
      queryClient.setQueryData(currentUserQueryKey, null)
      queryClient.removeQueries({ queryKey: ['favorites'] })
      queryClient.removeQueries({ queryKey: ['bookings'] })
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['spaces'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ])
    },
  })

export function useDeleteAccount(onDeleted?: () => void) {
  return useMutation(deleteAccountOptions(useQueryClient(), onDeleted))
}
