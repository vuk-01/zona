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

## Frontend: connect favorites to the backend

The backend has `GET/POST/DELETE /api/favorites` and `GET /api/spaces?favoriteOf=` (branch
`feat/favorites`); the frontend still uses the mock. When the frontend is connected:

- `frontend/src/features/favorites/api/favorites-api.ts`: `list`, `create` and `remove` take a
  `userId`; the real API takes the user from the token, so the parameter goes. `list` reads `items`
  from the paginated answer.
- `create` answers `201` or `200` (already saved); both are success. `remove` is `204` either way.
- `list` leaves out a saved space the user can no longer view (another host's space that became a
  draft), the same as `favoriteOf`; the hearts then show it as not saved until it is listed again.
- `frontend/src/features/spaces/api/spaces-api.ts`: `favoriteOf` comes back newest saved first from the
  backend; a `403 not_own_favorites` or `401` means the page asked with the wrong id or no token.
- `frontend/src/lib/favorite.ts` and the rows in `frontend/src/lib/mock-db.ts` go with the mock.

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

## From bookings PR 1 (left out of `feat/bookings` on purpose)

- **Bookings PR 2: remove the temporary sentence in `entities.md`.** The Booking "Built so far" note
  (line 164 in both copies) says that `/api/bookings/availability` and `/popular-times` match
  `GET /api/bookings/:id` and fail as an invalid id. When PR 2 registers both routes before
  `/{booking_id}` in `backend/app/bookings/api/booking.py`, delete that sentence from both copies in
  the same PR.
- **`PATCH /api/spaces` against confirmed bookings.** A lower `deskCount`, a change of category or
  new opening hours can leave confirmed bookings that no longer fit. The check takes
  `ISpaceRepository.lock(space_id)` as its first statement, the lock `DELETE /api/spaces` takes in
  bookings PR 2 (ADR-023). Until then PR 2 computes `availableDesks` as `max(…, 0)`, so a lowered
  `deskCount` never shows a negative number.
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
- **Postgres run of the concurrency tests.** `backend/tests/integration/test_bookings_concurrency.py`
  passed on SQLite only; the Postgres command is in its docstring (not run on 2026-10-30, Docker was
  not running). Update the docstring with the result.

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
  profile form; done when the frontend is connected to the backend. In the same change, add the `/api`
  proxy to port 8000 in `frontend/vite.config.ts`: `backend/README.md` line 24 says the frontend dev
  server proxies `/api`, but no proxy is configured yet.
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
