# Zona

Zona is an app for renting spaces by the hour: desks, meeting rooms, private offices and event halls.
Guests find a space and book a time slot; hosts list their own spaces and confirm or decline bookings.
One account switches between guest and host mode, and the app is built phone first.

## Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4 and shadcn/ui
- React Router and TanStack Query
- React Hook Form and Zod for forms
- pnpm workspace (monorepo); the backend comes next workshop, until then data lives in an in-memory mock

## Getting started

You need Node and [pnpm](https://pnpm.io). Run everything from the repo root:

```bash
npm install -g pnpm   # once per machine
pnpm install
pnpm dev              # http://localhost:5173
```

Other commands: `pnpm typecheck`, `pnpm lint` (oxlint and the boundary check between features),
`pnpm build`, `pnpm format`.

## Demo users

The mock data lives in `frontend/src/lib/mock-db.ts` and resets on every page reload.
Every account uses the password `zona1234`.

| Email | Name | Account |
| --- | --- | --- |
| `ana@zona.app` | Ana Petrović | Guest, several bookings |
| `jelena@zona.app` | Jelena Nikolić | Guest, pending and cancelled bookings |
| `luka@zona.app` | Luka Šćepanović | Guest |
| `nikola@zona.app` | Nikola Bulatović | Guest, no bookings |
| `marko@zona.app` | Marko Jovanović | Host of four spaces (desks, office, event loft) |
| `milica@zona.app` | Milica Vuković | Host of two meeting rooms |
| `ivana@zona.app` | Ivana Radulović | Host, no spaces yet |
| `teodora@zona.app` | Teodora Vujošević | Host, signs in in guest mode |

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
