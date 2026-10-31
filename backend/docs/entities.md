# Entities

> This file is the contract between the frontend and the backend.
> For each entity: fields with types, relations, who is allowed to do what, and the routes.
> The backend code lives in `backend/app/<name>/` (`models/`, `schemas/`, `repositories/`, `services/`, `api/`,
> `exceptions/`, `routes.py`); the frontend's entity type is `frontend/src/features/<name>/types.ts` and its API
> functions `frontend/src/features/<name>/api/<name>-api.ts`. This file has two identical copies, `docs/entities.md`
> at the repo root and `backend/docs/entities.md`: a change here goes into both copies and the frontend, in the same PR.

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
- `GET` lists are paginated: `?page=1&size=50` (page ≥ 1, size 1–500, otherwise `422`) answers `{"total", "items", "pages"}`, newest first unless the route says otherwise (bookings are earliest first)
- Every error has one shape: `{"detail": "...", "code": "snake_case_code"}` plus `fieldErrors` when a field is at fault; 401 responses also carry `WWW-Authenticate: Bearer`

| Status | When                                           | Body                                                                                                                                     |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 401    | missing token / invalid token / wrong password | `{"detail": "Authentication required", "code": "not_authenticated"}` / `"invalid_token"` / `"invalid_credentials"`                       |
| 403    | signed in, but not the owner                   | `{"detail": "Only the host can change this space", "code": "not_space_owner"}`                                                           |
| 404    | record does not exist                          | `{"detail": "Space not found", "code": "space_not_found"}`                                                                               |
| 409    | email already registered                       | `{"detail": "Email is already registered", "code": "email_already_registered", "fieldErrors": {"email": "Email is already registered"}}` |
| 422    | invalid input                                  | `{"detail": "Validation failed", "code": "validation_error", "fieldErrors": {"name": "String should have at least 3 characters"}}`       |

## User

Code: backend `backend/app/users/` and `backend/app/auth/`; frontend `frontend/src/lib/user.ts`, `frontend/src/features/auth/`, `frontend/src/features/users/`.

| Field     | Type                           | Required | Notes                                                                                                             |
| --------- | ------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| id        | number                         | yes      | assigned by the backend                                                                                           |
| name      | string, 2–60 characters        | yes      | trimmed                                                                                                           |
| email     | string, valid email            | yes      | unique, stored lowercase; returned only to the user themselves                                                    |
| avatarUrl | http(s) URL, at most 500 characters, or `null` | yes      | trimmed; `null` after register; the app then shows the user's initials; a `PATCH` with `null` removes the photo           |
| city      | string, at most 80 characters  | yes      | trimmed; `""` after register                                                                                      |
| bio       | string, at most 200 characters | yes      | trimmed; `""` after register                                                                                      |
| isHost    | boolean                        | yes      | `false` on register; becomes `true` the first time the user switches to host mode and stays `true`                |
| mode      | `guest` \| `host`              | yes      | `guest` on register; remembered across logins; `host` only when `isHost` is `true` (a database constraint); returned only to the user themselves |
| createdAt | date                           | yes      | assigned by the backend                                                                                           |

The password is sent only on register (8–72 characters) and login (1–72 characters); it is stored as a bcrypt hash and never returned.

**Public profile:** `PublicUser` is `User` without `email` and `mode`. Other people only ever get `PublicUser`.

**Guest and host mode:** one account, two modes, no role choice at register. `PATCH /api/users/:id {mode: "host"}` sets `mode: host` and `isHost: true`; `{mode: "guest"}` sets `mode: guest` and keeps `isHost`. The mode is remembered across logins: login returns the mode the user chose last. The mode never changes what the user owns: a host in guest mode keeps their spaces.

**Profile edits:** `PATCH` changes only the fields that are sent; other keys (`email`, `id`, anything unknown) are ignored; `{}` answers `200` with the user unchanged. `null` is allowed only for `avatarUrl`; `null` for `name`, `city`, `bio` or `mode` answers `422`. An account deleted while its `PATCH` or `DELETE` runs answers `404 user_not_found`.

**Logout:** there is no backend route; the frontend deletes the token.

**Relations:** a user with `isHost = true` has many spaces (`Space.host`); a user has many bookings as a guest (`Booking.guest`) and many favorites. Deleting a user deletes their spaces, bookings and favorites.

**Access rules:** anyone, signed in or not, can view public profiles; a user gets their full profile (with `email` and `mode`) from `/api/auth/me` and from their own `PATCH`; only the user can edit or delete their own account.

| Route                                        | Auth | Body                                               | Response                                                                                      |
| -------------------------------------------- | ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST /api/auth/register`                    | no   | `{name, email, password}`                          | `201 {token, user}`, `409 email_already_registered`, `422`                                    |
| `POST /api/auth/login`                       | no   | `{email, password}`                                | `200 {token, user}` with the stored mode (the last one used), `401 invalid_credentials` ("Wrong email or password"), `422` |
| `GET /api/auth/me`                           | yes  |                                                    | `200` user, `401`                                                                             |
| `GET /api/users?search=&isHost=&page=&size=` | no   |                                                    | `200 {total, items, pages}` of `PublicUser`, newest first; `search` (at most 80 characters) matches the name, case-insensitive (on SQLite only ASCII letters fold); `isHost` is `true` or `false`; `401 invalid_token`; `422` |
| `GET /api/users/:id`                         | no   |                                                    | `200` `PublicUser`, `401 invalid_token`, `404 user_not_found` ("User not found"), `422` for an invalid id |
| `PATCH /api/users/:id`                       | self | any subset of `{name, avatarUrl, city, bio, mode}` | `200` user, `401`, `403 not_account_owner` ("Only the account owner can change this account"), `404`, `422` for an invalid id or field |
| `DELETE /api/users/:id`                      | self |                                                    | `204`, `401`, `403 not_account_owner`, `404`, `422` for an invalid id; afterwards the token answers `401 invalid_token` |

## Space

A space a host rents out by the hour. Code: backend `backend/app/spaces/`; frontend `frontend/src/features/spaces/`.

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
| availableDesks | integer ≥ 0 or `null`                                            | yes                         | read-only, computed on every read: `deskCount` minus confirmed bookings covering the current hour (Podgorica time), never below 0 (a `PATCH` that lowers `deskCount` does not check bookings yet); `null` for non-desk spaces and while the space is closed                                     |
| bookingCounts  | `{active, pending}`                                              | only in the host's own list | read-only; returned only when `hostId` is the signed-in user's own id, left out of the response otherwise; `active` counts the active bookings (see Booking), `pending` the active ones that are `pending` |

**Booking unit (derived from `category`, not stored):** a `desk` space is booked one desk per booking (the guest does not pick which desk) and costs `pricePerHour × hours`. `meeting-room`, `office` and `event-hall` are booked as a whole: one booking takes the entire space and costs `pricePerHour × hours`.

**Relations:** a space belongs to one user with `isHost = true` (the host); a host has many spaces. A space has many bookings and is saved by many users (favorites). Deleting a space deletes its bookings and favorites.

**Access rules:** anyone, signed in or not, can list and view `listed` spaces; only a signed-in user with `isHost = true` can create a space; only its host can edit or delete it, or see it while it is a `draft` (others get `404`). A space with active bookings cannot be deleted.

| Route                                                                                                 | Auth                       | Body                                                                           | Response                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/spaces?search=&category=&city=&hostId=&favoriteOf=&status=&minPrice=&maxPrice=&page=&size=` | no (yes with `favoriteOf`) |                                                                                | `200 {total, items, pages}`, newest first (with `favoriteOf`: newest saved first); filters below; `401 invalid_token` when an invalid or expired token is sent; with `favoriteOf`: `401 not_authenticated` without a token, `403 not_own_favorites` ("You can only list your own favorites") for another id; `422` for a filter out of range                                                                    |
| `GET /api/spaces/:id`                                                                                 | no                         |                                                                                | `200` space, `401 invalid_token` when an invalid or expired token is sent, `404 space_not_found` (also for someone else's draft), `422` for an invalid id                                                                  |
| `POST /api/spaces`                                                                                    | host                       | all fields except `id`, `host`, `createdAt`, `availableDesks`, `bookingCounts` | `201` space, `401` (also `invalid_token` when the host's account is deleted while the request runs), `403 not_a_host` ("Only hosts can create spaces"), `422`                                                                                                       |
| `PATCH /api/spaces/:id`                                                                               | owner                      | any subset of the fields above                                                 | `200` space, `401`, `403 not_space_owner` ("Only the host can change this space"), `404` (also for someone else's draft), `422` (the space after the change is checked as a whole) |
| `DELETE /api/spaces/:id`                                                                              | owner                      |                                                                                | `204`, `401`, `403 not_space_owner`, `404` (also for someone else's draft), `409 space_has_active_bookings` ("This space has 2 active bookings", "This space has 1 active booking"; the space and its bookings stay), `422` for an invalid id; a `204` also deletes the bookings that are no longer active and the favorites                                                                           |

A space deleted while its `PATCH` or `DELETE` runs answers `404 space_not_found`.

List filters: `search` (at most 80 characters) matches the name or the city, case-insensitive (on SQLite only ASCII letters fold). `city` (at most 80 characters) matches exactly, case-insensitive. A signed-in user's own drafts appear in every list unless `status=listed` is given. `hostId` lists one host's spaces; when it is the signed-in user's own id, every space also has `bookingCounts`. `favoriteOf` lists the spaces a user saved, newest saved first, and is only allowed with the signed-in user's own id (`401` without a token, `403 not_own_favorites` for another id); it replaces the default order (there is no sort parameter), the other filters still narrow the list, and a saved space the user can no longer view is left out. `status=listed` is what guests use. `minPrice` and `maxPrice` (0–1000, finite numbers) filter `pricePerHour` in EUR, both inclusive. Other people's drafts are never returned.

## Booking

A guest books a space for one date and a time slot in whole hours. Code: backend `backend/app/bookings/`; frontend `frontend/src/features/bookings/`, `frontend/src/lib/booking.ts`.

| Field      | Type                                                                             | Required | Notes                                                                            |
| ---------- | -------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| id         | number                                                                           | yes      | assigned by the backend                                                          |
| spaceId    | number                                                                           | yes      | the booked space                                                                 |
| space      | `{id, name, address, hostId}`                                                    | yes      | read-only summary joined by the backend                                          |
| guest      | `{id, name, avatarUrl}`                                                          | yes      | read-only; the signed-in user, taken from the token, never from the body         |
| date       | `YYYY-MM-DD`                                                                     | yes      | local date in Podgorica; from today to 365 days after today; only `YYYY-MM-DD`, also in the `date` filter |
| startTime  | `HH:mm`, whole hour, `00:00`–`23:00`                                             | yes      | local time (Europe/Podgorica); inside the space's opening hours for that weekday |
| endTime    | `HH:mm`, whole hour, `01:00`–`24:00`                                             | yes      | after `startTime`, at most the closing time; `24:00` is midnight                 |
| totalPrice | number ≥ 0, EUR                                                                  | yes      | read-only; `pricePerHour × hours` at the moment of booking, never changes later  |
| status     | `pending` \| `confirmed` \| `declined` \| `cancelled` \| `finished` \| `expired` | yes      | always `pending` on create; `finished` and `expired` are never stored, see below |
| createdAt  | date                                                                             | yes      | assigned by the backend                                                          |

**Status flow:** `pending` → `confirmed` (the host approves), `declined` (the host says no) or `cancelled`; `confirmed` → `cancelled`. Once the slot has ended (`date` + `endTime`, Podgorica time), the backend returns a `confirmed` booking as `finished` and a `pending` one as `expired`; the stored status does not change. `declined`, `cancelled`, `finished` and `expired` are final. Any other change returns `422 invalid_status_change` ("Only a pending booking can be declined"), also a change to the status the booking already has ("Confirmed bookings cannot be confirmed again"): a repeat is an error, not idempotent. An `expired` booking cannot be confirmed. A change that a parallel request overtakes is not applied and answers `422 invalid_status_change` for the status the booking has by then ("Only a pending booking can be confirmed" after a parallel cancel, "This booking was confirmed meanwhile" when a cancel finds the booking confirmed).

**Local time:** `date`, `startTime` and `endTime` are wall-clock time in Podgorica. On the day the clocks go forward (2027-03-28) the hour 02:00–03:00 does not exist, and a slot that contains it answers `422 invalid_slot` (01:00–02:00 is fine, 01:00–03:00 and 02:00–03:00 are not). On the day the clocks go back (2026-10-25) 02:00 means the first of the two.

**Active** bookings are the upcoming `pending` and `confirmed` ones: the status as returned is `pending` or `confirmed`, so a booking whose slot is under way is still active and one whose slot has ended (`finished`, `expired`) is not. Only they count in `bookingCounts` and block deleting the space.

**Overlap rule:** a slot is the half-open interval `[startTime, endTime)`, so 10:00–12:00 and 12:00–14:00 do not overlap. Only `confirmed` bookings take up room.

- `meeting-room`, `office`, `event-hall`: at most one confirmed booking at any hour.
- `desk`: at most `deskCount` confirmed bookings at any hour.
- The limit is checked hour by hour. Example: `deskCount = 2`, confirmed 09:00–10:00 and 11:00–12:00; a new 09:00–12:00 is allowed, because no single hour has more than one desk taken.

The rule is checked on create and again on confirm. On create it is advice: a `pending` booking takes no room, so a booking created into a free slot can still be refused when it is confirmed. Parallel confirms of the same space wait for each other, so two of them never take the same last desk. A full slot returns `409 slot_full` ("No desks left at 10:00" or "This space is already booked at 15:00", the first full hour).

A slot that breaks the rules returns `422 invalid_slot` with the message in `detail` and on the field at fault in `fieldErrors` (the space's name, here "Glass Room", and the hours come from the space): `startTime` or `endTime` not on a whole hour → that field, "Pick a whole hour"; `endTime` not after `startTime` → `endTime`, "End must be after the start"; the space closed on that weekday → `date`, "Glass Room is closed on that day"; a start before opening → `startTime`, and an end after closing → `endTime`, both "Glass Room is open 08:00–20:00 on that day"; a slot that contains an hour that does not exist that day → `startTime` when it is the start hour, `endTime` otherwise, "02:00 does not exist on that day" (the first missing hour). A start that is not strictly after now (Podgorica time) returns `422 booking_in_past` ("Pick a time that has not started yet") with `fieldErrors.startTime`; a booking that starts exactly now is in the past. `startTime` or `endTime` that is not `HH:mm` with hours `00`–`23` and minutes `00`–`59` (`endTime` may also be `24:00`) is `422 validation_error`, for example `9:00`, `25:00` or a `startTime` of `24:00`; a valid time off the whole hour (`10:30`) is `invalid_slot`. Hours and minutes are ASCII digits `0`–`9`; any other digit is `validation_error`.

**Booking window:** `date` is checked first, before the slot. A date before today (Podgorica) returns `422 booking_in_past` with `fieldErrors.startTime`, also on a day the space is closed. A date more than 365 days after today returns `422 booking_too_far_ahead` ("Pick a date within the next 365 days") with `fieldErrors.date`; today + 365 days is still allowed. A `date` that is not a `YYYY-MM-DD` string (a number, `2026-11-04T00:00:00`) is `422 validation_error` with `fieldErrors.date` "Use the format YYYY-MM-DD", in the body and in the `date` filter of `GET /api/bookings`.

**Relations:** a booking belongs to one space (a space has many bookings) and to one user, the guest (a guest has many bookings). The host is the space's host. Deleting the space or the guest deletes the booking.

**Access rules:** only a signed-in user can create a booking, and not for their own space; a guest sees and cancels only their own bookings, and can delete them only while `pending`; a host sees the bookings of their spaces and is the only one who can confirm or decline them, and can also cancel them. Nobody else ever gets a booking. Bookings are filtered by who takes part, not by whether the space is listed: a guest keeps seeing and cancelling a booking after the host turns the space into a draft.

| Route                                                                   | Auth                                              | Body                                           | Response                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/bookings?spaceId=&guestId=&hostId=&status=&date=&page=&size=` | yes                                               |                                                | `200 {total, items, pages}`, earliest first (by date, start time and id); only bookings where the signed-in user is the guest or the space's host; `guestId` and `hostId` must be the user's own id (`403 not_own_bookings`, "You can only list your own bookings"); `spaceId` and `date` (`YYYY-MM-DD`) narrow the list; `status` matches the status as returned (`finished` and `expired` included); `401`; `422` for an invalid filter, `page` or `size` |
| `GET /api/bookings/:id`                                                 | guest or host                                     |                                                | `200` booking, `401`, `403 not_booking_participant` ("Only the guest or the host can see this booking"), `404 booking_not_found` ("Booking not found"), `422` for an invalid id                                                         |
| `POST /api/bookings`                                                    | yes                                               | `{spaceId, date, startTime, endTime}`          | `201` booking with `status: pending`; `401` (also `invalid_token` when the user's account is deleted while the request runs); `403 cannot_book_own_space` ("You cannot book your own space"); `404 space_not_found` (also for another host's draft, and when the space is deleted while the request runs); `409 slot_full`; `422 invalid_slot`, `booking_in_past`, `booking_too_far_ahead` or `validation_error` |
| `PATCH /api/bookings/:id`                                               | guest (cancel) or host (confirm, decline, cancel) | `{status: confirmed \| declined \| cancelled}` | `200` booking; `401`; `403 not_booking_participant`, or `not_booking_host` ("Only the host can confirm or decline this booking") when the guest confirms or declines; `404 booking_not_found` (also when it is deleted while the request runs); `409 slot_full` (on confirm); `422 invalid_status_change`, or `validation_error` for an invalid id or body |
| `DELETE /api/bookings/:id`                                              | guest, only `pending`                             |                                                | `204`; `401`; `403 not_booking_participant`, or `not_booking_guest` ("Only the guest can delete this booking") for the host; `404 booking_not_found` (also when it is deleted while the request runs); `422 invalid_status_change` ("Only a pending booking can be deleted") when it is not `pending`, also when it has `expired`; `422` for an invalid id |
| `GET /api/bookings/availability?spaceId=&date=&startTime=&endTime=`     | no                                                |                                                | `200 {available, freeDesks, message}` with the same slot checks and overlap rule as `POST`, without a lock: the answer a confirm of that slot would give now. `available` is `false` when some hour of the slot is full; `freeDesks` is the desks free in the busiest hour of the slot (never below 0), `null` for a space booked whole; `message` is `null` when `available`, otherwise the `409 slot_full` detail ("No desks left at 10:00", "This space is already booked at 15:00"). A host may ask about their own space, also a draft (`POST` answers `403` there); `401 invalid_token` when an invalid or expired token is sent; `404 space_not_found` (also for another host's draft); `422 invalid_slot`, `booking_in_past`, `booking_too_far_ahead` or `validation_error` |
| `GET /api/bookings/popular-times?spaceId=`                              | no                                                |                                                | `200 {firstHour: 8, days: {mon…sun: number[14] or null}}`, or `200 null` when the space is younger than 14 days; `401 invalid_token` when an invalid or expired token is sent; `404 space_not_found` (also for another host's draft); `422` for a missing or invalid `spaceId` |

`availability` and `popular-times` are open to everyone and never return anyone's bookings, only counts. **Popular times:** the last 8 weeks (fewer when the space is younger), confirmed bookings only (returned as `finished` once their slot has ended), per weekday and hour from 08:00 to 21:00: booked units divided by units (`deskCount`, or 1 for a whole space), averaged over that weekday's dates, 0–100 rounded; `null` for a day the space is closed. The dates are the local dates (Podgorica) from yesterday back to 56 days before today, and not before the day after the space was created: today, future dates and the day of creation do not count, so each weekday has 8 dates unless the space was created within the last 56 days. A booked hour counts at most the space's units (`deskCount`, or 1 for a whole space), so a value is never above 100; the current `deskCount` and the current opening hours are used, and an hour outside the opening hours of an open day is `0`. Values are rounded half up (12.5 → 13). The whole answer is `null` while `createdAt` is less than 14 days (336 hours) before now; from exactly 14 days on it has values.

## Favorite

A space a user saved with the heart. Code: backend `backend/app/favorites/`; frontend `frontend/src/features/favorites/`, `frontend/src/lib/favorite.ts`.

| Field     | Type   | Required | Notes                                                                          |
| --------- | ------ | -------- | ------------------------------------------------------------------------------ |
| userId    | number | yes      | read-only; the signed-in user, taken from the token                            |
| spaceId   | number | yes      | the saved space; only a space the user can view (`listed`, or their own draft) |
| createdAt | date   | yes      | assigned by the backend                                                        |

The API has no id for a favorite: a user saves a space at most once, so `userId` + `spaceId` identifies it (unique in the database). The table's own `id` only orders favorites saved in the same second and is never returned.

**Idempotent:** saving a space that is already saved answers `200` with the favorite unchanged, and removing one that is not saved answers `204`; neither is an error, also when two requests do it at the same time.

**Relations:** many-to-many between users and spaces: a user has many favorites, a space is saved by many users. Deleting a space or a user deletes its favorites.

**Access rules:** only a signed-in user can save or remove a favorite, and only their own; favorites are private.

| Route                            | Auth | Body        | Response                                                                                                                                                            |
| -------------------------------- | ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/favorites?page=&size=` | yes  |             | `200 {total, items, pages}`, newest saved first; a saved space the user can no longer view (another host's space that became a draft) is left out, as with `favoriteOf`, and comes back when it is listed again; `401`; `422` for an invalid `page` or `size`                                                                                                                     |
| `POST /api/favorites`            | yes  | `{spaceId}` | `201` favorite; `200` with the existing one unchanged when it is already saved; `401` (also `invalid_token` when the user's account is deleted while the request runs); `404 space_not_found` if the space does not exist or the user cannot view it, also when it is deleted while the request runs; `422` |
| `DELETE /api/favorites/:spaceId` | yes  |             | `204`, also when the space was not saved; `401`; `422` for an invalid id                                                                                                                     |

The cards on the Favorites page come from `GET /api/spaces?favoriteOf=<own id>&status=listed`.

## Starter example

`backend/app/listings/` is the starter's example and is not part of this contract; the frontend never calls it. It stays as the reference domain that the agent instructions (`/new-entity`, the skills and rules in `backend/.claude/`) point to, and is removed, with a migration, after bookings is done and the instructions have moved to a more complete domain.
