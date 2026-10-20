import { NotFoundError, delay } from '@/lib/mock-db'

import type {
  BookableSpace,
  Booking,
  BookingFilters,
  BookingGuest,
  BookingStatus,
  NewBooking,
} from '../types'

// Ana Petrović, a guest from the shared users table (src/lib/mock-db.ts). The real backend takes the guest from the session.
const MOCK_GUEST: BookingGuest = { id: 1, name: 'Ana Petrović' }
const ANA = MOCK_GUEST
const JELENA: BookingGuest = { id: 3, name: 'Jelena Nikolić' }

const HUB = { id: 1, name: 'Hub Morača Coworking', address: 'Bulevar Svetog Petra Cetinjskog 9' }
const STUDIO = { id: 2, name: 'Njegoševa Studio Desks', address: 'Njegoševa 24' }
const GLASS = { id: 3, name: 'Glass Room at City Kvart', address: 'Bulevar Džordža Vašingtona 98' }
const RIVERSIDE = { id: 4, name: 'Riverside Boardroom', address: 'Ulica Vaka Đurovića 5' }
const LOFT = { id: 6, name: 'Preko Morače Event Loft', address: 'Bulevar Ivana Crnojevića 64' }

// Njegoševa has 2 desks, so 10:00–12:00 on 22 Oct is full. Booking 5 overlaps the confirmed booking 4
// in the Glass Room, so confirming it is refused.
let bookings: Booking[] = [
  {
    id: 1,
    spaceId: HUB.id,
    space: HUB,
    guest: ANA,
    date: '2026-10-21',
    startTime: '09:00',
    endTime: '13:00',
    totalPrice: 12,
    status: 'confirmed',
    createdAt: '2026-10-15',
  },
  {
    id: 2,
    spaceId: STUDIO.id,
    space: STUDIO,
    guest: ANA,
    date: '2026-10-22',
    startTime: '10:00',
    endTime: '13:00',
    totalPrice: 12,
    status: 'confirmed',
    createdAt: '2026-10-16',
  },
  {
    id: 3,
    spaceId: STUDIO.id,
    space: STUDIO,
    guest: JELENA,
    date: '2026-10-22',
    startTime: '09:00',
    endTime: '12:00',
    totalPrice: 12,
    status: 'confirmed',
    createdAt: '2026-10-17',
  },
  {
    id: 4,
    spaceId: GLASS.id,
    space: GLASS,
    guest: ANA,
    date: '2026-10-23',
    startTime: '14:00',
    endTime: '16:00',
    totalPrice: 36,
    status: 'confirmed',
    createdAt: '2026-10-18',
  },
  {
    id: 5,
    spaceId: GLASS.id,
    space: GLASS,
    guest: JELENA,
    date: '2026-10-23',
    startTime: '15:00',
    endTime: '17:00',
    totalPrice: 36,
    status: 'pending',
    createdAt: '2026-10-19',
  },
  {
    id: 6,
    spaceId: RIVERSIDE.id,
    space: RIVERSIDE,
    guest: JELENA,
    date: '2026-10-27',
    startTime: '09:00',
    endTime: '12:00',
    totalPrice: 90,
    status: 'pending',
    createdAt: '2026-10-19',
  },
  {
    id: 7,
    spaceId: LOFT.id,
    space: LOFT,
    guest: ANA,
    date: '2026-10-24',
    startTime: '18:00',
    endTime: '23:00',
    totalPrice: 425,
    status: 'confirmed',
    createdAt: '2026-10-10',
  },
  {
    id: 8,
    spaceId: LOFT.id,
    space: LOFT,
    guest: JELENA,
    date: '2026-10-30',
    startTime: '17:00',
    endTime: '21:00',
    totalPrice: 340,
    status: 'cancelled',
    createdAt: '2026-10-12',
  },
  {
    id: 9,
    spaceId: HUB.id,
    space: HUB,
    guest: JELENA,
    date: '2026-10-26',
    startTime: '13:00',
    endTime: '18:00',
    totalPrice: 15,
    status: 'pending',
    createdAt: '2026-10-20',
  },
  {
    id: 10,
    spaceId: RIVERSIDE.id,
    space: RIVERSIDE,
    guest: ANA,
    date: '2026-10-21',
    startTime: '16:00',
    endTime: '18:00',
    totalPrice: 60,
    status: 'cancelled',
    createdAt: '2026-10-14',
  },
]

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

  const confirmed = bookings
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
    delay(bookings.filter((b) => matches(b, filters)).sort(byDateAndTime)),

  get: (id: number) => {
    const booking = bookings.find((b) => b.id === id)
    if (!booking) return Promise.reject(new NotFoundError('Booking', id))
    return delay(booking)
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
    bookings = [...bookings, booking]
    return booking
  },

  // Only the status changes after a booking is made. Confirming checks the overlap rule again, because
  // other bookings may have been confirmed since this one was created; it needs `space` for that.
  update: async (id: number, changes: { status: BookingStatus }, space?: BookableSpace) => {
    const booking = await bookingsApi.get(id)
    if (booking.status === changes.status) return booking
    if (booking.status === 'cancelled') throw new InvalidBookingError('A cancelled booking cannot be changed')
    if (changes.status === 'confirmed') {
      if (space?.id !== booking.spaceId)
        throw new InvalidBookingError('The booking does not match this space')
      assertSlotAvailable(booking, space, booking.id)
    }
    const updated: Booking = { ...booking, status: changes.status }
    bookings = bookings.map((b) => (b.id === id ? updated : b))
    return updated
  },

  // Only a pending booking can be deleted; a confirmed one is cancelled instead, so the history stays.
  remove: async (id: number) => {
    const booking = await bookingsApi.get(id)
    if (booking.status !== 'pending') throw new InvalidBookingError('Only a pending booking can be deleted')
    bookings = bookings.filter((b) => b.id !== id)
  },
}
