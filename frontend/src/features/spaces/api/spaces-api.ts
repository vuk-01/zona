import { isActive, statusNow } from '@/lib/booking'
import { NotFoundError, db, delay } from '@/lib/mock-db'

import type { NewSpace, OpeningHours, Space, SpaceFilters, SpaceHost, Weekday } from '../types'

// Spaces as stored; availableDesks is computed on every read.
type StoredSpace = Omit<Space, 'availableDesks'>

// Host accounts from the shared users table (src/lib/mock-db.ts).
const MARKO: SpaceHost = { id: 2, name: 'Marko Jovanović' }
const MILICA: SpaceHost = { id: 4, name: 'Milica Vuković' }

const weekdays = (open: string, close: string, weekend: Pick<OpeningHours, 'sat' | 'sun'>): OpeningHours => ({
  mon: { open, close },
  tue: { open, close },
  wed: { open, close },
  thu: { open, close },
  fri: { open, close },
  ...weekend,
})

// Unsplash photos of real offices and halls (free to use); the first one is the cover.
const photos = (...ids: string[]) =>
  ids.map((id) => `https://images.unsplash.com/photo-${id}?w=800&h=500&fit=crop`)

let spaces: StoredSpace[] = [
  {
    id: 1,
    name: 'Hub Morača Coworking',
    description:
      'Open-plan coworking on the second floor with fast fiber, standing desks and a quiet phone booth. Coffee and filtered water are included.',
    category: 'desk',
    city: 'Podgorica',
    address: 'Bulevar Svetog Petra Cetinjskog 9',
    pricePerHour: 3,
    capacity: 24,
    deskCount: 24,
    images: photos('1527192491265-7e15c55b1ed2', '1604328698692-f76ea9498e76', '1556761175-5973dc0f32e7'),
    openingHours: weekdays('08:00', '20:00', { sat: { open: '10:00', close: '16:00' }, sun: null }),
    status: 'listed',
    host: MARKO,
    createdAt: '2026-09-18',
  },
  {
    id: 2,
    name: 'Njegoševa Studio Desks',
    description:
      'Two desks by the window in a bright studio above the pedestrian street, two minutes from Republic Square. Quiet, so it fills up fast.',
    category: 'desk',
    city: 'Podgorica',
    address: 'Njegoševa 24',
    pricePerHour: 4,
    capacity: 2,
    deskCount: 2,
    images: photos('1497215842964-222b430dc094', '1497032628192-86f99bcd76bc', '1524758631624-e2822e304c36'),
    openingHours: weekdays('09:00', '18:00', { sat: null, sun: null }),
    status: 'listed',
    host: MARKO,
    createdAt: '2026-09-25',
  },
  {
    id: 3,
    name: 'Glass Room at City Kvart',
    description:
      'A glass-walled meeting room with a 65-inch screen, a whiteboard wall and video-call camera. Parking in the building garage.',
    category: 'meeting-room',
    city: 'Podgorica',
    address: 'Bulevar Džordža Vašingtona 98',
    pricePerHour: 18,
    capacity: 8,
    images: photos('1462826303086-329426d1aef5', '1497366811353-6870744d04b2'),
    openingHours: weekdays('08:00', '21:00', { sat: { open: '09:00', close: '15:00' }, sun: null }),
    status: 'listed',
    host: MILICA,
    createdAt: '2026-10-01',
  },
  {
    id: 4,
    name: 'Riverside Boardroom',
    description:
      'A boardroom with a long oak table and a view of the Morača river. Projector, conference phone and catering on request.',
    category: 'meeting-room',
    city: 'Podgorica',
    address: 'Ulica Vaka Đurovića 5',
    pricePerHour: 30,
    capacity: 14,
    images: photos('1431540015161-0bf868a2d407', '1517502884422-41eaead166d4', '1521737604893-d14cc237f11d'),
    openingHours: weekdays('08:00', '20:00', { sat: null, sun: null }),
    status: 'listed',
    host: MILICA,
    createdAt: '2026-10-04',
  },
  {
    id: 5,
    name: 'Hercegovačka Private Office',
    description:
      'A lockable office for a team of up to four, with ergonomic chairs, a printer and a small kitchen shared with one other office.',
    category: 'office',
    city: 'Podgorica',
    address: 'Hercegovačka 30',
    pricePerHour: 12,
    capacity: 4,
    images: photos('1600508774634-4e11d34730e2', '1568992687947-868a62a9f521', '1497366216548-37526070297c'),
    openingHours: weekdays('07:00', '22:00', { sat: { open: '09:00', close: '18:00' }, sun: null }),
    status: 'draft',
    host: MARKO,
    createdAt: '2026-10-14',
  },
  {
    id: 6,
    name: 'Preko Morače Event Loft',
    description:
      'An industrial loft for workshops, launches and private parties. Sound system, stage lighting and 120 chairs included; bar service can be booked.',
    category: 'event-hall',
    city: 'Podgorica',
    address: 'Bulevar Ivana Crnojevića 64',
    pricePerHour: 85,
    capacity: 120,
    images: photos('1505373877841-8d25f7d46678', '1540575467063-178a50c2df87', '1511578314322-379afb476865'),
    openingHours: weekdays('10:00', '23:00', {
      sat: { open: '10:00', close: '23:00' },
      sun: { open: '12:00', close: '20:00' },
    }),
    status: 'listed',
    host: MARKO,
    createdAt: '2026-10-09',
  },
]

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const hourOf = (time: string) => Number(time.slice(0, 2))

// Free desks right now: deskCount minus confirmed bookings (shared table in src/lib/mock-db.ts) that
// cover the current hour. The real backend does this in the GET /spaces query.
function availableDesks(space: StoredSpace, now = new Date()) {
  if (space.category !== 'desk') return null
  const hours = space.openingHours[WEEKDAYS[now.getDay()]]
  const hour = now.getHours()
  if (!hours || hour < hourOf(hours.open) || hour >= hourOf(hours.close)) return null

  const date = new Intl.DateTimeFormat('en-CA').format(now)
  const taken = db.bookings.filter(
    (b) =>
      b.spaceId === space.id &&
      b.date === date &&
      b.status === 'confirmed' &&
      hourOf(b.startTime) <= hour &&
      hour < hourOf(b.endTime),
  ).length
  return Math.max((space.deskCount ?? 0) - taken, 0)
}

const withAvailability = (space: StoredSpace): Space => ({ ...space, availableDesks: availableDesks(space) })

// search matches the name or the city ("glass", "podgorica").
const matchesSearch = (space: StoredSpace, search: string) => {
  const term = search.trim().toLowerCase()
  return space.name.toLowerCase().includes(term) || space.city.toLowerCase().includes(term)
}

const matches = (
  space: StoredSpace,
  { search = '', category, city, hostId, status, minPrice, maxPrice }: SpaceFilters,
) =>
  matchesSearch(space, search) &&
  (minPrice === undefined || space.pricePerHour >= minPrice) &&
  (maxPrice === undefined || space.pricePerHour <= maxPrice) &&
  (!category || space.category === category) &&
  (!city || space.city.toLowerCase() === city.toLowerCase()) &&
  (hostId === undefined || space.host.id === hostId) &&
  (status === undefined || space.status === status)

export class InvalidSpaceError extends Error {}

// A desk space needs a whole number of desks (at least 1); other categories never carry a desk count.
function withDeskRule(space: StoredSpace): StoredSpace {
  if (space.category !== 'desk') return { ...space, deskCount: undefined }
  if (!Number.isInteger(space.deskCount) || (space.deskCount ?? 0) < 1) {
    throw new InvalidSpaceError('A desk space needs at least one desk')
  }
  return space
}

function findSpace(id: number) {
  const space = spaces.find((s) => s.id === id)
  if (!space) throw new NotFoundError('Space', id)
  return space
}

// 409 on the real backend: a space with active bookings cannot be deleted.
export class SpaceHasActiveBookingsError extends Error {
  readonly activeBookings: number

  constructor(activeBookings: number) {
    super(`This space has ${activeBookings} active ${activeBookings === 1 ? 'booking' : 'bookings'}`)
    this.activeBookings = activeBookings
  }
}

// Counted from the shared booking rows (src/lib/mock-db.ts), with the status right now.
function bookingCounts(spaceId: number) {
  const statuses = db.bookings.filter((b) => b.spaceId === spaceId).map((b) => statusNow(b))
  return {
    active: statuses.filter(isActive).length,
    pending: statuses.filter((status) => status === 'pending').length,
  }
}

export const spacesApi = {
  // The host's own listing (hostId) also gets bookingCounts, like GET /spaces?hostId= on the backend.
  list: async (filters: SpaceFilters = {}) => {
    await delay(undefined)
    const found = spaces.filter((s) => matches(s, filters)).map(withAvailability)
    return filters.hostId === undefined
      ? found
      : found.map((s) => ({ ...s, bookingCounts: bookingCounts(s.id) }))
  },

  get: async (id: number) => {
    await delay(undefined)
    return withAvailability(findSpace(id))
  },

  // `host` is only needed by the mock; the real backend takes the host from the session.
  create: async (input: NewSpace, host: SpaceHost) => {
    await delay(undefined)
    const space = withDeskRule({
      ...input,
      id: Date.now(),
      host: { id: host.id, name: host.name },
      createdAt: new Date().toISOString().slice(0, 10),
    })
    spaces = [space, ...spaces]
    return withAvailability(space)
  },

  update: async (id: number, changes: Partial<NewSpace>) => {
    await delay(undefined)
    const updated = withDeskRule({ ...findSpace(id), ...changes })
    spaces = spaces.map((s) => (s.id === id ? updated : s))
    return withAvailability(updated)
  },

  remove: async (id: number) => {
    await delay(undefined)
    findSpace(id)
    const { active } = bookingCounts(id)
    if (active > 0) throw new SpaceHasActiveBookingsError(active)
    spaces = spaces.filter((s) => s.id !== id)
  },
}
