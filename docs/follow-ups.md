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

Until then, the reference domain still has the bug fixed in users and spaces: a listing deleted while
its `PATCH` or `DELETE` runs answers `500` or `204` instead of `404` (`db.delete()` only warns, and
`update` never flushes). A new domain copied from it must use the spaces version
(`DELETE ... RETURNING id`, `StaleDataError` → `404`).

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
