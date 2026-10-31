# Follow-ups

Open items found while working on something else. Each one is a separate small PR; remove the entry
in the PR that fixes it.

## Backend: remove `app/listings/` after bookings

`backend/app/listings/` (the starter example) stays for now: the agent instructions use it as the
reference domain. Remove it once favorites and bookings are done, in this order, one commit each:

1. **Move the instructions to a more complete domain** (`app/spaces/` or bookings), copying excerpts
   from the real code (`anti-patterns.md` says its RIGHT halves are copied from the reference domain):
   - `backend/.claude/skills/backend-patterns/SKILL.md` (89 mentions), `.claude/rules/anti-patterns.md`
     (54), `.claude/skills/test-endpoint/SKILL.md` (23), `.claude/skills/check-n1/SKILL.md` (8)
   - `backend/CLAUDE.md` lines 14 and 44, `.claude/commands/new-entity.md` line 11
   - example names in `.claude/rules/backend-api.md`, `backend-tests.md`, `backend-db.md` and
     `.claude/frequent-mistakes.md` line 21; ADR-015 keeps `IListingService` (ADR texts are history)
2. **Code:** delete `backend/app/listings/` (5 routes under `/api/listings`), its router in
   `app/routes.py`, the `listings` relationship in `app/users/models/user.py`, the comment in
   `app/users/repositories/user.py`, `test_listings_api.py`, `test_listings.py`, the `listing_service`
   and `listing_id` fixtures and `delete(Listing)` in `clean_tables`, and `DEMO_LISTINGS` in `app/seed.py`.
3. **Migration:** back up the local DB first (`app-prije-listings.db`), then
   `poetry run makemigrations "drop listings"` and read it: `upgrade` drops `ix_listings_owner_id`
   and the table, `downgrade` recreates an empty table as in `7e6cf7ecb4d9`. On SQLite no other table is
   rebuilt (nothing points at `listings`), so no foreign-key guard is needed. Then `migrate`,
   `alembic check`, and an online upgrade on a copy of the DB.
4. **Docs:** the "Starter example" section in both `entities.md` copies, `backend/README.md` (seed line,
   the `app/listings/` tree, the `makemigrations` example, line 85), the seed description in `manage.py`.

**For the PR description:** `migrate` deletes the `listings` table and its rows for good (the
downgrade brings back an empty table); users and spaces are not touched. Everyone who pulls `main`
should back up `data/app.db` first.

## Frontend: "Load more" on Explore

`GET /api/spaces` returns 50 spaces per page by default (`{total, items, pages}`). Explore shows the
first page and counts all matches from `total` (`spaces-list.tsx`), so past 50 spaces the rest cannot
be reached; until then the count says "Showing 50 of 120 spaces". Add a "Load more" button
(`useInfiniteQuery` with `page`) under the grid. The bookings join, the category stats and My spaces
ask for the largest page, 500 (`MAX_PAGE_SIZE` in `src/lib/api-client.ts`); they need more pages once
a list grows past that.

## Frontend: lists capped at 500 and a second spaces query on Home

- **Category stats.** `useCategoryStats` (`features/spaces/hooks/use-category-stats.ts`) counts the
  categories, "open now" and the newest space from one page of 500. Past 500 listed spaces every
  number stops there, and Explore's list (`total`) and the hero panel disagree. Either a stats route
  on the backend (counts per category in one query) or the counts from `total` of one
  `size=1` request per category.
- **Favorites.** `favoritesApi.list` reads one page of 500 and drops `total`: a user's 501st saved
  space never shows a filled heart, and clicking it sends a `POST` that changes nothing. Read every
  page while `pages` says there are more, or give the hearts a check per visible space.
- **Two `/spaces` requests on Home.** The list asks for the default page (50) and the stats for 500,
  and `pagination` is part of the query key, so the same filters run twice. Let the list read the
  first `limit` cards from the stats query, or give both the same size.

## Frontend: connect bookings to the backend

The backend has `GET/POST/PATCH/DELETE /api/bookings` (branch `feat/bookings`, PR 1); the frontend
still uses the mock. When the frontend is connected:

- `frontend/src/features/bookings/api/bookings-api.ts`: a real `fetch` for every route; `list` reads
  `items` from the paginated answer.
- Until then the mock follows the contract: a `PATCH` to the status the booking already has answers
  `422 invalid_status_change` (not idempotent), and `create` answers `422 booking_in_past` for a start
  that is not strictly after now.
- The status buttons (`components/reservation-actions.tsx`, `components/booking-card.tsx`) are disabled
  while their mutation is pending, so a double click does not send the same change twice.
- Local time is Europe/Podgorica, not the browser's zone: `statusNow` in `frontend/src/lib/booking.ts`,
  `localToday` in `bookings-api.ts` (`Intl.DateTimeFormat` without `timeZone` today) and
  `hooks/use-booking-slot.ts`.
- `422 invalid_slot` and `422 booking_in_past` map to `InvalidBookingError`, with `fieldErrors` on
  the field at fault.
- **Booking window.** The backend takes a `date` from today to 365 days ahead (Podgorica) and answers
  `422 booking_too_far_ahead` ("Pick a date within the next 365 days", `fieldErrors.date`) after that,
  and `booking_in_past` for a date before today before any slot check. The mock's `create` in
  `bookings-api.ts` checks only the past (with its own message, "Pick today or a later date"):
  give it the same two checks, and map `booking_too_far_ahead` to `InvalidBookingError` on `date`.
  The date picker allows 60 days (`BOOKABLE_DAYS` in `hooks/use-booking-slot.ts`), so the UI never
  reaches the limit today; decide whether the picker stays at 60 or follows the backend's 365.
- **PR 4 of the wiring plan: the space on a booking card.** My bookings and Reservations
  (`app/routes/bookings.tsx`, `host-reservations.tsx`) join each booking to a space from
  `GET /spaces?size=500`. That list never has other people's drafts, so a booking on a space whose host
  turned it into a draft loses its photo and details (and past 500 spaces some are missing anyway).
  Use the `space` summary the booking answer already carries (`{id, name, address, hostId}`); for the
  photo, add the cover image to that summary on the backend (`GET /spaces/:id` is a 404 for someone
  else's draft too, so fetching it by id does not help).
- **Since bookings PR 2:** `GET /api/bookings/availability` answers `{available, freeDesks, message}`
  for a slot before it is sent; `availability` in `bookings-api.ts` (mock, same shape) becomes a
  `fetch` of that route.

## Frontend: Delete account on Profile

`useDeleteAccount` (`frontend/src/features/users/api/use-users.ts`) calls `DELETE /api/users/:id`,
then clears the token and the signed-in user, but no screen calls it yet.

- A "Delete account" button on Profile with an `AlertDialog` confirmation, and a section for it in
  `frontend/DESIGN.md`, modeled on "Delete confirmation" (what happens, that it can't be undone,
  Cancel + `bg-destructive` "Delete").
- After a `204` the page goes to `/` before the user is cleared, like `useLogout`: clearing first
  would let `RequireAuth` send the user to `/login?redirect=/profile`.
- **Not checked by hand yet:** the hook's logic is covered by `use-users.test.ts`
  (`deleteAccountOptions`), but the flow from the UI (click → hook → signed out → navigation) can
  only be checked once the button exists.

## Frontend: `RequireAuth` when the backend is down

When `GET /api/auth/me` fails with an error that is not a 401 (backend down, `5xx`, no network),
`useCurrentUser` has no data, so `RequireAuth`
(`frontend/src/features/auth/components/require-auth.tsx`) sends a signed-in user to `/login`
although the token is still there. It should tell "no user" (`null`) apart from "don't know whether
there is a user" (an error): for example an error state with "Try again" instead of the redirect.

## Frontend: extra `GET /api/auth/me` after login and sign-up

The manual check of PR 2 saw three `GET /api/auth/me` (all `200`, no loop) after every login and
sign-up, on `/login`, `/signup` and through the login dialog. One is enough: login and register already
answer the user.

**Confirmed from the code:**
- `['auth', 'me']` has no `staleTime` (neither `useCurrentUser` in
  `frontend/src/features/auth/api/use-auth.ts` nor the `QueryClient` in `frontend/src/app/providers.tsx`,
  which sets only `retry`), so it is TanStack Query's default `0`: the user is stale right after
  `setQueryData`, and every new observer refetches it on mount (`refetchOnMount` default `true`), unless
  a fetch is already running (then it joins that one).
- `useSetCurrentUser` (login, sign-up, logout) calls `setQueryData(currentUserQueryKey, user)` with the
  user from the answer and then `invalidateQueries({ queryKey: ['auth'] })`, which refetches the active
  `['auth', 'me']` once more. That is one of the three, and it fetches what the cache already holds. On
  logout it sends nothing (`me` without a token makes no request).
- `useCurrentUser` is read in 13 places: `app/app-shell.tsx`, `app/favorite-heart.tsx` (one per space
  card, so it mounts only once the spaces list has loaded), the routes `bookings`, `favorites`,
  `host-reservations`, `host-space-edit`, `host-space-new`, `host-spaces`, `profile`, `space-detail`,
  and `features/auth/components/account-menu.tsx`, `guest-only.tsx`, `require-auth.tsx`. After the login
  the page changes (`GuestOnly` → the mode's home or `?redirect=`, the dialog → its `redirect`), and
  these mount at different moments.

**Not checked (needs the browser):** which mounts send the second and third request. Likely candidates:
the route that mounts after the navigation (e.g. `RequireAuth` and the page on `/favorites`) and the
hearts on the space cards, which mount after the spaces list loads again (`['spaces']` is invalidated on
login). Also unchecked: whether React `StrictMode` (`src/main.tsx`, development only) adds one.

**Options (not decided):**
1. Drop `['auth']` from the invalidation in `useSetCurrentUser`: the user from the answer is already in
   the cache. Removes one request; the mount refetches stay.
2. A `staleTime` for `useCurrentUser` only (e.g. a few minutes, or `Infinity`): every change of the user
   already goes through the cache (`setQueryData` on login, sign-up, logout, mode switch;
   `invalidateQueries` on a profile edit; `onSessionExpired` and `onSessionChanged` in `providers.tsx`).
   Removes the mount refetches; a change made elsewhere (another device) shows after a reload.
3. Both 1 and 2.
4. A global `staleTime` on the `QueryClient`: affects every list too, so it is a wider decision.

## Frontend: logout from /favorites sends one request without a token

Logging out from `/`, or deleting the account, sends no request without a token (fixed in PR 2,
`useLogout` in `features/auth/api/use-auth.ts`). Logging out from `/favorites` still sends one
`GET /api/favorites?size=500` without `Authorization`, answered `401 not_authenticated` (one
"Failed to load resource" in the console). The user still ends up logged out on `/`.

What the request log shows (checked by hand, a `fetch` logger in the page):
- `onLoggedOut` navigates to `/` with `flushSync`, and Home mounts. `useCurrentUser` has
  `staleTime` 0, so the mount refetches `GET /api/auth/me`, still **with** the token (200), and puts the
  user back into the cache. The hearts then mount with that user, and their favorites query runs after
  the token is gone.
- Tried in PR 2 and reverted: clearing the user and removing `['favorites']`/`['bookings']` **before**
  `onLoggedOut()`. The `/auth/me` refetch on mount still runs with the token and brings the user back,
  so the request without a token stays.
- Not checked: whether the hearts' observers subscribe in effects after `onSuccess` has finished (that
  would be why removing the query first does not help).

Options (not decided):
1. A `staleTime` for `useCurrentUser` (see "extra `GET /api/auth/me` after login and sign-up" above):
   no `/auth/me` refetch on mount, so the user cannot come back during logout.
2. Clear the token first and accept the redirect risk, with a different way to keep `RequireAuth` from
   sending a deliberate log out to `/login?redirect=…` (e.g. a "logging out" flag it reads).
3. Let the favorites query run only while there is a token (a check in `use-favorites.ts`, in the
   favorites feature).


- **Error text contrast in the login dialog, light theme.** The dialog's forms sit on `background`
  (`oklch(0.965 0.018 255)`), and light `destructive` (`oklch(0.58 0.2 27)`) on it is **4.27:1** for
  14 px text; DESIGN.md "Accessibility" asks for 4.5:1. It affects the field errors
  (`features/auth/components/stacked-auth-field.tsx`) and `FormAlert` in the dialog, e.g. the 409
  "Email is already registered" and the 401 "Wrong email or password". On `card` (`/login`, `/signup`,
  `/profile`) it is 4.75:1, and the dark theme passes everywhere. The token is older than PR 2.
  Proposal: darken light `--destructive` in `frontend/src/index.css` a little (about L 0.55) and update
  its note in `frontend/DESIGN.md`.
- **`FormField` has no optional variant.** It always sets `aria-required="true"`, so the optional City
  field in `features/users/components/profile-details.tsx` copies its markup by hand (label with
  "(optional)", the pill input, the error `<p>`). Proposal: an `optional` prop on
  `frontend/src/components/form/form-field.tsx` that leaves out `aria-required` and adds the
  "(optional)" span; City then uses `FormField`.

## Backend: the 72-character password limit and bcrypt's 72 bytes

The contract (`docs/entities.md`, User) and the schemas (`backend/app/auth/schemas/auth.py`,
`max_length=72`) count **characters**; bcrypt reads at most 72 **bytes** of UTF-8. Checked by hand on
`feat/frontend-auth-users` against the local backend (bcrypt 4.3.0, `pyproject.toml` `^4.3.0`):

- `POST /api/auth/register` with a password of 72 × "š" (144 bytes) → `201`.
- `POST /api/auth/login` with the same password → `200`.
- `POST /api/auth/login` with **another** password that has the same first 72 bytes (36 × "š" +
  36 × "x") → `200`. bcrypt 4.3 silently cuts the input at 72 bytes, so only the first 72 bytes count.
  The test account was deleted afterwards (`204`).
- The comment in `backend/app/auth/password.py:5` ("longer input raises in bcrypt >= 4") does not match
  4.3, which cuts without an error. bcrypt 5 raises `ValueError` for more than 72 bytes; with it,
  `hash_password` (`password.py:9`) would fail on such a password and register would answer `500`
  (not checked: 5 is not installed).
- The frontend (zod `.max(72)` in `login-form.tsx`, `signup-form.tsx`) counts UTF-16 units: an emoji
  counts as 2, so it can refuse a password the backend accepts.

What it means, without a decision: either the contract and the schemas limit **bytes** (a validator
on `len(password.encode("utf-8")) <= 72`, the message and `docs/entities.md` say so, and the frontend
checks the same with `TextEncoder`), or the backend accepts longer passwords and pre-hashes them before
bcrypt (e.g. SHA-256 → base64), which changes how stored hashes are checked. Either way the comment in
`password.py` gets fixed, and a test covers a password over 72 bytes.

## From bookings PR 1 (left out of `feat/bookings` on purpose)

- **Confirm after the space became a draft.** The contract does not say what happens; today the host
  can still confirm (`200`, pinned by `test_confirm_after_the_space_became_a_draft_is_200_today` in
  `backend/tests/integration/test_bookings.py`). Decide, then change the contract and that test together.
- **`delete()` on the default `synchronize_session`.** `backend/app/users/repositories/user.py`,
  `app/spaces/repositories/space.py`, `app/listings/repositories/listing.py` and
  `app/favorites/repositories/favorite.py` leave it on `"auto"`. No wrong answer was found: their
  `WHERE` is on the id only, not a compare-and-set. The fix would be `"fetch"`, for consistency with
  the bookings repository and `.claude/frequent-mistakes.md` (ADR-023).
- **The `format` hook ignores `extend-exclude` and deletes new imports.** `backend/.claude/hooks/format.mjs`
  passes the edited file to `ruff check --fix` and `black` by name, and both apply `extend-exclude`
  (`alembic/versions` in `pyproject.toml`) only to files they find themselves, unless `--force-exclude`
  is given. `--fix` also removes an import (F401) added in an edit before its first use, so the entry
  about it in `.claude/frequent-mistakes.md` keeps coming back: the cause is the hook, not the agent.
  Fix: `--force-exclude` for both commands and `--extend-unfixable F401` for ruff, then remove that
  frequent-mistakes entry.
- **`backend/app/database/__init__.py`** goes against `backend/CLAUDE.md` and ADR-014 (no
  `__init__.py` below `app/` except `app/__init__.py`). It only re-exports `Base`, for
  `alembic/env.py`; import `Base` from `app.database.base` there and delete the file.
- **A host can confirm a booking whose slot has already started.** A `pending` booking turns
  `expired` only once its slot has ended, so between the start and the end the host can still
  confirm it (`200`), although the guest could no longer book that start (`booking_in_past`). The
  contract does not say whether that is wanted. Product decision: either allow it and say so in
  `entities.md`, or answer `422 invalid_status_change` for a confirm after the start, with a test, in
  both copies of `entities.md` in the same PR.

## Bookings PR 1, second review (left out of `feat/bookings` on purpose)

The second review (2026-10-30) was APPROVED with 2 MEDIUM and 7 LOW. Only the SQLite id reuse was
fixed in the PR (`sqlite_autoincrement` on `bookings`); these stay open.

- **The mock does not follow the contract yet, although "Frontend: connect bookings to the backend"
  above says it does.** `frontend/src/features/bookings/api/bookings-api.ts` returns the booking
  unchanged for a `PATCH` to the status it already has (contract: `422 invalid_status_change`,
  "Confirmed bookings cannot be confirmed again"), and `create` checks only the date, not a start
  earlier today (contract: `422 booking_in_past`, "Pick a time that has not started yet"). The mock
  also sets `createdAt` to a date only (`.slice(0, 10)`) and uses its own messages ("Pick a whole hour,
  for example 10:00", "The end time must be after the start time", "`<Label>` bookings cannot be
  changed"). Either fix the mock or reword that paragraph as an open to-do (ADR-018, ADR-002).
- **`PATCH` and `DELETE` error-mapping tests assert only `code`.** `test_patch_maps_the_service_errors`
  and `test_delete_maps_the_service_errors` in `backend/tests/unit/test_bookings_api.py` should assert
  the full `{"detail", "code"}` body, as the `POST` test does; the integration tests for
  `not_booking_participant` on `PATCH`/`DELETE` and the `DELETE` `404` in `test_bookings.py` too. This
  breaks the `*_maps_the_service_errors` entry in `.claude/frequent-mistakes.md` that this PR added:
  sharpen that entry so it names the full body (ADR-011, ADR-005).
- **`entities.md` does not say what an impossible date answers.** A well-formed but impossible date
  (`2026-02-30`) is `422 validation_error` with Pydantic's message, not "Use the format YYYY-MM-DD";
  say so in both copies (ADR-002).
- **A cancel that loses to a confirm after the slot ended says "confirmed meanwhile".**
  `_raise_lost_race` in `backend/app/bookings/services/booking.py` builds the message from the stored
  status; the contract asks for the status as returned (`finished`). Pass it through
  `_returned_status(…, now)` (ADR-002).
- **`entities.md` does not list every `invalid_status_change` message.** Name "Only a pending or
  confirmed booking can be cancelled" and the "`<Status>` bookings cannot be `<status>` again" pattern
  in both copies (ADR-002).
- **`entities.md` does not say the order for a date of today:** the slot rules come before
  `booking_in_past` (`now` 10:00, a slot 07:00–09:00 at a space opening at 08:00 answers
  `invalid_slot`). Add the sentence to both copies (ADR-002).
- **`not_booking_participant` says "see" on `PATCH` and `DELETE`.** "Only the guest or the host can see
  this booking" is written for `GET`. Optional wording change in the code and both copies of
  `entities.md` (ADR-005).
- **`spaces` and `users` reuse the id of a deleted last row too.** Only `bookings` got
  `sqlite_autoincrement` (migration `1a1aed7865e4`, ADR-024). `spaces` and `users` are also named by
  id in requests (`PATCH`/`DELETE /api/spaces/:id`, `/api/users/:id`) and lose rows, so a request from
  a stale page can reach a new space or account that got the deleted one's id. The ownership checks
  keep it to the owner's own rows, but a host who deletes their last space and creates another can,
  from an old tab, edit or delete the new one. Postgres is not affected. **Their rebuild is not safe
  the way the `bookings` one was:** other tables point at them (`bookings.space_id` and
  `favorites.space_id` → `spaces`; `spaces.host_id`, `bookings.guest_id`, `favorites.user_id` and
  `listings.owner_id` → `users`, all `ON DELETE CASCADE`). The batch rebuild drops the old table; with
  `PRAGMA foreign_keys=ON` that drop is an implicit `DELETE` of every row and cascades into those
  tables (all bookings and favorites gone), and whether it is on depends on the connection
  (`SessionFactory` turns it on, `alembic/env.py` does not today). A safe version needs SQLite's
  documented table-rebuild procedure: `PRAGMA foreign_keys=OFF` outside the transaction, rebuild with
  the ids kept, `PRAGMA foreign_key_check` before commit, then on again; tried on a copy of a
  database with rows in every child table and counted before and after. Decide whether the
  stale-tab case is worth that, or whether the frontend handles it (ADR-024, ADR-003, ADR-004).

## From bookings PR 2 (found in `feat/bookings-spaces`, left out on purpose)

PR 2 delivered `availableDesks`, `bookingCounts`, `DELETE /api/spaces` `409 space_has_active_bookings`
(ADR-025, ADR-026, ADR-027) and `GET /api/bookings/availability` (ADR-028); none of them is open here.
These stay open:

- **Postgres run of `test_bookings_concurrency.py` and `test_spaces_concurrency.py` (open since PR 1).**
  Both files in `backend/tests/integration/` passed on SQLite only; the Postgres command is in the
  docstring of `test_bookings_concurrency.py` (not run on 2026-10-30, Docker was not running). The
  lock (ADR-023) and the `403` before it (ADR-024) are proven on SQLite only, so bookings is not done
  until this runs. Run the whole `test_bookings.py` on Postgres in the same go: the lost-race tests and
  `test_cancel_or_delete_never_reaches_a_new_booking_with_the_same_id` insert and change rows over a
  second connection, which behaves differently under Postgres' READ COMMITTED.
  **ADR-025 has to be measured, not only reasoned:** on Postgres the no-op `UPDATE` alone does not
  hold back a new booking's foreign-key check (`FOR NO KEY UPDATE` vs `FOR KEY SHARE`), and
  `lock(space_id)` relies on the `FOR UPDATE` after it, which comes from the Postgres docs. Expected
  on Postgres: every test green, and in `test_post_first_and_the_parallel_delete_is_409_with_the_booking_kept`
  `delete_got_through` is `False` (DELETE waits for the POST's transaction); on SQLite it is `True`
  (the SAVEPOINT item below). Then run `test_spaces_concurrency.py` once with `lock` reduced to the
  no-op `UPDATE` (no `FOR UPDATE`): the POST ↔ DELETE tests must fail on Postgres, which is what
  proves ADR-025. Write the results into both docstrings.
- **`PATCH /api/spaces` against confirmed bookings.** A lower `deskCount`, a change of category or
  new opening hours can leave confirmed bookings that no longer fit (out of scope in
  `backend/docs/specs/bookings.md`). The check takes `ISpaceRepository.lock(space_id)` as its first
  statement, the lock `DELETE /api/spaces` takes since PR 2 (the no-op `UPDATE` plus `FOR UPDATE`,
  ADR-025). Product decision first: which code answers it, and what happens to a booking outside new
  opening hours. Until then `availableDesks` is `max(…, 0)` (ADR-027), so a lowered `deskCount` never
  shows a negative number (`test_available_desks_never_go_below_0_when_the_desk_count_is_lowered` in
  `backend/tests/integration/test_spaces.py`), and `entities.md` says the `PATCH` "does not check
  bookings yet".
- **Team decision: on SQLite a `POST` commits its row when `add()` releases its SAVEPOINT, before the
  request ends.**
  `add()` in `spaces`, `favorites`, `bookings` and `listings` inserts inside `db.begin_nested()`. When
  that is the request's first write, pysqlite's legacy mode (ADR-023) has no transaction open: the
  `SAVEPOINT` starts one, and SQLite treats the `RELEASE` of the outermost savepoint as a `COMMIT`.
  The row is visible to other connections right after `add()` returns, and the endpoint's rollback
  on a later error no longer removes it, so ADR-009 ("one transaction per endpoint") does not hold
  for these `POST`s on SQLite. Checked with a script on a temporary database (read, `begin_nested()`
  + INSERT, then another connection sees the row, and `rollback()` leaves it). No wrong answer found
  today: nothing after `add()` raises in those services. It shows in
  `test_post_first_and_the_parallel_delete_is_409_with_the_booking_kept`
  (`backend/tests/integration/test_spaces_concurrency.py`): DELETE does not wait for the POST,
  because the booking is already committed. Postgres is not affected (the SAVEPOINT is inside the
  request's transaction). To decide: accept it as a SQLite-only exception to ADR-009 (written into
  ADR-009 or a new ADR), or fix it. A fix must keep ADR-023's legacy mode for the `SELECT`s before a
  lock, for example a `BEGIN` before the first SAVEPOINT of a session that has no transaction yet;
  check it against `test_bookings_concurrency.py` and `test_spaces_concurrency.py`, and the
  engine-dependent assertion in that test then flips to `False` (ADR-009, ADR-019, ADR-023).
- **Frontend: the `409 space_has_active_bookings` count is only in `detail`.**
  `SpaceHasActiveBookingsError.activeBookings` in `frontend/src/features/spaces/api/spaces-api.ts`
  needs the number; the contract body is `{"detail": "This space has 2 active bookings", "code"}`.
  When the frontend is connected: take the count from `bookingCounts.active` of the host's list
  (`delete-space-dialog.tsx` already falls back to it), or agree on a field in the contract; do not
  parse `detail` (ADR-018, ADR-005).
- **A possible index for `booking_counts`.** `IBookingRepository.booking_counts` (host's list and
  `DELETE /api/spaces`) filters `space_id IN (...)` and the status as returned, which depends on
  `status`, `date` and `end_time`; the only composite index is `(space_id, date)`. Measure with
  `EXPLAIN` on Postgres with realistic data before adding one (for example `(space_id, status, date)`);
  a new index is a migration (ADR-004).
- **`ISpaceService.get` computes `availableDesks` for callers that never read it.** Bookings
  (`POST`, `availability`, `popular-times`) and favorites (`POST`) call it for the visibility check
  and the space's fields; `_to_response` also counts the confirmed bookings of the current hour, one
  `SELECT` too many per request. Options: a `get_visible` on the Protocol that returns the space
  without the computed fields, or a flag; keep the 404 for someone else's draft in one place (ADR-020).
- **Frontend wiring also covers `frontend/src/features/spaces/api/spaces-api.ts`.** `list` sends
  `hostId` and gets `bookingCounts` only when it is the signed-in user's own id (left out of the
  response otherwise, so the type is optional); `remove` handles `409 space_has_active_bookings`
  (the count: the item above). Add both to "Frontend: connect bookings to the backend".

## From bookings PR 3 (left out of `feat/bookings-popular-times` on purpose)

- **Popular time picks "today" and "now" in the browser's time zone.** `PopularTimes` in
  `frontend/src/features/bookings/components/popular-times.tsx` opens on `new Date().getDay()` and
  highlights `new Date().getHours()`; the backend's days and hours are Podgorica time. A visitor in
  another time zone sees the wrong day or hour selected. Take both from the Podgorica clock, as the
  booking form should too.
- **Product decision: popular times can be differenced on a small N.** The window grows by one known
  date a day from day 14 up to 56 days, and for a whole space (`units = 1`) a value moves in steps
  of 12.5 % or more. Anyone who asks every day can subtract yesterday's answer from today's and get
  the confirmed hours of the newest date, for any listed space, without a token. No guest, booking
  id or price leaks, and the contract allows it ("only counts"), but the per-date occupancy of a
  meeting room, office or event hall can be rebuilt. Options: a larger minimum (`null` until every
  weekday has at least 4 dates, `POPULAR_MIN_AGE` 28 days), or rounding the values (to 10 %), or
  both. Whatever is decided goes into both copies of `entities.md` and the spec; an ADR if it is a
  privacy rule for every aggregate (ADR-006).

## From the favorites review (left out of `feat/favorites` on purpose)

- **Index for "newest saved first".** `GET /api/favorites` and `GET /api/spaces?favoriteOf=` find a
  user's rows through `ix_favorites_user_id`, then sort `created_at desc, id desc` in a temporary
  B-tree (SQLite's plan: `USE TEMP B-TREE FOR ORDER BY`). Cheap while a user has few favorites. If
  it grows: `Index("ix_favorites_user_id_created_at", "user_id", "created_at", "id")` on `Favorite`,
  in a new revision (`156c87f4d970` is committed and is not edited).
- **One constant for the largest id.** `2**31 - 1` is written four times:
  `app/favorites/schemas/favorite.py` (`MAX_ID`), `app/spaces/api/space.py` (`_MAX_ID`),
  `app/users/api/user.py` (`_MAX_ID`) and `app/utils/pagination.py` (the `page` limit). Move it to
  one `MAX_ID` in `app/utils/schemas.py` and import it everywhere; no behaviour changes.

## From the users review (left out of `backend-users` on purpose)

- Frontend: the `auth-api.ts` mock that forces `mode: guest`, and the 80-character `city` limit in the
  profile form; done when the frontend is connected to the backend (PR 2 in
  `docs/frontend-wiring.md`).
- Escape `%` and `_` in `search` (users and spaces).
- bcrypt reads at most 72 bytes, not 72 characters: a password with non-ASCII letters can pass the
  length check and still be cut.
- `alembic/env.py` breaks when `DATABASE_URL` contains `%`.

## Backend: API docs and the error shape

- **`/docs` hides all but one `422` example per route.** `error_responses` in
  `backend/app/utils/openapi.py` stores examples as `examples[error.code]`, and every
  `ValidationFailedException` has `code="validation_error"`, so the last one overwrites the others.
  `PATCH /api/users/{user_id}` lists `_INVALID_ID` and `_INVALID_BODY` but `/docs` shows only the
  `name` example. Proposal: key each example by the code plus the `fieldErrors` names
  (e.g. `validation_error:user_id`), so both appear in the examples menu.
- **An invalid id answers `fieldErrors` with a snake_case key** (`user_id`, `space_id`), while the
  rest of the API is camelCase (`avatarUrl`, `pricePerHour`). The path parameter name reaches the
  error as it is; the unit tests for an invalid id assert `{"user_id"}` today.

## Backend: migrations in offline mode (`alembic upgrade --sql`)

- On SQLite, `alembic upgrade head --sql` fails: batch mode needs a live database to reflect the
  table it rebuilds, so it stops already at `62a19e5cebde` (in `main`). On Postgres offline mode
  works (all four migrations, checked on `backend-users`).
- The guard planned for `8dbecd30b036` (`if bind is None: return`) would not help: in offline mode
  `op.get_bind()` returns a `MockConnection`, not `None`. If the guard is ever needed, the right
  check is `context.is_offline_mode()`.
