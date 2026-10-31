import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { NewSpace, SpaceFilters } from '../types'
import { type Pagination, spacesApi } from './spaces-api'

// One page of spaces (the backend's default is 50); `pagination` is part of the key, so a list of 50
// and a list of 500 with the same filters are two queries.
export function useSpaces(filters: SpaceFilters = {}, pagination: Pagination = {}) {
  return useQuery({
    queryKey: ['spaces', filters, pagination],
    queryFn: ({ signal }) => spacesApi.list(filters, pagination, signal),
  })
}

// A missing space (404, or 422 for an id like "abc") is not retried: the global retry in
// src/app/providers.tsx only tries failures that can go away on their own.
export function useSpace(id: number) {
  return useQuery({
    queryKey: ['spaces', id],
    queryFn: ({ signal }) => spacesApi.get(id, signal),
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
