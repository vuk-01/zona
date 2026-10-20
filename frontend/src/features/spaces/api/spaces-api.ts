import { NotFoundError, delay } from '@/lib/mock-db'

import type { NewSpace, OpeningHours, Space, SpaceFilters, SpaceHost } from '../types'

// Host accounts from the shared users table (src/lib/mock-db.ts).
// The real backend takes the host of a new space from the session; the mock uses Marko.
const MOCK_HOST: SpaceHost = { id: 2, name: 'Marko Jovanović' }
const MILICA: SpaceHost = { id: 4, name: 'Milica Vuković' }

const weekdays = (open: string, close: string, weekend: Pick<OpeningHours, 'sat' | 'sun'>): OpeningHours => ({
  mon: { open, close },
  tue: { open, close },
  wed: { open, close },
  thu: { open, close },
  fri: { open, close },
  ...weekend,
})

const photos = (seed: string) => [1, 2, 3].map((n) => `https://picsum.photos/seed/zona-${seed}-${n}/800/500`)

let spaces: Space[] = [
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
    images: photos('hub-moraca'),
    openingHours: weekdays('08:00', '20:00', { sat: { open: '10:00', close: '16:00' }, sun: null }),
    status: 'listed',
    host: MOCK_HOST,
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
    images: photos('njegoseva'),
    openingHours: weekdays('09:00', '18:00', { sat: null, sun: null }),
    status: 'listed',
    host: MOCK_HOST,
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
    images: photos('city-kvart'),
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
    images: photos('riverside'),
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
    images: photos('hercegovacka'),
    openingHours: weekdays('07:00', '22:00', { sat: { open: '09:00', close: '18:00' }, sun: null }),
    status: 'draft',
    host: MOCK_HOST,
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
    images: photos('event-loft'),
    openingHours: weekdays('10:00', '23:00', {
      sat: { open: '10:00', close: '23:00' },
      sun: { open: '12:00', close: '20:00' },
    }),
    status: 'listed',
    host: MOCK_HOST,
    createdAt: '2026-10-09',
  },
]

const matches = (space: Space, { search = '', category, city, hostId }: SpaceFilters) =>
  space.name.toLowerCase().includes(search.toLowerCase()) &&
  (!category || space.category === category) &&
  (!city || space.city.toLowerCase() === city.toLowerCase()) &&
  (hostId === undefined || space.host.id === hostId)

export class InvalidSpaceError extends Error {}

// A desk space needs a whole number of desks (at least 1); other categories never carry a desk count.
function withDeskRule(space: Space): Space {
  if (space.category !== 'desk') return { ...space, deskCount: undefined }
  if (!Number.isInteger(space.deskCount) || (space.deskCount ?? 0) < 1) {
    throw new InvalidSpaceError('A desk space needs at least one desk')
  }
  return space
}

export const spacesApi = {
  list: (filters: SpaceFilters = {}) => delay(spaces.filter((s) => matches(s, filters))),

  get: (id: number) => {
    const space = spaces.find((s) => s.id === id)
    if (!space) return Promise.reject(new NotFoundError('Space', id))
    return delay(space)
  },

  create: async (input: NewSpace) => {
    await delay(undefined)
    const space = withDeskRule({
      ...input,
      id: Date.now(),
      host: MOCK_HOST,
      createdAt: new Date().toISOString().slice(0, 10),
    })
    spaces = [space, ...spaces]
    return space
  },

  update: async (id: number, changes: Partial<NewSpace>) => {
    const current = await spacesApi.get(id)
    const updated = withDeskRule({ ...current, ...changes })
    spaces = spaces.map((s) => (s.id === id ? updated : s))
    return updated
  },

  remove: (id: number) => {
    spaces = spaces.filter((s) => s.id !== id)
    return delay(undefined)
  },
}
