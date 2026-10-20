// A booking, shared by the bookings feature (booking and confirming) and the spaces feature (free
// desks). The overlap rule itself lives in src/features/bookings/api/bookings-api.ts.

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

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
