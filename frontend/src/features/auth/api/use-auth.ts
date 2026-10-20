import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type User, currentUserQueryKey } from '@/lib/user'

import { authApi } from './auth-api'

// The signed-in user, or null for a visitor who is only browsing.
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: authApi.me,
  })
}

function useSetCurrentUser() {
  const queryClient = useQueryClient()
  return (user: User | null) => {
    queryClient.setQueryData(currentUserQueryKey, user)
    return queryClient.invalidateQueries({ queryKey: ['auth'] })
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

// `onLoggedOut` (leaving the page) runs before the user is cleared: on a protected page, clearing
// first would let RequireAuth send the user to /login?redirect=… right after a deliberate log out.
export function useLogout(onLoggedOut?: () => void) {
  const setCurrentUser = useSetCurrentUser()
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      onLoggedOut?.()
      return setCurrentUser(null)
    },
  })
}
