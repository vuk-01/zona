// A booking, shared by the bookings feature (booking and confirming) and the spaces feature (free
// desks, and a space with active bookings cannot be deleted). The overlap rule itself lives in
// src/features/bookings/api/bookings-api.ts.

// Stored rows only hold pending, confirmed, declined or cancelled. Finished and expired are what a
// booking becomes once its time has passed; they are worked out on read (see statusNow), never stored.
// Declined: the host said no to a pending booking.
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'finished' | 'expired'

// Read-only summaries the backend joins in, so a booking can be shown without loading the space or user.
export type BookingSpace = {
  id: number
  name: string
  address: string
  // The space's host, so a host's bookings can be listed (GET /bookings?hostId=)
  hostId: number
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

// When the slot ends, in local time. setHours also handles an end time of 24:00 (next midnight).
function endsAt({ date, endTime }: Pick<Booking, 'date' | 'endTime'>) {
  const end = new Date(`${date}T00:00:00`)
  end.setHours(Number(endTime.slice(0, 2)))
  return end
}

// The status right now: once the slot has ended, a confirmed booking is finished and a pending one
// (never confirmed by the host) is expired. Declined and cancelled stay as they are.
export function statusNow(booking: Pick<Booking, 'date' | 'endTime' | 'status'>, now = new Date()) {
  if (endsAt(booking) > now) return booking.status
  if (booking.status === 'confirmed') return 'finished'
  if (booking.status === 'pending') return 'expired'
  return booking.status
}

// Active bookings still hold the space: upcoming and pending or confirmed.
export const isActive = (status: BookingStatus) => status === 'pending' || status === 'confirmed'
