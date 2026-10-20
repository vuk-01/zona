import { type Booking, type BookingGuest, statusNow } from '@/lib/booking'
import { NotFoundError, db, delay } from '@/lib/mock-db'

import { type BookableSpace, type BookingFilters, type NewBooking, STATUS_LABELS } from '../types'

// Ana Petrović, a guest from the shared users table. The real backend takes the guest from the session.
const MOCK_GUEST: BookingGuest = { id: 1, name: 'Ana Petrović' }

// The booking rows live in the shared mock database (src/lib/mock-db.ts), because the spaces mock
// needs them too. A row keeps its stored status; what the API returns is the status right now.
const withStatusNow = (booking: Booking): Booking => ({ ...booking, status: statusNow(booking) })

export class InvalidBookingError extends Error {}

// 409 on the real backend: the slot has no room left for another confirmed booking.
export class SlotUnavailableError extends Error {}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// 'HH:00' → hour number; minutes other than :00 are rejected, slots are whole hours.
function toHour(time: string) {
  const match = /^([01]\d|2[0-4]):00$/.exec(time)
  if (!match) throw new InvalidBookingError('Pick a whole hour, for example 10:00')
  return Number(match[1])
}

function slotHours({ date, startTime, endTime }: NewBooking, space: BookableSpace) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InvalidBookingError('Pick a date')
  const start = toHour(startTime)
  const end = toHour(endTime)
  if (start >= end) throw new InvalidBookingError('The end time must be after the start time')

  // Parsed as UTC so the weekday does not shift with the browser's time zone.
  const hours = space.openingHours[WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]]
  if (!hours) throw new InvalidBookingError(`${space.name} is closed on that day`)
  if (start < toHour(hours.open) || end > toHour(hours.close)) {
    throw new InvalidBookingError(`${space.name} is open ${hours.open}–${hours.close} on that day`)
  }
  return { start, end }
}

// The overlap rule. A whole space (meeting room, office, event hall) allows one confirmed booking at a
// time; a desk space allows as many as it has desks. The limit is checked hour by hour, so what counts
// is how many desks are taken at the busiest hour, not how many bookings touch the slot.
function assertSlotAvailable(slot: NewBooking, space: BookableSpace, ignoreId?: number) {
  const { start, end } = slotHours(slot, space)
  const limit = space.category === 'desk' ? (space.deskCount ?? 0) : 1

  const confirmed = db.bookings
    .filter(
      (b) => b.id !== ignoreId && b.spaceId === space.id && b.date === slot.date && b.status === 'confirmed',
    )
    .map((b) => ({ start: toHour(b.startTime), end: toHour(b.endTime) }))

  for (let hour = start; hour < end; hour++) {
    const taken = confirmed.filter((b) => b.start <= hour && hour < b.end).length
    if (taken >= limit) {
      const time = `${String(hour).padStart(2, '0')}:00`
      throw new SlotUnavailableError(
        space.category === 'desk' ? `No desks left at ${time}` : `This space is already booked at ${time}`,
      )
    }
  }
  return end - start
}

const matches = (booking: Booking, { spaceId, guestId, status, date }: BookingFilters) =>
  (spaceId === undefined || booking.spaceId === spaceId) &&
  (guestId === undefined || booking.guest.id === guestId) &&
  (status === undefined || booking.status === status) &&
  (date === undefined || booking.date === date)

const byDateAndTime = (a: Booking, b: Booking) =>
  a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)

export const bookingsApi = {
  list: (filters: BookingFilters = {}) =>
    delay(
      db.bookings
        .map(withStatusNow)
        .filter((b) => matches(b, filters))
        .sort(byDateAndTime),
    ),

  get: (id: number) => {
    const booking = db.bookings.find((b) => b.id === id)
    if (!booking) return Promise.reject(new NotFoundError('Booking', id))
    return delay(withStatusNow(booking))
  },

  // `space` is only needed by the mock; the real backend looks the space up by `spaceId`.
  // Pending bookings do not hold a slot, so a new booking is only refused when confirmed ones fill it.
  create: async (input: NewBooking, space: BookableSpace) => {
    await delay(undefined)
    if (input.spaceId !== space.id) throw new InvalidBookingError('The booking does not match this space')
    const hours = assertSlotAvailable(input, space)
    const booking: Booking = {
      ...input,
      id: Date.now(),
      space: { id: space.id, name: space.name, address: space.address },
      guest: MOCK_GUEST,
      totalPrice: space.pricePerHour * hours,
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    db.bookings = [...db.bookings, booking]
    return booking
  },

  // Only the status changes after a booking is made, and only while it is pending or confirmed:
  // cancelled, finished and expired are final (a pending booking whose time has passed is expired, so
  // it can no longer be confirmed). Confirming checks the overlap rule again, because other bookings
  // may have been confirmed since this one was created; it needs `space` for that.
  update: async (id: number, changes: { status: 'confirmed' | 'cancelled' }, space?: BookableSpace) => {
    const booking = await bookingsApi.get(id)
    if (booking.status === changes.status) return booking
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      throw new InvalidBookingError(`${STATUS_LABELS[booking.status]} bookings cannot be changed`)
    }
    if (changes.status === 'confirmed') {
      if (space?.id !== booking.spaceId)
        throw new InvalidBookingError('The booking does not match this space')
      assertSlotAvailable(booking, space, booking.id)
    }
    const updated: Booking = { ...booking, status: changes.status }
    db.bookings = db.bookings.map((b) => (b.id === id ? updated : b))
    return updated
  },

  // Only a pending (upcoming) booking can be deleted; a confirmed one is cancelled instead, and past
  // ones stay, so the history is kept.
  remove: async (id: number) => {
    const booking = await bookingsApi.get(id)
    if (booking.status !== 'pending') throw new InvalidBookingError('Only a pending booking can be deleted')
    db.bookings = db.bookings.filter((b) => b.id !== id)
  },
}
