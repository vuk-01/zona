import { type Booking, type BookingGuest, statusNow } from '@/lib/booking'
import { NotFoundError, db, delay } from '@/lib/mock-db'

import {
  type BookableSpace,
  type BookingFilters,
  type NewBooking,
  type PopularTimes,
  type SlotAvailability,
  type Weekday,
  STATUS_LABELS,
} from '../types'

// The booking rows live in the shared mock database (src/lib/mock-db.ts), because the spaces mock
// needs them too. A row keeps its stored status; what the API returns is the status right now.
const withStatusNow = (booking: Booking): Booking => ({ ...booking, status: statusNow(booking) })

export class InvalidBookingError extends Error {}

// 409 on the real backend: the slot has no room left for another confirmed booking.
export class SlotUnavailableError extends Error {}

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// 'HH:00' → hour number; minutes other than :00 are rejected, slots are whole hours.
function toHour(time: string) {
  const match = /^([01]\d|2[0-4]):00$/.exec(time)
  if (!match) throw new InvalidBookingError('Pick a whole hour, for example 10:00')
  return Number(match[1])
}

// Today in the browser's time zone, 'YYYY-MM-DD'.
const localToday = () => new Intl.DateTimeFormat('en-CA').format(new Date())

function slotHours({ date, startTime, endTime }: NewBooking, space: BookableSpace) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InvalidBookingError('Pick a date')
  if (date < localToday()) throw new InvalidBookingError('Pick today or a later date')
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
function slotUsage(slot: NewBooking, space: BookableSpace, ignoreId?: number) {
  const { start, end } = slotHours(slot, space)
  const limit = space.category === 'desk' ? (space.deskCount ?? 0) : 1

  const confirmed = db.bookings
    .filter(
      (b) => b.id !== ignoreId && b.spaceId === space.id && b.date === slot.date && b.status === 'confirmed',
    )
    .map((b) => ({ start: toHour(b.startTime), end: toHour(b.endTime) }))

  let free = limit
  let fullAt: number | null = null
  for (let hour = start; hour < end; hour++) {
    const left = limit - confirmed.filter((b) => b.start <= hour && hour < b.end).length
    free = Math.min(free, left)
    if (left <= 0 && fullAt === null) fullAt = hour
  }
  return { hours: end - start, free: Math.max(free, 0), fullAt }
}

function fullMessage(space: BookableSpace, hour: number) {
  const time = `${String(hour).padStart(2, '0')}:00`
  return space.category === 'desk' ? `No desks left at ${time}` : `This space is already booked at ${time}`
}

function assertSlotAvailable(slot: NewBooking, space: BookableSpace, ignoreId?: number) {
  const { hours, fullAt } = slotUsage(slot, space, ignoreId)
  if (fullAt !== null) throw new SlotUnavailableError(fullMessage(space, fullAt))
  return hours
}

// Popular time. The real backend averages the last 8 weeks of bookings per weekday and hour; the mock
// draws the same kind of curve per category (desks: morning and after lunch, meeting rooms: late
// morning and mid-afternoon, offices: the working day, event halls: evenings and weekends).
const POPULAR_FIRST_HOUR = 8
const POPULAR_HOURS = 14 // 08:00 … 21:00
const MIN_HISTORY_DAYS = 14

const peak = (hour: number, center: number, width: number) =>
  Math.exp(-((hour - center) ** 2) / (2 * width ** 2))

const CURVES: Record<BookableSpace['category'], (hour: number) => number> = {
  desk: (h) => Math.max(0.9 * peak(h, 11, 2), 0.8 * peak(h, 15.5, 2)),
  'meeting-room': (h) => Math.max(0.9 * peak(h, 10.5, 1.5), 0.85 * peak(h, 15, 1.5)),
  office: (h) => 0.85 * peak(h, 13, 3.5),
  'event-hall': (h) => Math.max(0.95 * peak(h, 20, 1.8), 0.35 * peak(h, 14, 2)),
}

const DAY_FACTORS: Record<BookableSpace['category'], number[]> = {
  // sun, mon, tue, wed, thu, fri, sat
  desk: [0.2, 0.95, 1, 1, 0.95, 0.8, 0.4],
  'meeting-room': [0.1, 0.9, 1, 0.95, 1, 0.7, 0.25],
  office: [0.1, 1, 1, 1, 1, 0.9, 0.3],
  'event-hall': [0.7, 0.3, 0.3, 0.45, 0.6, 1, 1],
}

// Same numbers on every load, a little different per space and hour
const jitter = (...seed: number[]) => {
  const x = Math.sin(seed.reduce((sum, n, i) => sum + n * (i + 1) * 12.9898, 0)) * 43758.5453
  return x - Math.floor(x)
}

function popularTimes(space: BookableSpace): NonNullable<PopularTimes> | null {
  const ageDays = space.createdAt ? (Date.now() - Date.parse(space.createdAt)) / 86_400_000 : Infinity
  if (ageDays < MIN_HISTORY_DAYS) return null

  const days = Object.fromEntries(
    WEEKDAYS.map((day, dayIndex) => {
      const hours = space.openingHours[day]
      if (!hours) return [day, null]
      const values = Array.from({ length: POPULAR_HOURS }, (_, i) => {
        const hour = POPULAR_FIRST_HOUR + i
        if (hour < toHour(hours.open) || hour >= toHour(hours.close)) return 0
        const value = CURVES[space.category](hour + 0.5) * DAY_FACTORS[space.category][dayIndex]
        return Math.min(100, Math.round(100 * value * (0.85 + 0.3 * jitter(space.id, dayIndex, hour))))
      })
      return [day, values]
    }),
  ) as Record<Weekday, number[] | null>

  return { firstHour: POPULAR_FIRST_HOUR, days }
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

  // Counts only, never other people's bookings: is the slot free, and how many desks are left at its
  // busiest hour. GET /bookings/availability?spaceId=&date=&startTime=&endTime= on the real backend.
  availability: async (slot: NewBooking, space: BookableSpace): Promise<SlotAvailability> => {
    await delay(undefined)
    const { free, fullAt } = slotUsage(slot, space)
    return {
      available: fullAt === null,
      freeDesks: space.category === 'desk' ? free : null,
      message: fullAt === null ? null : fullMessage(space, fullAt),
    }
  },

  // Aggregated percentages only, never individual bookings. GET /bookings/popular-times?spaceId=
  popularTimes: async (space: BookableSpace): Promise<PopularTimes> => {
    await delay(undefined)
    return popularTimes(space)
  },

  // `space` and `guest` are only needed by the mock; the real backend looks the space up by `spaceId`
  // and takes the guest from the session.
  // Pending bookings do not hold a slot, so a new booking is only refused when confirmed ones fill it.
  create: async (input: NewBooking, space: BookableSpace, guest: BookingGuest) => {
    await delay(undefined)
    if (input.spaceId !== space.id) throw new InvalidBookingError('The booking does not match this space')
    if (space.host?.id === guest.id) throw new InvalidBookingError('You cannot book your own space')
    const hours = assertSlotAvailable(input, space)
    const booking: Booking = {
      ...input,
      id: Date.now(),
      space: { id: space.id, name: space.name, address: space.address },
      guest: { id: guest.id, name: guest.name },
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
