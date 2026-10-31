import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type User, currentUserQueryKey } from '@/lib/user'

import { authApi } from './auth-api'

// The signed-in user, or null for a visitor who is only browsing.
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: ({ signal }) => authApi.me(signal),
  })
}

// The lists depend on the token too (the user's own drafts, bookingCounts, favorites, bookings), so
// they load again for the new session, not only the signed-in user. Logging out has its own order.
function useSetCurrentUser() {
  const queryClient = useQueryClient()
  return (user: User) => {
    queryClient.setQueryData(currentUserQueryKey, user)
    return Promise.all(
      [['auth'], ['spaces'], ['favorites'], ['bookings']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    )
  }
}

export function useLogin() {
  const setCurrentUser = useSetCurrentUser()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => setCurrentUser(user),
  })
}

export function useSignup() {
  const setCurrentUser = useSetCurrentUser()
  return useMutation({
    mutationFn: authApi.signup,
    onSuccess: (user) => setCurrentUser(user),
  })
}

// The order matters, and nothing may load without the token in between:
// 1. `onLoggedOut` (leaving the page) runs before the user is cleared: on a protected page, clearing
//    first would let RequireAuth send the user to /login?redirect=… right after a deliberate log out.
//    What mounts there (the hearts on Home) still sends the token.
// 2. The user is cleared, and the private lists (favorites, bookings) leave the cache without a
//    request: the next render has no user, so their queries change key and stop (skipToken, enabled).
//    Invalidating them would refetch them first, without a token: a 401 not_authenticated.
// 3. Only then the token goes, and the spaces load again without it (no own drafts, no bookingCounts).
export function useLogout(onLoggedOut?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    // The backend has no logout route; the session ends in onSuccess, in the order above
    mutationFn: async () => undefined,
    onSuccess: () => {
      onLoggedOut?.()
      queryClient.setQueryData(currentUserQueryKey, null)
      queryClient.removeQueries({ queryKey: ['favorites'] })
      queryClient.removeQueries({ queryKey: ['bookings'] })
      authApi.logout()
      return queryClient.invalidateQueries({ queryKey: ['spaces'] })
    },
  })
}
