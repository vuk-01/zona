# Zona

Zona is an app for renting spaces by the hour: desks, meeting rooms, private offices and event halls.
Guests find a space and book a time slot; hosts list their own spaces and confirm or decline bookings.
One account switches between guest and host mode, and the app is built phone first.

## Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4 and shadcn/ui
- React Router and TanStack Query
- React Hook Form and Zod for forms
- pnpm workspace (monorepo): the frontend in `frontend/`, the backend (FastAPI, SQLite or Postgres) in `backend/`, see `backend/README.md`; spaces, favorites and bookings come from the API, auth and users are still an in-memory mock

## Getting started

You need Node and [pnpm](https://pnpm.io). Run everything from the repo root:

```bash
npm install -g pnpm   # once per machine
pnpm install
pnpm dev              # http://localhost:5173
```

Other commands: `pnpm typecheck`, `pnpm lint` (oxlint and the boundary check between features),
`pnpm build`, `pnpm format`.

### Backend

The dev server proxies `/api` to the backend on port 8000. Set the backend up once (Python 3.13 and
Poetry, see `backend/README.md`), then run it next to `pnpm dev`, in a second terminal:

```bash
cd backend && poetry install && poetry run migrate && poetry run seed   # once
pnpm dev:api          # http://localhost:8000/docs
```

A token lives 60 minutes; for development, a longer `ACCESS_TOKEN_EXPIRE_MINUTES` in `backend/.env`
saves logging in again. The frontend moves from the mock to the API step by step, see
`docs/frontend-wiring.md`.

## Demo users

Spaces, favorites and bookings come from the backend's demo data, `poetry run seed` (the accounts
below arrive with PR 0, branch `feat/seed-demo`; details in `backend/README.md`). **Local development
only:** the passwords are public. Every `@zona.app` account has the password `zona1234`;
`demo@example.com` has `demo1234`. Until sign-in moves to the API (PR 2 in `docs/frontend-wiring.md`),
the frontend signs in against its own mock users (`frontend/src/lib/mock-db.ts`, reset on every page
reload). Their ids do not match the seed (the seed's `demo@example.com` is id 1, so every `@zona.app`
account is one higher there), so bookings and favorites work end to end only after PR 2.

| Account | Mode | What it has |
| --- | --- | --- |
| `marko@zona.app` | host | Hub Morača (24 desks), Njegoševa (2 desks), Hercegovačka (draft), Event Loft; 3 pending requests |
| `milica@zona.app` | host | Glass Room, Riverside Boardroom; 2 pending requests |
| `ivana@zona.app` | host | no spaces |
| `teodora@zona.app` | guest (`isHost`) | a host in guest mode; favorites and past bookings |
| `ana@zona.app` | guest | confirmed, cancelled, declined, expired and finished bookings; 3 favorites |
| `jelena@zona.app` | guest | confirmed, pending, cancelled and finished bookings; 2 favorites |
| `nikola@zona.app` | guest | a pending booking at Njegoševa, finished bookings; 2 favorites |
| `luka@zona.app` | guest | today's confirmed desk at Hub Morača, a pending Event Loft request, finished bookings; 1 favorite (Event Loft) |
| `demo@example.com` | guest | past bookings, 1 favorite, the 3 starter listings |

Booking dates are relative to the day the seed runs; seed a new database for fresh dates (see
`backend/README.md`).

## Structure

```
frontend/                React app
  src/app/               router.tsx, providers.tsx, app-shell.tsx, routes/ (one file per route)
  src/features/          auth, spaces, bookings, users (api/, components/, hooks/, types.ts)
  src/components/        ui/ (shadcn), layout/, form/
  src/lib/               shared helpers and mock-db.ts
  DESIGN.md              visual identity
backend/                 API, database and auth (next workshop)
docs/entities.md         entities and the API contract between frontend and backend
.claude/                 Claude Code rules, commands, skills, agents and settings
```

Features do not import each other; a route combines them on one page. `pnpm lint` checks these
boundaries.
