import type { Booking, BookingStatus } from '@/lib/booking'

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

// What the guest sends; everything else is filled in by the backend.
export type NewBooking = Pick<Booking, 'spaceId' | 'date' | 'startTime' | 'endTime'>

export type BookingFilters = {
  spaceId?: number
  guestId?: number
  status?: BookingStatus
  date?: string
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

// What the booking rules need to know about a space. A Space from the spaces feature already has
// this shape, so a route can pass one in without the two features importing each other.
export type BookableSpace = {
  id: number
  name: string
  address: string
  category: 'desk' | 'meeting-room' | 'office' | 'event-hall'
  deskCount?: number
  pricePerHour: number
  openingHours: Record<Weekday, { open: string; close: string } | null>
  // A host cannot book their own space
  host?: { id: number }
  // Popular times need a few weeks of bookings; a newer space has "not enough data"
  createdAt?: string
}

// Popular time on a space page: how booked the space usually is per hour (0–100), from 08:00 to 21:00
// (14 hourly values starting at firstHour), per weekday; null for a day it is closed.
// The whole answer is null when there is not enough booking history yet.
export type PopularTimes = {
  firstHour: number
  days: Record<Weekday, number[] | null>
} | null

// Answer of the availability check for one slot; counts only, no one else's bookings.
export type SlotAvailability = {
  available: boolean
  // Desks free at the busiest hour of the slot; null for whole-space categories
  freeDesks: number | null
  // Why the slot is not available ("No desks left at 10:00"), or null
  message: string | null
}
