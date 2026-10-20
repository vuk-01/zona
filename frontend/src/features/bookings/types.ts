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

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

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
}
