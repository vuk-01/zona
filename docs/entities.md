# Entities

> This file is the contract between the frontend and the backend (next workshop).
> For each entity: fields with types, relations, and who is allowed to do what.
> The entity type lives in `frontend/src/features/<name>/types.ts` and the mock API in
> `frontend/src/features/<name>/api/<name>-api.ts`.

## User

The account. One type, `User` in `frontend/src/lib/user.ts`, shared by two features:
- `frontend/src/features/auth/`: sign-up, login, logout and the signed-in user (`GET /auth/me`)
- `frontend/src/features/users/`: profiles and the guest/host mode switch (`types.ts`, `api/users-api.ts`, `api/use-users.ts`)

The mock users live in one table in `frontend/src/lib/mock-db.ts`, used by both features.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | number | yes | assigned by the backend |
| name | string, 2–60 characters | yes | trimmed |
| email | string, valid email, unique | yes | stored lowercase; returned **only to the user themselves** |
| password | string, at least 8 characters | yes | only sent on sign-up and login; stored as a hash, **never returned** |
| avatarUrl | URL \| `null` | yes | `null` after sign-up; the app then shows the user's initials |
| city | string | yes | empty after sign-up |
| bio | string, at most 200 characters | yes | short "about me"; empty after sign-up |
| isHost | boolean | yes | hosting is turned on; `false` on sign-up, becomes `true` the first time the user switches to host mode and stays `true` |
| mode | `guest` \| `host` | yes | the mode the app is in right now; `guest` on sign-up and on every login; `host` is only possible when `isHost` is `true`. Returned only to the user themselves |
| createdAt | date | yes | assigned by the backend; shown as "Joined October 2026" |

**Public profile:** `PublicUser` is `User` without `email` and `mode`. This is what other people get
(a guest looking at a host, a host looking at a guest).

**Guest and host mode:** one account, two modes, no role choice at sign-up. The switch button in
Profile sends `PATCH /users/:id { mode }`: "Switch to hosting" sets `mode: host` (and `isHost: true`
the first time), "Switch to renting" sets `mode: guest` and keeps `isHost`. Every login starts in
guest mode, also for hosts, so the app always opens as a guest; a reload keeps the current mode. The mode changes the
navigation and the home screen; it never changes what the user owns, so a host in guest mode keeps
their spaces.

**Relations:** a host (`isHost = true`) has many spaces (`Space.host.id`); a guest has many bookings
(`Booking.guest.id`). The same user can have both. The users feature does not load spaces or bookings
itself: a route in `frontend/src/app/routes/` combines the profile with `GET /spaces?hostId=` and
`GET /bookings?guestId=`.

**Access rules:** anyone, signed in or not, can browse, search and view spaces and public profiles;
booking a space and listing a space require a signed-in user; a user can see their full profile
(with email and mode) and edit or delete only their own account.

**API the frontend expects:**
- Auth: `POST /auth/signup` (name, email, password → User, starts a session), `POST /auth/login`
  (email, password → User with `mode: guest`; 401 "Wrong email or password"), `POST /auth/logout`, `GET /auth/me` (User,
  or 401 when signed out). Sign-up with an existing email returns 409 "Email already in use". Google
  login and password reset come later.
- Users: `GET /users?search=&isHost=` (→ PublicUser[]), `GET /users/:id` (→ PublicUser; 404 if it does
  not exist), `POST /users` (name, email, password → User; in the app this is done by
  `POST /auth/signup`), `PATCH /users/:id` (own account only; any of `name`, `avatarUrl`, `city`, `bio`,
  `mode` → User; 400 if `name` or `bio` is out of range), `DELETE /users/:id` (own account only; ends
  the session).

## Space

A space a host rents out by the hour. Code: `frontend/src/features/spaces/` (`types.ts`, `api/spaces-api.ts`, `api/use-spaces.ts`).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | number | yes | assigned by the backend |
| name | string, 3–80 characters | yes | |
| description | string, at most 500 characters | no | shown on the space page |
| category | `desk` \| `meeting-room` \| `office` \| `event-hall` | yes | UI labels: Desk, Meeting room, Office, Event hall |
| city | string | yes | |
| address | string | yes | street and number |
| pricePerHour | number > 0 and ≤ 1000, EUR, at most 2 decimals | yes | `desk`: price for **one desk** per hour; other categories: price for the whole space per hour |
| capacity | integer 1–1000 | yes | maximum number of people in the space, for every category |
| deskCount | integer ≥ 1 and ≤ `capacity` | only for `desk` | number of bookable desks; absent for other categories |
| images | http(s) URL[], 1–8 | yes | the first one is the cover photo |
| openingHours | object `mon`…`sun` → `{ open: "HH:mm", close: "HH:mm" }` or `null` | yes | `null` = closed that day; local time (Europe/Podgorica); whole hours (`close` may be `24:00`), `close` after `open`, open on at least one day |
| status | `listed` \| `draft` | yes | only `listed` spaces are visible to guests |
| host | `{ id: number, name: string }` | yes | read-only; set by the backend from the signed-in user, never sent by the client |
| createdAt | date | yes | assigned by the backend |
| availableDesks | integer ≥ 0 \| `null` | yes | read-only, computed on every read: `deskCount` minus confirmed bookings covering the current hour; `null` for non-desk spaces and while the space is closed. Never sent by the client |

**Booking unit (derived from `category`, not stored):** a `desk` space is booked one desk per booking
(the guest does not pick which desk) and costs `pricePerHour × hours`. `meeting-room`, `office` and
`event-hall` are booked as a whole: one booking takes the entire space and costs `pricePerHour × hours`.
How many bookings fit in the same hour is described under **Booking → Overlap rule**.

**Relations:** a space belongs to one user with `isHost = true` (the host, see **User**); a host can
have many spaces. A space has many bookings (see **Booking**) and can be saved by many users (see
**Favorite**).

**Access rules:** anyone, signed in or not, can list and view `listed` spaces; only a signed-in user
with `isHost = true` can create a space; only its host can edit or delete it, or see it while it is a
`draft`. A space with **active bookings** (see Booking) cannot be deleted: the host can delete it once
they are all finished, expired or cancelled.

**API the frontend expects:** `GET /spaces?search=&category=&city=&hostId=&favoriteOf=&status=&minPrice=&maxPrice=`
(`search` matches the name or the city, case-insensitive; `hostId` lists one host's spaces;
`favoriteOf` lists the spaces a user saved, newest saved first, and is only allowed with the signed-in
user's own id (403 otherwise; the Favorites page sends it with `status=listed`);
`status=listed` is what guests use, e.g. on Home and Explore; `minPrice`/`maxPrice` filter
`pricePerHour` in EUR, both inclusive; Explore's price chips send Under €10 → `maxPrice=9.99`,
€10–30 → `minPrice=10&maxPrice=30`, Over €30 → `minPrice=30.01`),
`GET /spaces/:id` (404 if it does not exist), `POST /spaces` (all fields except `id`, `host`,
`createdAt`, `availableDesks`, `bookingCounts`), `PATCH /spaces/:id` (any subset of those fields),
`DELETE /spaces/:id` (409 "This space has 2 active bookings" when it has any). A `desk` space without a
valid `deskCount` is rejected with 400; for other categories `deskCount` is dropped. Any other field that
breaks the rules in the table is rejected with 400 and a message the form can show under that field
(the form in `components/space-form.tsx` checks the same rules first). With `hostId` (the
host's own listing) every space also has `bookingCounts: { active: number, pending: number }`, so
"My spaces" shows them without loading the bookings.

## Booking

A guest books a space for one date and a time slot in whole hours. Code: `frontend/src/features/bookings/`
(`types.ts`, `api/bookings-api.ts`, `api/use-bookings.ts`). The `Booking` type and the status rule
(`statusNow`, `isActive`) are shared in `frontend/src/lib/booking.ts` and the mock rows are in
`db.bookings` in `frontend/src/lib/mock-db.ts`, because the spaces mock reads them to compute
`availableDesks` and for the delete rule. The backend does the same with a query; guests never get
other people's bookings.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | number | yes | assigned by the backend |
| spaceId | number | yes | the booked space |
| space | `{ id: number, name: string, address: string }` | yes | read-only summary joined by the backend |
| guest | `{ id: number, name: string }` | yes | read-only; set by the backend from the signed-in user |
| date | `YYYY-MM-DD` | yes | local date in Podgorica |
| startTime | `HH:mm`, whole hour | yes | inside the space's opening hours for that weekday |
| endTime | `HH:mm`, whole hour | yes | after `startTime`, at most the closing time |
| totalPrice | number ≥ 0, EUR | yes | read-only; `pricePerHour × hours` at the moment of booking, it does not change later |
| status | `pending` \| `confirmed` \| `cancelled` \| `finished` \| `expired` | yes | always `pending` on create; `finished` and `expired` are never stored, see below |
| createdAt | date | yes | assigned by the backend |

**Status flow:** `pending` → `confirmed` (by the host) or `cancelled`; `confirmed` → `cancelled`.
Once the slot has ended (`date` + `endTime`, Podgorica time), the backend returns a `confirmed` booking
as `finished` and a `pending` one (never confirmed) as `expired`; the stored status does not change.
`cancelled`, `finished` and `expired` are final: they cannot be confirmed, cancelled or deleted.
**Active** bookings are the upcoming `pending` and `confirmed` ones; only they count on "My spaces" and
block deleting the space. The `status` filter matches the status as returned (so `status=finished`
works).

**Overlap rule.** A slot is the half-open interval `[startTime, endTime)`, so 10:00–12:00 and
12:00–14:00 do not overlap. Only **confirmed** bookings take up room; `pending` and `cancelled` ones do
not.

- `meeting-room`, `office`, `event-hall`: at most **one** confirmed booking at any hour. Two confirmed
  bookings of the same space never overlap.
- `desk`: at most **`deskCount`** confirmed bookings at any hour. Each booking takes one desk; which desk
  is not chosen (picking a specific desk comes later).
- The limit is checked **hour by hour**, so what counts is the busiest hour, not the number of bookings
  that touch the slot. Example: `deskCount = 2`, confirmed 09:00–10:00 and 11:00–12:00; a new
  09:00–12:00 is allowed, because no single hour has more than one desk taken.

The rule is checked **on create** (a slot that confirmed bookings already fill is refused) and **again
on confirm**, because other bookings may have been confirmed in the meantime. Either way a full slot
returns 409 with a short message: "No desks left at 10:00" or "This space is already booked at 15:00".
A slot outside opening hours, not on whole hours, or with the end before the start returns 400.

**Relations:** a booking belongs to one space (a space has many bookings) and to one user, the guest
(a guest has many bookings, see **User**).
The host is the space's host.

**Access rules:** only a signed-in user can create a booking, and not for their own space; a guest
sees and cancels only their own bookings; a host sees the bookings of their spaces and is the only one
who can confirm them, and can also cancel them. Only a `pending` booking can be deleted (by its guest);
a confirmed booking is cancelled instead, so the history stays.

**API the frontend expects:** `GET /bookings?spaceId=&guestId=&status=&date=` (sorted by date and start
time), `GET /bookings/:id` (404 if it does not exist), `POST /bookings` (`spaceId`, `date`,
`startTime`, `endTime` → Booking with `status: pending`), `PATCH /bookings/:id` (`{ status }`;
409 if confirming breaks the overlap rule), `DELETE /bookings/:id` (only `pending`),
`GET /bookings/popular-times?spaceId=` (open to everyone, for "Popular time" on the space page:
`{ firstHour: 8, days: { mon: number[14] | null, … } }`, how booked the space usually is per hour
08:00–21:00 as 0–100, averaged over the last 8 weeks of bookings; `null` for a closed day; the whole
answer is `null` when the space has under 2 weeks of history, shown as "Not enough data yet"; only
aggregates, never individual bookings),
`GET /bookings/availability?spaceId=&date=&startTime=&endTime=` (open to everyone, for the space page:
`{ available: boolean, freeDesks: number | null, message: string | null }` with the same overlap rule
as `POST`; `freeDesks` is the number of desks free at the busiest hour of the slot, `null` for
whole-space categories; it never returns anyone's bookings; 400 for a slot outside opening hours).
`POST /bookings` also returns 400 for a date in the past and "You cannot book your own space" when the
signed-in user is the space's host.
The mock takes the space (and, for `create`, the signed-in guest) as extra arguments; the backend
looks the space up by `spaceId` and takes the guest from the session.

## Favorite

A space a user saved with the heart on a space card or the space page. Code:
`frontend/src/features/favorites/` (`api/favorites-api.ts`, `api/use-favorites.ts`,
`components/favorite-button.tsx`). The `Favorite` type is shared in `frontend/src/lib/favorite.ts` and
the mock rows are in `db.favorites` in `frontend/src/lib/mock-db.ts`, because the spaces mock reads them
for `GET /spaces?favoriteOf=`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| userId | number | yes | read-only; set by the backend from the signed-in user |
| spaceId | number | yes | the saved space; only a space the user can view (`listed`, or their own draft) |
| createdAt | date-time | yes | assigned by the backend; Favorites shows the newest saved first |

There is no separate id: a user saves a space at most once, so `userId` + `spaceId` is the key.

**Relations:** a favorite belongs to one user and one space; a user has many favorites, a space is saved
by many users. Deleting a space deletes its favorites.

**Access rules:** only a signed-in user can save or remove a favorite, and only their own; favorites are
private (nobody else sees who saved what). A visitor's click on a heart goes to `/login?redirect=…`.

**API the frontend expects:** `GET /favorites` (the signed-in user's favorites, newest first →
Favorite[]), `POST /favorites` (`{ spaceId }` → Favorite; saving a space that is already saved returns
the saved one unchanged, so repeated clicks are safe; 404 if the space does not exist or the user cannot
view it), `DELETE /favorites/:spaceId` (204, also when the space was not saved). The cards on the
Favorites page come from `GET /spaces?favoriteOf=<own id>&status=listed` (see **Space**). The mock
takes the user's id as an extra argument; the backend takes it from the session.
