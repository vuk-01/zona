import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { User } from '../types'
import { authApi } from './auth-api'

const currentUserKey = ['auth', 'me']

// The signed-in user, or null for a visitor who is only browsing.
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserKey,
    queryFn: authApi.me,
  })
}

function useSetCurrentUser() {
  const queryClient = useQueryClient()
  return (user: User | null) => {
    queryClient.setQueryData(currentUserKey, user)
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

export function useLogout() {
  const setCurrentUser = useSetCurrentUser()
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => setCurrentUser(null),
  })
}
