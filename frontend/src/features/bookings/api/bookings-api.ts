import { type Page, api } from '@/lib/api-client'

import type {
  Booking,
  BookingFilters,
  BookingStatusChange,
  NewBooking,
  PopularTimes,
  SlotAvailability,
} from '../types'

export type Pagination = {
  page?: number
  size?: number
}

// The routes of docs/entities.md (Booking). Every route but availability and popular times needs a
// token. The backend applies the slot and overlap rules, takes the guest from the token and returns the
// status as it is now (finished, expired). Errors are ApiError: invalid_slot, booking_in_past,
// booking_too_far_ahead and validation_error carry fieldErrors (date, startTime, endTime); slot_full,
// cannot_book_own_space and invalid_status_change only a detail.
export const bookingsApi = {
  // Earliest first (date, start time, id); only bookings where the user is the guest or the host.
  list: (filters: BookingFilters = {}, { page, size }: Pagination = {}, signal?: AbortSignal) =>
    api.get<Page<Booking>>('/bookings', { params: { ...filters, page, size }, signal }),

  get: (id: number, signal?: AbortSignal) => api.get<Booking>(`/bookings/${id}`, { signal }),

  // Counts only, never other people's bookings: is the slot free, and how many desks are left at its
  // busiest hour. The same answer a confirm of that slot would give now.
  availability: ({ spaceId, date, startTime, endTime }: NewBooking, signal?: AbortSignal) =>
    api.get<SlotAvailability>('/bookings/availability', {
      params: { spaceId, date, startTime, endTime },
      signal,
    }),

  // Aggregated percentages only; null (200) while the space is younger than 14 days.
  popularTimes: (spaceId: number, signal?: AbortSignal) =>
    api.get<PopularTimes>('/bookings/popular-times', { params: { spaceId }, signal }),

  // Always pending; a pending booking takes no room, so it can still be refused on confirm (slot_full).
  create: (input: NewBooking) => api.post<Booking>('/bookings', input),

  // The host confirms or declines a pending booking; guest and host can cancel. A change to the status
  // the booking already has is 422 invalid_status_change, not a no-op.
  update: (id: number, status: BookingStatusChange) => api.patch<Booking>(`/bookings/${id}`, { status }),

  // The guest, only while pending; a confirmed booking is cancelled instead.
  remove: (id: number) => api.delete(`/bookings/${id}`),
}
