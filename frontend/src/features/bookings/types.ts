export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

// Read-only summaries the backend joins in, so a booking can be shown without loading the space or user.
export type BookingSpace = {
  id: number
  name: string
  address: string
}

export type BookingGuest = {
  id: number
  name: string
}

export type Booking = {
  id: number
  spaceId: number
  space: BookingSpace
  guest: BookingGuest
  // 'YYYY-MM-DD', local time in Podgorica.
  date: string
  // 'HH:mm' on whole hours; the slot is [startTime, endTime), so 10:00–12:00 and 12:00–14:00 do not overlap.
  startTime: string
  endTime: string
  // Locked in when the booking is made: pricePerHour × hours (one desk for a desk space).
  totalPrice: number
  status: BookingStatus
  createdAt: string
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
