import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { NewSpace, SpaceFilters } from '../types'
import { spacesApi } from './spaces-api'

export function useSpaces(filters: SpaceFilters = {}) {
  return useQuery({
    queryKey: ['spaces', filters],
    queryFn: () => spacesApi.list(filters),
  })
}

export function useSpace(id: number) {
  return useQuery({
    queryKey: ['spaces', id],
    queryFn: () => spacesApi.get(id),
  })
}

// Every mutation refreshes all space queries (lists and details) that start with 'spaces'.
export function useCreateSpace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewSpace) => spacesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  })
}

export function useUpdateSpace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<NewSpace> }) =>
      spacesApi.update(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  })
}

export function useDeleteSpace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => spacesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  })
}
