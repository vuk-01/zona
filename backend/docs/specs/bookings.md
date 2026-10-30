# Bookings

## Goal
A signed-in guest books a listed space for one date and whole hours; the host confirms or declines.
A space never has more confirmed bookings in an hour than it has room for, also under parallel requests.
Delivery (the contract describes all of it from PR 1 on):

| PR | scope |
|---|---|
| 1 | `bookings` table, 5 routes, status flow, overlap under a space lock (ADR-023), local time (ADR-022), the whole contract |
| 2 | spaces: `availableDesks`, `bookingCounts`, `DELETE 409 space_has_active_bookings`; `GET /api/bookings/availability` |
| 3 | `GET /api/bookings/popular-times` |

Out of scope: frontend wiring (`docs/follow-ups.md`); `PATCH /api/spaces` against existing confirmed bookings
(follow-up, reuses `ISpaceRepository.lock(space_id)`, which `DELETE /api/spaces` takes in PR 2; confirm takes
`ISpaceRepository.lock_for_booking(booking_id)` instead); a booking window limit; removing `app/listings/`.

## Entities & fields
**Booking** (`bookings`, `app/bookings/`)

| field | type | required | limits | notes |
|---|---|---|---|---|
| id | int PK | yes | | backend |
| space_id | FK `spaces.id` ON DELETE CASCADE, index | yes | 1–2147483647 | body `spaceId` |
| guest_id | FK `users.id` ON DELETE CASCADE, index | yes | | from the token (ADR-006); JSON `guest {id, name, avatarUrl}` |
| date | DATE | yes | | local date in Europe/Podgorica; JSON `YYYY-MM-DD` |
| start_hour | SMALLINT | yes | CHECK 0–23 | JSON `startTime` `HH:00` |
| end_hour | SMALLINT | yes | CHECK 1–24, > start_hour | JSON `endTime` `HH:00`; `24:00` = midnight |
| total_price | NUMERIC(7,2) | yes | CHECK ≥ 0 | `pricePerHour × (end − start)` at create, never changes |
| status | VARCHAR(10) | yes | CHECK IN (pending, confirmed, declined, cancelled) | `pending` on create |
| ends_at | TIMESTAMP(tz) | yes | | internal: `date` + `endTime` in Podgorica as UTC; derives finished/expired in SQL |
| created_at | TIMESTAMP(tz), `server_default=now()` | yes | | backend |

Index `(space_id, date)` for the overlap query. JSON `space {id, name, address, hostId}` is joined (ADR-020).
Bookings are filtered by participation (`guest_id` or `Space.host_id` is the user), never by `space_visible_to`:
a guest keeps seeing and cancelling a booking after the host turns the space into a draft.
Returned status: `confirmed` and `ends_at <= now` → `finished`; `pending` and `ends_at <= now` → `expired`.
Relations: Space 1–N Booking, User 1–N Booking (guest), `passive_deletes`; deleting either deletes the bookings.

## Routes

| method | path | auth | body | responses |
|---|---|---|---|---|
| GET | `/api/bookings?spaceId=&guestId=&hostId=&status=&date=&page=&size=` | yes | | `200 Page[Booking]` where the user is guest or host, by date, start time, id; `401`; `403 not_own_bookings`; `422` |
| GET | `/api/bookings/{id}` | guest or host | | `200`; `401`; `403 not_booking_participant`; `404 booking_not_found`; `422` |
| POST | `/api/bookings` | yes | `{spaceId, date, startTime, endTime}` | `201` pending; `401`; `403 cannot_book_own_space`; `404 space_not_found`; `409 slot_full`; `422 invalid_slot` / `booking_in_past` / `validation_error` |
| PATCH | `/api/bookings/{id}` | guest or host | `{status: confirmed \| declined \| cancelled}` | `200`; `401`; `403 not_booking_participant` / `not_booking_host`; `404`; `409 slot_full` (confirm); `422 invalid_status_change` / `validation_error` |
| DELETE | `/api/bookings/{id}` | guest, only `pending` | | `204`; `401`; `403 not_booking_participant` / `not_booking_guest`; `404`; `422 invalid_status_change` |
| GET | `/api/bookings/availability?spaceId=&date=&startTime=&endTime=` | no | | `200 {available, freeDesks, message}`; `401 invalid_token`; `404 space_not_found`; `422 invalid_slot` / `booking_in_past` / `validation_error` (PR 2) |
| GET | `/api/bookings/popular-times?spaceId=` | no | | `200 {firstHour: 8, days: {mon…sun: number[14] \| null}}` or `200 null` when the space is younger than 14 days; `401 invalid_token`; `404`; `422` (PR 3) |

POST checks, in order: space visible (`ISpaceService.get`) → not own → slot (whole hours, start < end, inside the
weekday's opening hours, every hour exists that day) → start strictly after now → overlap (advisory) → INSERT in a
SAVEPOINT; IntegrityError (ADR-019): `not IUserRepository.exists(guest)` → `401 invalid_token`, then
`not ISpaceRepository.exists(space)` → `404`, else re-raise. `exists()`, not `get_by_id()`, by the project's rule
since the favorites review (a query every time, never an answer from the identity map). On POST `get_by_id()`
would happen to work: `ISpaceService.get` returns a schema, and the session holds unchanged rows only weakly, so
the space has left the identity map by then. The mid-request tests prove that each branch must exist: without
it a deleted space or guest answers `500`.
Confirm: `IBookingRepository.get_participants(booking_id)` (columns that never change: no booking → `404`, not
the guest or the host → `403 not_booking_participant`, both without the lock, ADR-024) →
`ISpaceRepository.lock_for_booking(booking_id)` as the first write (it finds the space through a subquery on
`bookings`, so nothing the rule depends on is read before the lock) → read → roles → transition → count confirmed
per hour (without itself) → compare-and-set on status. A slot is refused only when an hour in `[start, end)` does not
exist (DST). Cancel/decline/delete: compare-and-set, no lock. A compare-and-set that changes no row reads the status
again with a `select()` (not `db.get`: the first read is in the identity map): no row → `404 booking_not_found`,
another status → `422 invalid_status_change`; it never assumes the row is still there. Same status again → `422`
(not idempotent, ADR-021 does not apply).
Popular times: last 8 weeks (fewer if the space is younger), confirmed bookings only, per weekday and hour 08–21:
taken units / units (`deskCount` or 1) averaged over that weekday's dates, 0–100 rounded; `null` for a closed day.

## Access rules
- Booking: any signed-in user except the space's host; `guest_id` is `current_user.id`.
- Read: only the guest and the space's host; lists only ever contain those rows; `guestId`/`hostId` must be the own id.
- Host confirms or declines `pending`; guest or host cancels `pending`/`confirmed`; only the guest deletes, only `pending`.
- `availability` and `popular-times` are public, counts only, never anyone's bookings; another host's draft → `404`.

## Error cases

| status | when | detail | code |
|---|---|---|---|
| 401 | no / invalid token; POST by a user deleted during the request | Authentication required / Invalid or expired token | `not_authenticated` / `invalid_token` |
| 403 | `guestId`/`hostId` not the own id | You can only list your own bookings | `not_own_bookings` |
| 403 | not the guest or the host | Only the guest or the host can see this booking | `not_booking_participant` |
| 403 | guest confirms or declines | Only the host can confirm or decline this booking | `not_booking_host` |
| 403 | host deletes | Only the guest can delete this booking | `not_booking_guest` |
| 403 | host books own space | You cannot book your own space | `cannot_book_own_space` |
| 404 | unknown booking, or deleted during PATCH/DELETE | Booking not found | `booking_not_found` |
| 404 | unknown space, another host's draft, deleted during the request | Space not found | `space_not_found` |
| 409 | no room in some hour | No desks left at 10:00 / This space is already booked at 15:00 | `slot_full` |
| 422 | not whole hours, end ≤ start, outside opening hours, a nonexistent hour (DST) | e.g. Glass Room is open 08:00–20:00 on that day | `invalid_slot` + `fieldErrors` |
| 422 | start not strictly after now (Podgorica → UTC) | Pick a time that has not started yet | `booking_in_past` + `fieldErrors.startTime` |
| 422 | any other status change, incl. the same status | Confirmed bookings cannot be confirmed again / Only a pending booking can be declined | `invalid_status_change` |
| 422 | bad body, query or path | Validation failed | `validation_error` + `fieldErrors` |

## Done when
- [ ] Unit `test_bookings_api.py` (routing, 401, 422 shapes, 201/204, `/availability` not caught by `/{id}`), `test_bookings_service.py` (transitions table, roles, FK → 401/404)
- [ ] Integration `test_bookings.py`: every route happy path + 401/403/404/422; same status → `422 invalid_status_change`; expired cannot be confirmed; `booking_in_past` at exactly start; DST with a fixed `IClock`: 2026-10-25 `ends_at`/finished, 2027-03-28 `01–02` → 201, `01–03` and `02–03` → `422 invalid_slot`; lock leaves the space row unchanged; mid-request (second connection): space deleted on POST → 404, guest deleted → 401, booking deleted on PATCH/DELETE → 404 (on confirm the space lock already holds SQLite's write lock: delete in the request's own session, as `test_favorites.py` does); a parallel status change between the read and the compare-and-set → `422 invalid_status_change`
- [ ] `test_bookings_concurrency.py`: parallel confirms `[200, 409]` (whole space) and `[200, 200, 409]` (2 desks); control test without the lock overbooks; run on SQLite and Postgres
- [ ] PR 2: `availableDesks` never below 0 after deskCount is lowered; `bookingCounts` on own list only; `DELETE` 409 with the count; availability matches confirm
- [ ] Local DB backed up (`data/app-prije-bookings.db`) before `migrate`; migration read; `alembic check` clean
- [ ] Both `entities.md` copies identical and complete for all routes (PR 1); ADR-022, ADR-023; `docs/follow-ups.md`
- [ ] `poetry run lint && poetry run typecheck && poetry run test` green; `/review-changes` APPROVED
