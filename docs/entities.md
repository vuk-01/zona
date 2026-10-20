# Entities

> This file is the contract between the frontend and the backend (next workshop).
> For each entity: fields with types, relations, and who is allowed to do what.
> The entity type lives in `frontend/src/features/<name>/types.ts` and the mock API in
> `frontend/src/features/<name>/api/<name>-api.ts`.

## Listing (example, replace with your own)

Code: `frontend/src/features/listings/` (`types.ts`, `api/listings-api.ts`, `api/use-listings.ts`).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | number | yes | assigned by the backend |
| title | string, 3–80 characters | yes | |
| description | string | no | |
| price | number ≥ 0, EUR | yes | |
| category | `games` \| `consoles` \| `accessories` | yes | |
| city | string | yes | |
| imageUrl | URL | no | |
| createdAt | date | yes | assigned by the backend |

**Relations:** a listing belongs to one user (the seller).

**Access rules:** everyone can see listings; only a signed-in user can create one; only the author can edit or delete their listing.

**API the frontend expects:** `GET /listings?search=`, `GET /listings/:id`, `POST /listings`, `PATCH /listings/:id`, `DELETE /listings/:id`.

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
| mode | `guest` \| `host` | yes | the mode the app is in right now; `guest` on sign-up; `host` is only possible when `isHost` is `true`. Returned only to the user themselves |
| createdAt | date | yes | assigned by the backend; shown as "Joined October 2026" |

**Public profile:** `PublicUser` is `User` without `email` and `mode`. This is what other people get
(a guest looking at a host, a host looking at a guest).

**Guest and host mode:** one account, two modes, no role choice at sign-up. The switch button in
Profile sends `PATCH /users/:id { mode }`: "Switch to hosting" sets `mode: host` (and `isHost: true`
the first time), "Switch to renting" sets `mode: guest` and keeps `isHost`. The mode changes the
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
  (email, password → User; 401 "Wrong email or password"), `POST /auth/logout`, `GET /auth/me` (User,
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
| description | string | no | shown on the space page |
| category | `desk` \| `meeting-room` \| `office` \| `event-hall` | yes | UI labels: Desk, Meeting room, Office, Event hall |
| city | string | yes | |
| address | string | yes | street and number |
| pricePerHour | number ≥ 0, EUR | yes | `desk`: price for **one desk** per hour; other categories: price for the whole space per hour |
| capacity | integer ≥ 1 | yes | maximum number of people in the space, for every category |
| deskCount | integer ≥ 1 | only for `desk` | number of bookable desks; absent for other categories |
| images | URL[], at least 1 | yes | the first one is the cover photo |
| openingHours | object `mon`…`sun` → `{ open: "HH:mm", close: "HH:mm" }` or `null` | yes | `null` = closed that day; local time (Europe/Podgorica) |
| status | `listed` \| `draft` | yes | only `listed` spaces are visible to guests |
| host | `{ id: number, name: string }` | yes | read-only; set by the backend from the signed-in user, never sent by the client |
| createdAt | date | yes | assigned by the backend |

**Booking unit (derived from `category`, not stored):** a `desk` space is booked one desk per booking
(the guest does not pick which desk) and costs `pricePerHour × hours`. `meeting-room`, `office` and
`event-hall` are booked as a whole: one booking takes the entire space and costs `pricePerHour × hours`.
How many bookings fit in the same hour is described under **Booking → Overlap rule**.

**Relations:** a space belongs to one user with `isHost = true` (the host, see **User**); a host can
have many spaces. A space has many bookings (see **Booking**).

**Access rules:** anyone, signed in or not, can list and view `listed` spaces; only a signed-in user
with `isHost = true` can create a space; only its host can edit or delete it, or see it while it is a
`draft`.

**API the frontend expects:** `GET /spaces?search=&category=&city=&hostId=` (search matches the name; `hostId` lists one host's
spaces),
`GET /spaces/:id` (404 if it does not exist), `POST /spaces` (all fields except `id`, `host`,
`createdAt`), `PATCH /spaces/:id` (any subset of those fields), `DELETE /spaces/:id`. A `desk` space
without a valid `deskCount` is rejected with 400; for other categories `deskCount` is dropped.

## Booking

A guest books a space for one date and a time slot in whole hours. Code: `frontend/src/features/bookings/`
(`types.ts`, `api/bookings-api.ts`, `api/use-bookings.ts`).

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
| status | `pending` \| `confirmed` \| `cancelled` | yes | always `pending` on create |
| createdAt | date | yes | assigned by the backend |

**Status flow:** `pending` → `confirmed` (by the host) or `cancelled`; `confirmed` → `cancelled`.
`cancelled` is final.

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
409 if confirming breaks the overlap rule), `DELETE /bookings/:id` (only `pending`).
The mock takes the space as an extra argument for `create` and confirm; the backend looks it up by
`spaceId` instead.
