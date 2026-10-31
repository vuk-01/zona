import { type QueryClient, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { BookingFilters, NewBooking } from '../types'
import { type Pagination, bookingsApi } from './bookings-api'

// One page of bookings (the backend's default is 50); `pagination` is part of the key.
// `enabled: false` waits for the filters, e.g. until the signed-in user is known.
export function useBookings(
  filters: BookingFilters = {},
  pagination: Pagination = {},
  { enabled = true } = {},
) {
  return useQuery({
    queryKey: ['bookings', filters, pagination],
    queryFn: ({ signal }) => bookingsApi.list(filters, pagination, signal),
    enabled,
  })
}

export function useBooking(id: number) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: ({ signal }) => bookingsApi.get(id, signal),
  })
}

// Free or not, and free desks, for the slot being picked. Bookings mutations refresh it too (same
// prefix). A slot the backend refuses (422) is not retried: the global retry skips a 4xx.
export function useSlotAvailability(slot: NewBooking | null) {
  return useQuery({
    queryKey: ['bookings', 'availability', slot],
    queryFn: slot ? ({ signal }) => bookingsApi.availability(slot, signal) : skipToken,
  })
}

// Popular time for a space page; one request holds the whole week, so switching days does not refetch.
export function usePopularTimes(spaceId: number) {
  return useQuery({
    queryKey: ['bookings', 'popular-times', spaceId],
    queryFn: ({ signal }) => bookingsApi.popularTimes(spaceId, signal),
  })
}

// Every mutation refreshes all booking queries (lists and details) that start with 'bookings', and the
// spaces too: their free desks and the booking counts on My spaces ("1 booking · 1 pending") come from
// bookings. Only the cache key is shared; the bookings feature does not import spaces.
const refreshAfterChange = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['bookings'] }),
    queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  ])

export function useCreateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewBooking) => bookingsApi.create(input),
    onSuccess: () => refreshAfterChange(queryClient),
  })
}

// The host approves a pending booking; the backend checks the overlap rule again (409 slot_full)
export function useConfirmBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => bookingsApi.update(id, 'confirmed'),
    onSuccess: () => refreshAfterChange(queryClient),
  })
}

// The host says no to a pending booking
export function useDeclineBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => bookingsApi.update(id, 'declined'),
    onSuccess: () => refreshAfterChange(queryClient),
  })
}

export function useCancelBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => bookingsApi.update(id, 'cancelled'),
    onSuccess: () => refreshAfterChange(queryClient),
  })
}

export function useDeleteBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => bookingsApi.remove(id),
    onSuccess: () => refreshAfterChange(queryClient),
  })
}
