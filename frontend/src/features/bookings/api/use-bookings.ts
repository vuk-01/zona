import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { BookingGuest } from '@/lib/booking'

import type { BookableSpace, BookingFilters, NewBooking } from '../types'
import { InvalidBookingError, bookingsApi } from './bookings-api'

// `enabled: false` waits for the filters, e.g. until the signed-in user is known
export function useBookings(filters: BookingFilters = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => bookingsApi.list(filters),
    enabled,
  })
}

export function useBooking(id: number) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsApi.get(id),
  })
}

// Free or not, and free desks, for the slot being picked. Bookings mutations refresh it too (same prefix).
export function useSlotAvailability(slot: NewBooking | null, space: BookableSpace) {
  return useQuery({
    queryKey: ['bookings', 'availability', slot],
    queryFn: () => (slot ? bookingsApi.availability(slot, space) : Promise.reject(new Error('No slot'))),
    enabled: slot !== null,
    // A slot outside opening hours stays invalid; only retry other errors
    retry: (failureCount, error) => !(error instanceof InvalidBookingError) && failureCount < 3,
  })
}

// Popular time for a space page; one request holds the whole week, so switching days does not refetch.
export function usePopularTimes(space: BookableSpace) {
  return useQuery({
    queryKey: ['bookings', 'popular-times', space.id],
    queryFn: () => bookingsApi.popularTimes(space),
  })
}

// Every mutation refreshes all booking queries (lists and details) that start with 'bookings', and the
// spaces too: their free desks and the booking counts on My spaces ("1 booking · 1 pending") are worked
// out from bookings. Only the cache key is shared; the bookings feature does not import spaces.
const refreshAfterChange = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['bookings'] }),
    queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  ])

export function useCreateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, space, guest }: { input: NewBooking; space: BookableSpace; guest: BookingGuest }) =>
      bookingsApi.create(input, space, guest),
    onSuccess: () => refreshAfterChange(queryClient),
  })
}

// The host approves a pending booking
export function useConfirmBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, space }: { id: number; space: BookableSpace }) =>
      bookingsApi.update(id, { status: 'confirmed' }, space),
    onSuccess: () => refreshAfterChange(queryClient),
  })
}

// The host says no to a pending booking
export function useDeclineBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => bookingsApi.update(id, { status: 'declined' }),
    onSuccess: () => refreshAfterChange(queryClient),
  })
}

export function useCancelBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => bookingsApi.update(id, { status: 'cancelled' }),
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
