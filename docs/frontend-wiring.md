# Wiring the frontend to the backend

> The plan for moving `frontend/` from the in-memory mock to the real API. The contract is
> `docs/entities.md` (two identical copies); this file says in which order and in which pull requests
> the frontend follows it. Remove a section once its PR is merged into `main`.

## Context

The frontend takes all its data from an in-memory mock (`frontend/src/lib/mock-db.ts` and the arrays
inside the `*-api.ts` files). The backend is done and merged: auth, users, spaces, favorites and
bookings (CRUD, availability, popular times, `bookingCounts`, `availableDesks`, `DELETE` 409). The goal
is that every `*-api.ts` calls `/api/...`, except the city suggestions.

What the code shows today:
- `frontend/vite.config.ts` has no proxy, although `backend/README.md` says the frontend proxies `/api`.
- **The seed has one user** (`demo@example.com` / `demo1234`) and 4 spaces, no bookings and no
  favorites; the demo accounts in `README.md` (Ana, Marko…) do not exist in the database.
- A token lives 60 minutes and there is no refresh route.
- `GET /api/spaces/cities` (`docs/search-suggestions.md`) is not built.
- The frontend has no tests.
- The ids are intertwined: the mock bookings point at mock spaces (1–6) and mock users (1–8), and in a
  real database those ids belong to other rows. That is why spaces, favorites and bookings move to the
  backend together, on an integration branch.

## 1. Vite proxy (PR 1)

`frontend/vite.config.ts`: `server.proxy` for `/api` to `http://localhost:8000` (`changeOrigin: true`,
no rewrite, the backend routes already start with `/api`); the target can be overridden with
`API_URL`. With the proxy every request is same-origin, so CORS plays no part in development. The root
`package.json` gets `"dev:api": "cd backend && poetry run start"`.

## 2. Shared HTTP client (PR 1, no change in behaviour)

New files in `frontend/src/lib/`, used by every feature:

- `auth-token.ts`: `getToken()`, `setToken()`, `clearToken()` in `localStorage` under `zona.token`,
  inside `try/catch` like today's `readSession`/`writeSession` in `auth-api.ts`. Plus
  `onSessionExpired(listener)`, so `src/app` can react without `src/lib` importing from `src/app`.
- `api-client.ts`:
  - `api.get<T>`, `api.post<T>`, `api.patch<T>`, `api.delete`; builds `/api${path}` plus the query
    string, skips `undefined` parameters, passes TanStack Query's `signal` on.
  - `Authorization: Bearer <token>` when there is a token; `Content-Type: application/json` with a body.
  - `204` → `undefined` (no `res.json()`); other `2xx` → JSON. `200 null` (popular times) is a valid answer.
  - Errors → `class ApiError extends Error { status, code, fieldErrors? }` with `message = detail`. A
    body that is not our error shape (the proxy answers an empty 500/502/504 while the backend is down)
    → `ApiError(status, 'server_unavailable', "Zona can't be reached right now. Try again in a moment.")`.
    A `fetch` that throws (no network) → `ApiError(0, 'network_error', same text)`.
  - `401` with `code === 'invalid_token'` → the token is cleared and `onSessionExpired` runs. **Only**
    that code: `invalid_credentials` (wrong password) is also a 401 and must not log anyone out.
  - `Page<T> = { total: number; items: T[]; pages: number | null }`; helpers `isNotFound(error)` (404,
    or 422 for an invalid id in the path, e.g. `/spaces/abc`) and `errorMessage(error)`.
- `form-errors.ts`: `applyFieldErrors(error, setError, fieldNames)` puts every known key of
  `fieldErrors` on its react-hook-form field; the rest goes to `FormAlert` as `detail`.
- `frontend/src/app/providers.tsx`: a global `retry` for the `QueryClient` (no retry for a 4xx,
  otherwise TanStack's default of 3) and a listener on `onSessionExpired`:
  `setQueryData(currentUserQueryKey, null)`, `invalidateQueries()` for every query (public `GET`s then
  run again without the token) and a toast "Your session ended. Log in again." (`sonner`).
- Vitest, only for `api-client.ts`, with a mocked `fetch` (see Testing).

PR 1 only adds these files; no `*-api.ts` uses them yet, so it can be merged on its own.

## 3. Auth (PR 2)

`features/auth/api/auth-api.ts`, `use-auth.ts`:
- `login` → `POST /auth/login`, `signup` → `POST /auth/register`; both answer `{token, user}`: call
  `setToken(token)` and return `user`. **The forced `mode: 'guest'` goes**: login returns the stored mode.
- `me`: without a token `null` and no request, otherwise `GET /auth/me`; a 401 → `null`.
- `logout`: only `clearToken()`.
- After login, signup and logout invalidate `['spaces']`, `['favorites']` and `['bookings']`, not only
  `['auth']`: the lists depend on the token (own drafts, `bookingCounts`).
- `InvalidCredentialsError`, `EmailTakenError`, `zona.session`, `StoredUser` and `normalizeEmail` go.
  `signup-form.tsx` shows `email_already_registered` under the email field; both forms get `.max(72)`
  on the password.

## 4. Users (PR 2)

`features/users/api/users-api.ts`, `use-users.ts`, `types.ts`:
- `list` → `GET /users` (`Page<PublicUser>`), `get` → `GET /users/:id`, `update` → `PATCH /users/:id`,
  `remove` → `DELETE /users/:id` (204).
- `create` and `NewUser` go (the contract has no `POST /users`), and so do `normalize` and
  `InvalidProfileError`.
- `useDeleteAccount`: on success `clearToken()` and `setQueryData(currentUserQueryKey, null)`.
- `use-profile-form.ts`: `city` `.max(80)`; `profile-details.tsx` shows server errors through
  `applyFieldErrors`.
- **`createdAt` fix:** `host-card.tsx:28` and `profile-details.tsx:94` build
  `` new Date(`${createdAt}T00:00:00Z`) ``. On a real ISO date-time that is an `Invalid Date`, and
  `Intl.DateTimeFormat.format` throws a `RangeError` that takes the page down. Use `new Date(createdAt)`.

## 5. Spaces (PR 3)

`features/spaces/api/spaces-api.ts`, `use-spaces.ts`:
- `list(filters, { page, size })` → `GET /spaces` → `Page<Space>`. The callers change:
  `spaces-list.tsx` (`showCount` reads `total`), `host-spaces-list.tsx`, `use-category-stats.ts`,
  `routes/bookings.tsx` and `routes/host-reservations.tsx` (`spacesById` from `.items`). Explore: the
  first page of 50 plus `total`; "Load more" is a follow-up. The bookings join and the category stats
  use `size: 500` (the maximum), with a comment about the limit.
- Filters go as query parameters (the names already match the contract); `search` and `city` from the
  URL are cut to 80 characters.
- `get` → `GET /spaces/:id`; `create(input)` → `POST /spaces` **without the `host` parameter**
  (`useCreateSpace` and `routes/host-space-new.tsx` change); `update` → `PATCH`; `remove` → `DELETE`.
- The whole mock goes (`spaces`, `availableDesks()`, `bookingCounts()`, `savedAt`, `matches`,
  `withDeskRule`, `InvalidSpaceError`); `spaces-api.ts` no longer imports `@/lib/booking` or `db`.
- `availableDesks` and `bookingCounts` come from the backend.
- `delete-space-dialog.tsx`: `SpaceHasActiveBookingsError` becomes an `ApiError` with
  `code === 'space_has_active_bookings'` (409), and the dialog shows `detail` ("This space has 2 active
  bookings"). No separate count field; the contract stays as it is.
- `use-space-form.ts`: `city` `.max(80)`, `address` `.max(120)`, image URL `.max(500)`;
  `space-form.tsx` shows server errors through `applyFieldErrors`.
- `suggestions-api.ts` (cities) stays a mock; `/spaces/cities` is a small backend PR later.

## 6. Favorites (PR 3)

`features/favorites/api/favorites-api.ts`, `use-favorites.ts`:
- `list()` → `GET /favorites?size=500` → `.items`; `create(spaceId)` → `POST /favorites` (`201` and
  `200` are both success); `remove(spaceId)` → `DELETE /favorites/:spaceId` (204).
- The API functions lose `userId`; the hooks keep it only in the query key and for `skipToken`.
- The Favorites page still calls `GET /spaces?favoriteOf=<own id>&status=listed`.
- The `Favorite` type moves from `src/lib/favorite.ts` to `features/favorites/types.ts`; update the
  path in the Favorite section of both `entities.md` copies.
- Remove "Frontend: connect favorites to the backend" from `docs/follow-ups.md`.

## 7. Direct mock-db imports

| File | Today | After | PR |
| --- | --- | --- | --- |
| `app/routes/space-detail.tsx:19,31` | `error instanceof NotFoundError` | `isNotFound(error)` | 3 |
| `app/routes/host-space-edit.tsx:15,29` | same | `isNotFound(error)` | 3 |
| `features/spaces/api/use-spaces.ts:3,20` | `retry` with `NotFoundError` | global `retry` | 3 |
| `features/users/api/use-users.ts:3,21` | same | global `retry` | 2 |
| `src/lib/favorite.ts` | type and a comment about the mock | `features/favorites/types.ts` | 3 |
| `features/{auth,users}/api/*-api.ts` | `db`, `delay`, `NotFoundError` | `api-client` | 2 |
| `features/{spaces,favorites}/api/*-api.ts` | same | `api-client` | 3 |
| `features/bookings/api/bookings-api.ts`, `use-bookings.ts` | same, plus `InvalidBookingError` in `retry` | `api-client`, global `retry` | 4 |
| `features/spaces/api/suggestions-api.ts` | `delay` | `delay` moves into the file | 4 |

`src/lib/mock-db.ts`: PR 2 removes `users` and `StoredUser`, PR 3 removes `favorites`, and PR 4
**deletes the file** with the booking rows, `delay` and `NotFoundError`.

## 8. Bookings (PR 4, Daca)

`features/bookings/api/bookings-api.ts`, `use-bookings.ts`, `src/lib/booking.ts`:
- `list(filters, { page, size })` → `GET /bookings` → `Page<Booking>`; `bookings-list.tsx` reads
  `.items`, and the Reservations badge in `app/app-shell.tsx` reads `pending.total` instead of
  `pending.length`.
- `get` → `GET /bookings/:id`. `create(input)` → `POST /bookings {spaceId, date, startTime, endTime}`,
  **without `space` and `guest`** (the guest comes from the token; `useCreateBooking` and
  `booking-form.tsx` change).
- `update(id, {status})` → `PATCH /bookings/:id`, **without `space`** (the backend checks the overlap
  rule on confirm); `useConfirmBooking` takes only the `id`. `remove` → `DELETE /bookings/:id`.
- `availability(slot)` → `GET /bookings/availability?spaceId=&date=&startTime=&endTime=`;
  `popularTimes(spaceId)` → `GET /bookings/popular-times?spaceId=` (`null` for a space younger than
  14 days). `BookableSpace` can shrink to what the UI still uses.
- The mock logic goes: `slotHours`, `slotUsage`, `CURVES`/`DAY_FACTORS`/`jitter`, `withStatusNow`.
  `statusNow` in `lib/booking.ts` is no longer needed: the backend returns the status as it is now
  (`finished`/`expired`). `isActive` stays (`booking-card.tsx`, `use-booking-tabs.ts`). Only bookings
  uses `lib/booking.ts` then, so it moves to `features/bookings/types.ts` (update the path in the
  Booking section of `entities.md`).
- Errors: `InvalidBookingError` and `SlotUnavailableError` become `ApiError`. For `invalid_slot`,
  `booking_in_past`, `booking_too_far_ahead` and `validation_error` the `fieldErrors` go on the form
  fields (`date`, `startTime`, `endTime`); `slot_full` (409), `cannot_book_own_space` (403) and
  `invalid_status_change` (422) show `detail` (`booking-form.tsx`, the toast in `reservation-actions.tsx`).
- Remove "Frontend: connect bookings to the backend" from `docs/follow-ups.md`, and the part of the
  "second review" entry about the mock.

**What PR 4 waits for:**
- From **PR 1**: `api-client.ts` (`ApiError`, `Page<T>`), `form-errors.ts`, the global `retry`.
- From **PR 3**: real spaces with real ids (`spacesById` in `routes/bookings.tsx` and
  `host-reservations.tsx` already reads `.items`; `space.host.id` for "you cannot book your own
  space"); `spaces-api.ts` no longer reads `db.bookings` or `lib/booking.ts`.
- From **PR 2**: the token on every request; every bookings route except availability and popular
  times needs it.
- From **PR 0**: demo bookings to test by hand.

## 9. Seed with demo data (PR 0, Daca)

`backend/app/seed.py` and the seed line in `backend/README.md`:
- The mock's users: Ana, Marko (host), Jelena, Milica (host), Nikola, Ivana (host, no spaces), Luka,
  Teodora (host in guest mode); password `zona1234`. `demo@example.com` stays.
- The mock's 6 spaces (Marko: Hub Morača, Njegoševa, Hercegovačka draft, Event Loft; Milica: Glass
  Room, Riverside), favorites, and bookings in every status: pending, confirmed, declined, cancelled,
  a past confirmed one (→ `finished`), a past pending one (→ `expired`), and one confirmed today at Hub
  Morača (so `availableDesks` shows it).
- **The spaces' `createdAt` a few weeks back** (8–10 weeks), so popular times has data (it is `null`
  while a space is younger than 14 days), plus past confirmed bookings within the last 8 weeks.
- **Pitfall:** `POST /api/bookings` (and the service) refuses past dates (`booking_in_past`), and the
  backend assigns `createdAt`. If the services read the time from `IClock` (`app/utils/clock.py`, in
  the DI container), the seed swaps in a fixed clock in the past for those rows
  (`add_to_di_container(IClock, …)`), and every rule still applies. Otherwise it sets `created_at` on
  the model after `create`. Check which one before writing it.
- Still idempotent: what exists is skipped (by email, and by the host's spaces).
- `backend/.env.example` gets a comment about a longer `ACCESS_TOKEN_EXPIRE_MINUTES` for development.
- The demo table in the root `README.md` (PR 3) lists the new accounts and what each one has.

## Differences between the mock and the contract

FE = changes in the frontend; C = needs a change in the contract or the backend.

| # | Topic | Mock today | Contract / backend | FE | C | PR |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Lists | `T[]` | `{total, items, pages}` (users, spaces, favorites, bookings) | `.items`/`.total` | no | 2–4 |
| 2 | Page size | everything at once | `size` 1–500, default 50 | `size: 500` where all rows are needed | no | 3–4 |
| 3 | Login/signup answer | `User` | `{token, user}` | store the token | no | 2 |
| 4 | Session | `userId` in `zona.session` | `Authorization: Bearer` | `zona.token` | no | 1–2 |
| 5 | Mode on login | always `guest` | the stored mode | drop the forced mode | no | 2 |
| 6 | Signup route | `signup` | `POST /auth/register` | route name | no | 2 |
| 7 | `me` without a session | `null` | `401 not_authenticated` | no request without a token | no | 2 |
| 8 | Logout | async with a delay | no route | clear the token | no | 2 |
| 9 | Session end | never | 60 min, `401 invalid_token` also on a public `GET` | log out, toast, refetch | no (longer in `.env` for dev) | 1 |
| 10 | Error shape | one error class per case | `{detail, code, fieldErrors?}` | `ApiError` | no | 1–4 |
| 11 | Email taken | "Email already in use" | `409 email_already_registered`, `fieldErrors.email` | under the field | no | 2 |
| 12 | Not found | `NotFoundError` | `404 *_not_found`; `422` for `/spaces/abc` | `isNotFound` | no | 3 |
| 13 | Other hosts' drafts in a list | returned when `status` is not given | never | nothing | no | 3 |
| 14 | `createdAt` | `YYYY-MM-DD` (users, spaces, bookings) | ISO date-time in UTC | fix `host-card`, `profile-details` | no | 2 |
| 15 | New ids | `Date.now()` (> 2147483647) | assigned by the backend, 1–2147483647 | remove | no | 2–4 |
| 16 | `POST /users` | `usersApi.create` | does not exist | remove | no | 2 |
| 17 | User `city` | no limit | ≤ 80 | `.max(80)` | no | 2 |
| 18 | Password | no upper limit | 8–72 / 1–72 | `.max(72)` | no | 2 |
| 19 | `search`/`city` filter | no limit | ≤ 80, otherwise 422 | cut | no | 3 |
| 20 | Space form | no max on city, address, URL | 80 / 120 / 500 | zod limits | no | 3 |
| 21 | Space host | `create(input, host)` | from the token | drop the parameter | no | 3 |
| 22 | `availableDesks`, `bookingCounts` | computed from the mock bookings | real, from the backend | drop the mock computation | no | 3 |
| 23 | Delete with active bookings | `SpaceHasActiveBookingsError.activeBookings` | real `409 space_has_active_bookings`, the count only in `detail` | show `detail` | no (decided) | 3 |
| 24 | Favorites `userId` | parameter | from the token | drop | no | 3 |
| 25 | `POST /favorites` | returns the favorite | `201` new / `200` existing | both success | no | 3 |
| 26 | `DELETE` | `undefined` | `204` with no body | do not parse JSON | no | 1 |
| 27 | A saved space the user can no longer view | stays | left out | nothing | no | 3 |
| 28 | `favoriteOf` | any id | own id only, `401`/`403 not_own_favorites` | send the token | no | 3 |
| 29 | Cities | made-up counts | `/spaces/cities` not built | stays a mock | small backend PR later | — |
| 30 | Field error key for a path id | — | `fieldErrors.user_id` (snake_case) | ignore | backend (follow-ups) | — |
| 31 | Validation text | friendly messages | Pydantic messages | zod first, the server's as a fallback | no | 2–4 |
| 32 | Deleting the account | stays signed in | the token then answers `invalid_token` | log out right away | no | 2 |
| 33 | Seed | 8 users, 6 spaces, favorites, bookings | 1 user, 4 spaces | README | extend the seed | 0 |
| 34a | Booking `create` | `create(input, space, guest)` | `POST {spaceId, date, startTime, endTime}` | input only | no | 4 |
| 34b | Booking `update` | `update(id, changes, space)`; same status returns the booking | `PATCH {status}`; same status → `422 invalid_status_change` | no `space`, show the error | no | 4 |
| 34c | Availability | computed from the mock rows | `GET /bookings/availability` | `fetch` | no | 4 |
| 34d | Popular times | synthetic curves | `GET /bookings/popular-times`, `null` under 14 days | `fetch` | no | 4 |
| 34e | Status now | `statusNow` in the browser's time zone | the backend returns `finished`/`expired`, Europe/Podgorica | drop `statusNow` | no | 4 |
| 34f | Booking errors | `InvalidBookingError`, `SlotUnavailableError`, own messages | `invalid_slot`, `booking_in_past`, `booking_too_far_ahead`, `slot_full`, `cannot_book_own_space`, `not_booking_*` | `ApiError` and `fieldErrors` | no | 4 |
| 34g | Date window | `BOOKABLE_DAYS = 60`, only past dates checked | today to +365 days | stays 60 (decision 8) | no | 4 |
| 34h | Pending badge | `pending.length` | paginated | `pending.total` | no | 4 |

## Testing

**Today:** the frontend has no automated tests. The gates are `pnpm typecheck`, `pnpm lint` (oxlint
and `frontend/scripts/check-boundaries.mjs`), `pnpm build` and a check with Playwright MCP (375 and
1440 px, the console), through `/check`. The backend has pytest unit and integration tests and CI
(`.github/workflows/backend.yml`).

**Automated (PR 1):** Vitest (`pnpm test` from the root) only for `frontend/src/lib/api-client.ts`,
with a mocked `fetch`:
- `204` → `undefined`, `200 null` → `null`;
- an error in our shape → `ApiError` with `status`, `code`, `fieldErrors`;
- `invalid_token` clears the token and calls the listener, `invalid_credentials` and
  `not_authenticated` do not;
- a `fetch` that throws → `network_error`; an empty 502 → `server_unavailable`;
- `Authorization` only with a token; `undefined` parameters stay out of the query.

**Running it by hand (on a fresh database, after PR 0):**
```bash
cd backend && poetry run migrate && poetry run seed
pnpm dev:api
pnpm dev
curl -s http://localhost:5173/api/spaces | head -c 200
```

**Flows to check** (Playwright MCP, 375 and 1440 px, light and dark, the Network tab, no console errors):
1. Visitor: Explore shows the listed spaces and `total`, not the Hercegovačka draft; the category,
   price, `?city=` and search filters send the right query parameters.
2. `/spaces/999` and `/spaces/abc` → "not found", without retries.
3. Sign up a new account → signed in, guest mode; sign up with `ana@zona.app` → message under the
   email field (409).
4. Log in with a wrong password → "Wrong email or password", nobody is logged out.
5. Teodora logs in in guest mode, Marko in host mode. Switch to host → log out → log in → still host.
   A reload keeps the session.
6. Profile: edit; a `city` of 81 characters is stopped by the form; "Host since" and "Member since"
   show a date.
7. Heart: `POST 201`, quick repeated clicks without flicker, removing with `DELETE 204`; the Favorites
   page shows the newest saved first.
8. Host Marko: new space, edit, draft (another account gets 404); My spaces shows real
   `bookingCounts`; deleting a space with an active booking → `409` with `detail`, the space stays;
   deleting one without → `204`.
9. **Booking through the backend:** Ana picks a slot at Njegoševa → `GET /bookings/availability` shows
   free desks; a slot the seed filled (both desks confirmed, a future date relative to the seed day)
   shows "No desks left at 10:00"; "Book" → `POST 201 pending`; My bookings shows it.
10. **Confirming through the backend:** log out, log in as Marko → the Reservations badge counts the
    pending ones; Approve → `PATCH 200`; approving one that overlaps a confirmed booking → `409
    slot_full` in the toast; Decline works; Ana sees the status under Upcoming or Past.
11. Ana cancels a confirmed booking (`PATCH cancelled`) and deletes a pending one (`DELETE 204`); a
    confirmed one cannot be deleted.
12. Popular times: a seeded space (a few weeks old) has a chart; a new space shows "not enough data".
13. Hub Morača during opening hours: "23 desks available", because of today's confirmed seed booking.
14. Expired token: `localStorage.zona.token = 'x'` in DevTools → reload → Explore works, the user is
    logged out, toast.
15. Backend down: the lists show their error state with "Try again"; once the backend is back,
    "Try again" works.
16. Deleting the account → logged out.

## PR split

PR 0 and PR 1 do not change how the app behaves, so they go **straight into `main` (squash merge)**.
Once PR 1 is in `main`, the integration branch `feat/frontend-wiring` is cut from `main`. Only PR 2, 3
and 4 branch from it and go back into it with a regular merge (no squash, no rebase); at the end one
PR `feat/frontend-wiring → main`. `main` stays stable, and the half-real states between PR 2, 3 and 4
exist only on the integration branch.

| PR | Who | Branch | Goes into | Content | Depends on | In parallel with |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Daca | `feat/seed-demo` from `main` | `main` (squash) | seed: users, spaces (`createdAt` a few weeks back), favorites, bookings; backend README | — | 1, 2, 3 |
| 1 | Ivana | `feat/frontend-client` from `main` | `main` (squash) | proxy, `pnpm dev:api`, `auth-token.ts`, `api-client.ts`, `form-errors.ts`, `providers.tsx`, Vitest. **No change in behaviour** | — | 0 |
| 2 | Vuk | from `feat/frontend-wiring` | `feat/frontend-wiring` (merge) | auth, users, the `createdAt` fix, form limits | 1 | 0, 3, 4 (development) |
| 3 | Ivana | from `feat/frontend-wiring` | `feat/frontend-wiring` (merge) | spaces, favorites, `mock-db.ts` without favorites, `lib/favorite.ts`, README, `.claude/rules/data.md`, `frontend/CLAUDE.md`, the Favorite section of `entities.md` | 1 (2 to test by hand) | 0, 2, 4 (development) |
| 4 | Daca | from `feat/frontend-wiring` | `feat/frontend-wiring` (merge) | bookings frontend, `mock-db.ts` deleted, `lib/booking.ts` into the feature, follow-ups | 1, 3 (2 to test by hand) | 2, 3 (development) |
| — | — | `feat/frontend-wiring` | `main` | one final PR with PR 2, 3 and 4 | 2, 3, 4 | — |

- **Order:**
  1. PR 0 and PR 1 into `main` (squash), independently of each other.
  2. Once PR 1 is in, `feat/frontend-wiring` is cut from `main` and pushed.
  3. PR 2, PR 3 and PR 4 are merged into it, in that order.
  4. At the end `feat/frontend-wiring → main`.

  If PR 0 lands in `main` after the integration branch was cut, merge `main` into
  `feat/frontend-wiring`, so PR 4 has the seed. Before its merge each of PR 2–4 pulls the latest
  integration branch (`git merge feat/frontend-wiring`) and passes the checks again.
- **Parallel work:** as soon as `feat/frontend-wiring` exists, Vuk (PR 2), Ivana (PR 3) and Daca (PR 4)
  branch from it. Until PR 2 is merged, PR 3 and PR 4 are tested by hand with a token set by hand
  (`curl -s -X POST localhost:8000/api/auth/login …` → the token into `localStorage.zona.token`),
  because the favorites and bookings routes need one.
- **What PR 4 waits for:** from PR 1 the client, `ApiError`, `Page<T>` and `form-errors.ts`; from PR 3
  the real spaces (`.items` in `routes/bookings.tsx` and `host-reservations.tsx`, the real
  `space.host.id`) and a `spaces-api.ts` that no longer reads `db.bookings`. Daca branches after PR 1
  and, once PR 3 is in, pulls the integration branch before testing the whole booking flow.
- **Expected conflicts** (resolved when pulling the integration branch): `src/lib/mock-db.ts` (PR 2
  removes users, PR 3 favorites, PR 4 the whole file), the root `README.md` (demo table: PR 0, PR 3),
  `frontend/CLAUDE.md` and `.claude/rules/data.md`, and `routes/bookings.tsx` and
  `host-reservations.tsx` (PR 3, PR 4).
- Every PR touches shared data (`types.ts`, `api/`, `mock-db.ts`), so it is announced to the team
  (`frontend/CLAUDE.md`).
- Only Daca changes the Space and Booking sections of `entities.md`, `backend/app/bookings/` and
  `backend/.claude/decisions.md`: the Booking section (the `lib/booking.ts` path) in PR 4.

## Decisions

1. The seed is extended, with bookings (PR 0).
2. The cities stay a mock; `GET /api/spaces/cities` is a separate small backend PR later.
3. A 409 shows only `detail`; the contract does not change.
4. A 60-minute token with a toast is accepted; for development a longer `ACCESS_TOKEN_EXPIRE_MINUTES`
   in `backend/.env`.
5. Vitest only for the HTTP client.
6. Explore: 50 plus `total`; "Load more" is a follow-up in `docs/follow-ups.md`.
7. `pnpm dev:api`: yes (PR 1).
8. The date picker stays at 60 days (`BOOKABLE_DAYS` in `use-booking-slot.ts`), so the UI never gets
   `booking_too_far_ahead`; the backend's 365 days stay the hard limit (PR 4).

## Open questions

None open. The date picker (60 or 365 days) was decided in PR 4: decision 8.
