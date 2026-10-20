import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { NotFoundError } from '@/lib/mock-db'
import { type UserMode, currentUserQueryKey } from '@/lib/user'

import type { ProfileChanges, UserFilters } from '../types'
import { usersApi } from './users-api'

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => usersApi.list(filters),
  })
}

export function useUser(id: number) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.get(id),
    // A missing profile stays missing; only retry other errors (the default is 3 tries).
    retry: (failureCount, error) => !(error instanceof NotFoundError) && failureCount < 3,
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

export function useDeleteAccount() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: refresh,
  })
}
