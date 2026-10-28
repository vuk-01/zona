# Entities

> This file is the contract between the frontend and the backend.
> For each entity: fields with types, relations, who is allowed to do what, and the routes.
> The backend code lives in `app/<name>/` (`models/`, `schemas/`, `repositories/`, `services/`, `api/`, `exceptions/`,
> `routes.py`). The frontend repository carries a copy of this file; its entity type is `src/features/<name>/types.ts`
> and its API functions `src/features/<name>/api/<name>-api.ts`. A change here is a change there, in the same PR.

## Conventions

- Base path: `/api` (the frontend calls `/api/...`; in development Vite proxies it to port 8000)
- JSON keys are camelCase (`imageUrl`, `createdAt`), in requests and responses
- Ids are integers from 1 to 2147483647 assigned by the backend; a non-numeric or out-of-range id in a path or filter answers `422`
- Dates are ISO 8601 strings in UTC (`2026-10-12T09:30:00Z`), assigned by the backend
- Auth: `POST /api/auth/register` or `POST /api/auth/login` return a token; protected routes take
  `Authorization: Bearer <token>`
- Public routes need no token, but a token that is sent must be valid: an invalid or expired one answers
  `401 invalid_token`, also on a public `GET`; the frontend then clears the stored token
- `POST` answers `201` with the created record, `DELETE` answers `204` with no body
- `GET` lists are paginated: `?page=1&size=50` (page ≥ 1, size 1–500, otherwise `422`) answers `{"total", "items", "pages"}`, newest first
- Every error has one shape: `{"detail": "...", "code": "snake_case_code"}` plus `fieldErrors` when a field is at fault; 401 responses also carry `WWW-Authenticate: Bearer`

| Status | When                                           | Body                                                                                                                                     |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 401    | missing token / invalid token / wrong password | `{"detail": "Authentication required", "code": "not_authenticated"}` / `"invalid_token"` / `"invalid_credentials"`                       |
| 403    | signed in, but not the owner                   | `{"detail": "Only the owner can change this listing", "code": "not_listing_owner"}`                                                      |
| 404    | record does not exist                          | `{"detail": "Listing not found", "code": "listing_not_found"}`                                                                           |
| 409    | email already registered                       | `{"detail": "Email is already registered", "code": "email_already_registered", "fieldErrors": {"email": "Email is already registered"}}` |
| 422    | invalid input                                  | `{"detail": "Validation failed", "code": "validation_error", "fieldErrors": {"title": "String should have at least 3 characters"}}`      |

## User

Code: backend `app/users/` and `app/auth/`; frontend `src/lib/user.ts`, `src/features/auth/`, `src/features/users/`.

| Field     | Type                           | Required | Notes                                                                                                             |
| --------- | ------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| id        | number                         | yes      | assigned by the backend                                                                                           |
| name      | string, 2–60 characters        | yes      | trimmed                                                                                                           |
| email     | string, valid email            | yes      | unique, stored lowercase; returned only to the user themselves                                                    |
| avatarUrl | URL or `null`                  | yes      | `null` after register; the app then shows the user's initials                                                     |
| city      | string                         | yes      | `""` after register                                                                                               |
| bio       | string, at most 200 characters | yes      | `""` after register                                                                                               |
| isHost    | boolean                        | yes      | `false` on register; becomes `true` the first time the user switches to host mode and stays `true`                |
| mode      | `guest` \| `host`              | yes      | `guest` on register and on every login; `host` only when `isHost` is `true`; returned only to the user themselves |
| createdAt | date                           | yes      | assigned by the backend                                                                                           |

The password (8–72 characters) is sent only on register and login; it is stored as a bcrypt hash and never returned.

**Public profile:** `PublicUser` is `User` without `email` and `mode`. Other people only ever get `PublicUser`.

**Guest and host mode:** one account, two modes, no role choice at register. `PATCH /api/users/:id {mode: "host"}` sets `mode: host` and `isHost: true`; `{mode: "guest"}` sets `mode: guest` and keeps `isHost`. Every login sets `mode: guest`. The mode never changes what the user owns: a host in guest mode keeps their spaces.

**Logout:** there is no backend route; the frontend deletes the token.

**Relations:** a user with `isHost = true` has many spaces (`Space.host`); a user has many bookings as a guest (`Booking.guest`) and many favorites. Deleting a user deletes their spaces, bookings and favorites.

**Access rules:** anyone, signed in or not, can view public profiles; a user gets their full profile (with `email` and `mode`) from `/api/auth/me` and from their own `PATCH`; only the user can edit or delete their own account.

| Route                                        | Auth | Body                                               | Response                                                                                      |
| -------------------------------------------- | ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST /api/auth/register`                    | no   | `{name, email, password}`                          | `201 {token, user}`, `409 email_already_registered`, `422`                                    |
| `POST /api/auth/login`                       | no   | `{email, password}`                                | `200 {token, user}` with `mode: guest`, `401 invalid_credentials` ("Wrong email or password") |
| `GET /api/auth/me`                           | yes  |                                                    | `200` user, `401`                                                                             |
| `GET /api/users?search=&isHost=&page=&size=` | no   |                                                    | `200 {total, items, pages}` of `PublicUser`; `search` matches the name, case-insensitive      |
| `GET /api/users/:id`                         | no   |                                                    | `200` `PublicUser`, `404 user_not_found`                                                      |
| `PATCH /api/users/:id`                       | self | any subset of `{name, avatarUrl, city, bio, mode}` | `200` user, `401`, `403 not_account_owner`, `404`, `422`                                      |
| `DELETE /api/users/:id`                      | self |                                                    | `204`, `401`, `403 not_account_owner`, `404`                                                  |

## Space

A space a host rents out by the hour. Code: backend `app/spaces/`; frontend `src/features/spaces/`.

| Field          | Type                                                             | Required                    | Notes                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id             | number                                                           | yes                         | assigned by the backend                                                                                                                                                                         |
| name           | string, 3–80 characters                                          | yes                         | trimmed                                                                                                                                                                                         |
| description    | string, at most 500 characters                                   | no                          | defaults to `""`                                                                                                                                                                                |
| category       | `desk` \| `meeting-room` \| `office` \| `event-hall`             | yes                         | UI labels: Desk, Meeting room, Office, Event hall                                                                                                                                               |
| city           | string, 1–80 characters                                          | yes                         | trimmed; the `city` filter matches it exactly, case-insensitive (on SQLite only ASCII letters fold: `žabljak` ≠ `Žabljak`)                                                                      |
| address        | string, 1–120 characters                                         | yes                         | street and number; trimmed                                                                                                                                                                      |
| pricePerHour   | number > 0 and ≤ 1000, EUR, at most 2 decimals                   | yes                         | `desk`: price for one desk per hour; other categories: price for the whole space per hour                                                                                                       |
| capacity       | integer 1–1000                                                   | yes                         | maximum number of people in the space                                                                                                                                                           |
| deskCount      | integer ≥ 1 and ≤ `capacity`                                     | only for `desk`             | required for `desk` (`422` without it, also when a `PATCH` switches to `desk`); for other categories it is ignored (if sent it must still be an integer 1–1000) and left out of the response    |
| images         | http(s) URL[], 1–8, each at most 500 characters                  | yes                         | the first one is the cover photo; stored as a JSON column                                                                                                                                       |
| openingHours   | object `mon`…`sun` → `{open: "HH:mm", close: "HH:mm"}` or `null` | yes                         | all seven keys required; `null` = closed that day; local time (Europe/Podgorica); whole hours (`close` may be `24:00`); `close` after `open`; open on at least one day; stored as a JSON column |
| status         | `listed` \| `draft`                                              | yes                         | only `listed` spaces are visible to other people                                                                                                                                                |
| host           | `{id, name}`                                                     | yes                         | read-only; the signed-in user who created it, taken from the token, never from the body                                                                                                         |
| createdAt      | date                                                             | yes                         | assigned by the backend                                                                                                                                                                         |
| availableDesks | integer ≥ 0 or `null`                                            | yes                         | read-only, computed on every read: `deskCount` minus confirmed bookings covering the current hour; `null` for non-desk spaces and while the space is closed                                     |
| bookingCounts  | `{active, pending}`                                              | only in the host's own list | read-only; returned only when `hostId` is the signed-in user's own id, left out of the response otherwise                                                                                       |

**Booking unit (derived from `category`, not stored):** a `desk` space is booked one desk per booking (the guest does not pick which desk) and costs `pricePerHour × hours`. `meeting-room`, `office` and `event-hall` are booked as a whole: one booking takes the entire space and costs `pricePerHour × hours`.

**Relations:** a space belongs to one user with `isHost = true` (the host); a host has many spaces. A space has many bookings and is saved by many users (favorites). Deleting a space deletes its bookings and favorites.

**Access rules:** anyone, signed in or not, can list and view `listed` spaces; only a signed-in user with `isHost = true` can create a space; only its host can edit or delete it, or see it while it is a `draft` (others get `404`). A space with active bookings cannot be deleted.

| Route                                                                                                 | Auth                       | Body                                                                           | Response                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/spaces?search=&category=&city=&hostId=&favoriteOf=&status=&minPrice=&maxPrice=&page=&size=` | no (yes with `favoriteOf`) |                                                                                | `200 {total, items, pages}`, newest first; filters below; `401 invalid_token` when an invalid or expired token is sent; `422` for a filter out of range                                                                    |
| `GET /api/spaces/:id`                                                                                 | no                         |                                                                                | `200` space, `401 invalid_token` when an invalid or expired token is sent, `404 space_not_found` (also for someone else's draft), `422` for an invalid id                                                                  |
| `POST /api/spaces`                                                                                    | host                       | all fields except `id`, `host`, `createdAt`, `availableDesks`, `bookingCounts` | `201` space, `401`, `403 not_a_host` ("Only hosts can create spaces"), `409 space_conflict` (rare, see below), `422`                                                                                                       |
| `PATCH /api/spaces/:id`                                                                               | owner                      | any subset of the fields above                                                 | `200` space, `401`, `403 not_space_owner` ("Only the host can change this space"), `404` (also for someone else's draft), `409 space_conflict` (rare, see below), `422` (the space after the change is checked as a whole) |
| `DELETE /api/spaces/:id`                                                                              | owner                      |                                                                                | `204`, `401`, `403 not_space_owner`, `404` (also for someone else's draft), `409 space_has_active_bookings` ("This space has 2 active bookings")                                                                           |

**Built so far (backend):** bookings and favorites do not exist yet. Until they do, `availableDesks` is `deskCount` while the space is open, `bookingCounts` is `{active: 0, pending: 0}`, `DELETE` never answers `409`, and `favoriteOf` is ignored: the list comes back unfiltered, so the Favorites page must not use it yet. Only users with `isHost = true` can create a space, but no route sets `isHost` yet (it comes with `PATCH /api/users/:id`).

`409 space_conflict` ("The space could not be saved, please try again") means the database refused a write the input checks had let through, in practice only a race such as the host's account being deleted during the request; the client may retry.

List filters: `search` (at most 80 characters) matches the name or the city, case-insensitive (on SQLite only ASCII letters fold). `city` (at most 80 characters) matches exactly, case-insensitive. A signed-in user's own drafts appear in every list unless `status=listed` is given. `hostId` lists one host's spaces; when it is the signed-in user's own id, every space also has `bookingCounts`. `favoriteOf` lists the spaces a user saved, newest saved first, and is only allowed with the signed-in user's own id (`401` without a token, `403` for another id). `status=listed` is what guests use. `minPrice` and `maxPrice` (0–1000, finite numbers) filter `pricePerHour` in EUR, both inclusive. Other people's drafts are never returned.

## Booking

A guest books a space for one date and a time slot in whole hours. Code: backend `app/bookings/`; frontend `src/features/bookings/`, `src/lib/booking.ts`.

| Field      | Type                                                                             | Required | Notes                                                                            |
| ---------- | -------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| id         | number                                                                           | yes      | assigned by the backend                                                          |
| spaceId    | number                                                                           | yes      | the booked space                                                                 |
| space      | `{id, name, address, hostId}`                                                    | yes      | read-only summary joined by the backend                                          |
| guest      | `{id, name, avatarUrl}`                                                          | yes      | read-only; the signed-in user, taken from the token, never from the body         |
| date       | `YYYY-MM-DD`                                                                     | yes      | local date in Podgorica                                                          |
| startTime  | `HH:mm`, whole hour                                                              | yes      | inside the space's opening hours for that weekday                                |
| endTime    | `HH:mm`, whole hour                                                              | yes      | after `startTime`, at most the closing time                                      |
| totalPrice | number ≥ 0, EUR                                                                  | yes      | read-only; `pricePerHour × hours` at the moment of booking, never changes later  |
| status     | `pending` \| `confirmed` \| `declined` \| `cancelled` \| `finished` \| `expired` | yes      | always `pending` on create; `finished` and `expired` are never stored, see below |
| createdAt  | date                                                                             | yes      | assigned by the backend                                                          |

**Status flow:** `pending` → `confirmed` (the host approves), `declined` (the host says no) or `cancelled`; `confirmed` → `cancelled`. Once the slot has ended (`date` + `endTime`, Podgorica time), the backend returns a `confirmed` booking as `finished` and a `pending` one as `expired`; the stored status does not change. `declined`, `cancelled`, `finished` and `expired` are final. Any other change returns `422 invalid_status_change`.

**Active** bookings are the upcoming `pending` and `confirmed` ones; only they count in `bookingCounts` and block deleting the space.

**Overlap rule:** a slot is the half-open interval `[startTime, endTime)`, so 10:00–12:00 and 12:00–14:00 do not overlap. Only `confirmed` bookings take up room.

- `meeting-room`, `office`, `event-hall`: at most one confirmed booking at any hour.
- `desk`: at most `deskCount` confirmed bookings at any hour.
- The limit is checked hour by hour. Example: `deskCount = 2`, confirmed 09:00–10:00 and 11:00–12:00; a new 09:00–12:00 is allowed, because no single hour has more than one desk taken.

The rule is checked on create and again on confirm. A full slot returns `409 slot_full` ("No desks left at 10:00" or "This space is already booked at 15:00"). A slot outside opening hours, not on whole hours, or with the end before the start returns `422 invalid_slot`; a date in the past returns `422 booking_in_past`.

**Relations:** a booking belongs to one space (a space has many bookings) and to one user, the guest (a guest has many bookings). The host is the space's host.

**Access rules:** only a signed-in user can create a booking, and not for their own space; a guest sees and cancels only their own bookings, and can delete them only while `pending`; a host sees the bookings of their spaces and is the only one who can confirm or decline them, and can also cancel them. Nobody else ever gets a booking.

| Route                                                                   | Auth                                              | Body                                           | Response                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/bookings?spaceId=&guestId=&hostId=&status=&date=&page=&size=` | yes                                               |                                                | `200 {total, items, pages}`, sorted by date and start time; only bookings where the signed-in user is the guest or the host; `guestId` and `hostId` must be the user's own id (`403` otherwise); `status` matches the status as returned |
| `GET /api/bookings/:id`                                                 | guest or host                                     |                                                | `200` booking, `401`, `403 not_booking_participant`, `404 booking_not_found`                                                                                                                                                             |
| `POST /api/bookings`                                                    | yes                                               | `{spaceId, date, startTime, endTime}`          | `201` booking with `status: pending`, `401`, `403 cannot_book_own_space`, `404 space_not_found`, `409 slot_full`, `422`                                                                                                                  |
| `PATCH /api/bookings/:id`                                               | guest (cancel) or host (confirm, decline, cancel) | `{status: confirmed \| declined \| cancelled}` | `200` booking, `401`, `403`, `404`, `409 slot_full` (on confirm), `422 invalid_status_change`                                                                                                                                            |
| `DELETE /api/bookings/:id`                                              | guest, only `pending`                             |                                                | `204`, `401`, `403`, `404`, `422 invalid_status_change`                                                                                                                                                                                  |

**Later (not built yet):** `GET /api/bookings/popular-times?spaceId=` (how booked the space usually is per hour, averaged over the last 8 weeks, only aggregates) and `GET /api/bookings/availability?spaceId=&date=&startTime=&endTime=` (`{available, freeDesks, message}` with the same overlap rule as `POST`). Both are open to everyone and never return anyone's bookings.

## Favorite

A space a user saved with the heart. Code: backend `app/favorites/`; frontend `src/features/favorites/`, `src/lib/favorite.ts`.

| Field     | Type   | Required | Notes                                                                          |
| --------- | ------ | -------- | ------------------------------------------------------------------------------ |
| userId    | number | yes      | read-only; the signed-in user, taken from the token                            |
| spaceId   | number | yes      | the saved space; only a space the user can view (`listed`, or their own draft) |
| createdAt | date   | yes      | assigned by the backend                                                        |

There is no separate id: a user saves a space at most once, so `userId` + `spaceId` is the key (unique in the database).

**Relations:** many-to-many between users and spaces: a user has many favorites, a space is saved by many users. Deleting a space or a user deletes its favorites.

**Access rules:** only a signed-in user can save or remove a favorite, and only their own; favorites are private.

| Route                            | Auth | Body        | Response                                                                                                                                                            |
| -------------------------------- | ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/favorites?page=&size=` | yes  |             | `200 {total, items, pages}`, newest saved first                                                                                                                     |
| `POST /api/favorites`            | yes  | `{spaceId}` | `201` favorite; `200` with the existing one unchanged when it is already saved; `401`; `404 space_not_found` if the space does not exist or the user cannot view it |
| `DELETE /api/favorites/:spaceId` | yes  |             | `204`, also when the space was not saved; `401`                                                                                                                     |

The cards on the Favorites page come from `GET /api/spaces?favoriteOf=<own id>&status=listed`.

## Starter example

`app/listings/` is the starter's example and is not part of this contract. It is removed, with a migration, once `spaces` works.
