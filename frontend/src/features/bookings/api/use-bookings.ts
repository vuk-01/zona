import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { BookingGuest } from '@/lib/booking'

import type { BookableSpace, BookingFilters, NewBooking } from '../types'
import { InvalidBookingError, bookingsApi } from './bookings-api'

export function useBookings(filters: BookingFilters = {}) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => bookingsApi.list(filters),
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

// Every mutation refreshes all booking queries (lists and details) that start with 'bookings'.
export function useCreateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, space, guest }: { input: NewBooking; space: BookableSpace; guest: BookingGuest }) =>
      bookingsApi.create(input, space, guest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  })
}

export function useConfirmBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, space }: { id: number; space: BookableSpace }) =>
      bookingsApi.update(id, { status: 'confirmed' }, space),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  })
}

export function useCancelBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => bookingsApi.update(id, { status: 'cancelled' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  })
}

export function useDeleteBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => bookingsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  })
}
