// In-memory mock "database" shared by all features. Next workshop this file goes away,
// and the functions in src/features/<name>/api/ start calling the real backend.

import type { Booking, BookingGuest } from './booking'
import type { Favorite } from './favorite'
import type { User } from './user'

const DELAY_MS = 400

export const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), DELAY_MS))

export class NotFoundError extends Error {
  constructor(resource: string, id: number) {
    super(`${resource} with id ${id} does not exist`)
  }
}

// The mock keeps passwords next to users; the real backend stores only a hash.
export type StoredUser = User & { password: string }

const avatar = (n: number) => `https://i.pravatar.cc/300?img=${n}`

const users: StoredUser[] = [
  {
    id: 1,
    name: 'Ana Petrović',
    email: 'ana@zona.app',
    password: 'zona1234',
    avatarUrl: avatar(47),
    city: 'Podgorica',
    bio: 'Freelance UX designer. I book a desk near the river a few mornings a week.',
    isHost: false,
    mode: 'guest',
    createdAt: '2026-09-02',
  },
  {
    id: 2,
    name: 'Marko Jovanović',
    email: 'marko@zona.app',
    password: 'zona1234',
    avatarUrl: avatar(12),
    city: 'Podgorica',
    bio: 'I run two coworking floors and an event loft in Podgorica. Happy to help with setup for workshops.',
    isHost: true,
    mode: 'host',
    createdAt: '2026-08-14',
  },
  {
    id: 3,
    name: 'Jelena Nikolić',
    email: 'jelena@zona.app',
    password: 'zona1234',
    avatarUrl: avatar(45),
    city: 'Nikšić',
    bio: 'Product manager at a remote startup, in Podgorica twice a month for team days.',
    isHost: false,
    mode: 'guest',
    createdAt: '2026-10-05',
  },
  {
    id: 4,
    name: 'Milica Vuković',
    email: 'milica@zona.app',
    password: 'zona1234',
    avatarUrl: avatar(32),
    city: 'Podgorica',
    bio: 'Office manager at City Kvart. I rent out our meeting rooms when the team does not need them.',
    isHost: true,
    mode: 'host',
    createdAt: '2026-08-21',
  },
  {
    id: 5,
    name: 'Nikola Bulatović',
    email: 'nikola@zona.app',
    password: 'zona1234',
    avatarUrl: null,
    city: 'Budva',
    bio: 'Backend developer, looking for a quiet desk when I visit the capital.',
    isHost: false,
    mode: 'guest',
    createdAt: '2026-10-11',
  },
  {
    id: 6,
    name: 'Ivana Radulović',
    email: 'ivana@zona.app',
    password: 'zona1234',
    avatarUrl: avatar(44),
    city: 'Cetinje',
    bio: 'Turning my grandfather’s old painting studio in Cetinje into a small workspace.',
    isHost: true,
    mode: 'host',
    createdAt: '2026-10-17',
  },
  {
    id: 7,
    name: 'Luka Šćepanović',
    email: 'luka@zona.app',
    password: 'zona1234',
    avatarUrl: avatar(53),
    city: 'Kotor',
    bio: 'Photographer. I book event halls for exhibitions and portfolio reviews.',
    isHost: false,
    mode: 'guest',
    createdAt: '2026-09-29',
  },
  {
    id: 8,
    name: 'Teodora Vujošević',
    email: 'teodora@zona.app',
    password: 'zona1234',
    avatarUrl: null,
    city: 'Bar',
    bio: 'Getting a small office by the marina ready to list. Until then I book desks in Podgorica myself.',
    isHost: true,
    mode: 'guest',
    createdAt: '2026-09-08',
  },
]

// Today's date in the browser's time zone ('YYYY-MM-DD'), for seed rows that should always be current.
const today = new Intl.DateTimeFormat('en-CA').format(new Date())

const ANA: BookingGuest = { id: 1, name: 'Ana Petrović', avatarUrl: avatar(47) }
const JELENA: BookingGuest = { id: 3, name: 'Jelena Nikolić', avatarUrl: avatar(45) }
const NIKOLA: BookingGuest = { id: 5, name: 'Nikola Bulatović', avatarUrl: null }
const LUKA: BookingGuest = { id: 7, name: 'Luka Šćepanović', avatarUrl: avatar(53) }

// Hosts: Marko (2) has Hub Morača, Njegoševa and the Event Loft; Milica (4) has the two meeting rooms.
const HUB = { id: 1, name: 'Hub Morača Coworking', address: 'Bulevar Svetog Petra Cetinjskog 9', hostId: 2 }
const STUDIO = { id: 2, name: 'Njegoševa Studio Desks', address: 'Njegoševa 24', hostId: 2 }
const GLASS = { id: 3, name: 'Glass Room at City Kvart', address: 'Bulevar Džordža Vašingtona 98', hostId: 4 }
const RIVERSIDE = { id: 4, name: 'Riverside Boardroom', address: 'Ulica Vaka Đurovića 5', hostId: 4 }
const LOFT = { id: 6, name: 'Preko Morače Event Loft', address: 'Bulevar Ivana Crnojevića 64', hostId: 2 }

// Njegoševa has 2 desks, so 10:00–12:00 on 22 Oct is full. Booking 5 overlaps the confirmed booking 4
// in the Glass Room, so confirming it is refused. Booking 11 is always today, so Hub Morača shows one
// desk taken ("23 desks available") whenever it is open. Marko has three requests waiting (9, 14, 15)
// on Reservations; Milica declined booking 16, so Ana sees it under Past. Stored statuses are pending,
// confirmed, declined or cancelled; finished and expired are worked out on read (see statusNow in
// ./booking.ts).
const bookings: Booking[] = [
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
  {
    id: 11,
    spaceId: HUB.id,
    space: HUB,
    guest: LUKA,
    date: today,
    startTime: '08:00',
    endTime: '20:00',
    totalPrice: 36,
    status: 'confirmed',
    createdAt: today,
  },
  // In the past: confirmed → finished, pending (never confirmed) → expired. Neither is active.
  {
    id: 12,
    spaceId: HUB.id,
    space: HUB,
    guest: JELENA,
    date: '2026-10-16',
    startTime: '09:00',
    endTime: '12:00',
    totalPrice: 9,
    status: 'confirmed',
    createdAt: '2026-10-09',
  },
  {
    id: 13,
    spaceId: LOFT.id,
    space: LOFT,
    guest: ANA,
    date: '2026-10-18',
    startTime: '18:00',
    endTime: '22:00',
    totalPrice: 340,
    status: 'pending',
    createdAt: '2026-10-11',
  },
  {
    id: 14,
    spaceId: LOFT.id,
    space: LOFT,
    guest: LUKA,
    date: '2026-11-06',
    startTime: '18:00',
    endTime: '22:00',
    totalPrice: 340,
    status: 'pending',
    createdAt: '2026-10-21',
  },
  {
    id: 15,
    spaceId: STUDIO.id,
    space: STUDIO,
    guest: NIKOLA,
    date: '2026-10-28',
    startTime: '10:00',
    endTime: '14:00',
    totalPrice: 16,
    status: 'pending',
    createdAt: '2026-10-22',
  },
  {
    id: 16,
    spaceId: RIVERSIDE.id,
    space: RIVERSIDE,
    guest: ANA,
    date: '2026-10-29',
    startTime: '10:00',
    endTime: '12:00',
    totalPrice: 60,
    status: 'declined',
    createdAt: '2026-10-20',
  },
]

// Saved spaces of the demo guests. Space 5 is a draft, so nobody has it; the Favorites page only shows
// listed spaces anyway.
const favorites: Favorite[] = [
  { userId: ANA.id, spaceId: 1, createdAt: '2026-10-12T08:40:00Z' },
  { userId: ANA.id, spaceId: 6, createdAt: '2026-10-15T19:05:00Z' },
  { userId: ANA.id, spaceId: 3, createdAt: '2026-10-20T11:30:00Z' },
  { userId: JELENA.id, spaceId: 4, createdAt: '2026-10-08T14:10:00Z' },
  { userId: JELENA.id, spaceId: 2, createdAt: '2026-10-17T09:20:00Z' },
  { userId: 5, spaceId: 1, createdAt: '2026-10-11T16:45:00Z' },
  { userId: 5, spaceId: 2, createdAt: '2026-10-19T10:00:00Z' },
  { userId: LUKA.id, spaceId: 6, createdAt: '2026-09-30T18:15:00Z' },
  { userId: 8, spaceId: 1, createdAt: '2026-09-12T07:55:00Z' },
  { userId: 8, spaceId: 3, createdAt: '2026-10-02T13:25:00Z' },
]

// One users table for auth (login, sign-up) and users (profile), so a profile change is seen by the
// signed-in session right away. One bookings table for bookings (the overlap rule) and spaces (free
// desks). One favorites table for favorites (the hearts) and spaces (the Favorites page). Every demo
// account uses the password "zona1234".
export const db: { users: StoredUser[]; bookings: Booking[]; favorites: Favorite[] } = {
  users,
  bookings,
  favorites,
}
