// The Booking entity of docs/entities.md. Only the bookings feature uses it; the spaces feature gets
// availableDesks and bookingCounts from the backend.

// The status as the backend returns it: once the slot has ended (Podgorica time), a confirmed booking
// is finished and a pending one expired; those two are never stored.
// Declined: the host said no to a pending booking.
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'finished' | 'expired'

// Read-only summaries the backend joins in, so a booking can be shown without loading the space or user.
export type BookingSpace = {
  id: number
  name: string
  address: string
  // The space's host, so a host's bookings can be listed (GET /bookings?hostId=)
  hostId: number
  // The space's first image for the booking card; null shows a placeholder
  imageUrl: string | null
}

export type BookingGuest = {
  id: number
  name: string
  // The guest's photo for the host's Reservations page; null shows their initials
  avatarUrl: string | null
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

// Active bookings still hold the space: upcoming and pending or confirmed.
export const isActive = (status: BookingStatus) => status === 'pending' || status === 'confirmed'

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  finished: 'Finished',
  expired: 'Expired',
}

// What the guest sends; the backend takes the guest from the token and fills in the rest.
export type NewBooking = Pick<Booking, 'spaceId' | 'date' | 'startTime' | 'endTime'>

// What a host or guest may change: only the status (PATCH /bookings/:id).
export type BookingStatusChange = 'confirmed' | 'declined' | 'cancelled'

export type BookingFilters = {
  spaceId?: number
  // Only the signed-in user's own id (403 not_own_bookings otherwise)
  guestId?: number
  // The bookings of every space this host has (their Reservations page); own id only
  hostId?: number
  // Matches the status as returned, so 'finished' finds past confirmed bookings
  status?: BookingStatus
  date?: string
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

// What the booking form needs to know about a space: the hours to pick from, the price and whether it
// is the user's own. A Space from the spaces feature already has this shape, so a route can pass one in
// without the two features importing each other. The backend checks the rules again on every request.
export type BookableSpace = {
  id: number
  category: 'desk' | 'meeting-room' | 'office' | 'event-hall'
  deskCount?: number
  pricePerHour: number
  openingHours: Record<Weekday, { open: string; close: string } | null>
  // A host cannot book their own space
  host: { id: number }
}

// Popular time on a space page: how booked the space usually is per hour (0–100), from 08:00 to 21:00
// (14 hourly values starting at firstHour), per weekday; null for a day it is closed.
// The whole answer is null while the space is younger than 14 days.
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
