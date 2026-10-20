// In-memory mock "database" shared by all features. Next workshop this file goes away,
// and the functions in src/features/<name>/api/ start calling the real backend.

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

// One users table for both auth (login, sign-up) and users (profile), so a profile change is seen
// by the signed-in session right away. Every demo account uses the password "zona1234".
export const db: { users: StoredUser[] } = {
  users: [
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
  ],
}
