# Follow-ups

Open items found while working on something else. Each one is a separate small PR; remove the entry
in the PR that fixes it.

## Backend: a record deleted while its PATCH or DELETE runs

Found while fixing users (branch `backend-users`). If a row disappears between the read and the write
(a parallel request deleted it), SQLAlchemy does not answer the way the contract expects:

- `UPDATE` that matches no rows raises `StaleDataError` on flush.
- `session.delete()` that matches no rows only emits an `SAWarning` (the mapper has no
  `version_id_col`), so the endpoint answers `204` as if it had deleted something.

Users is fixed: `PATCH` maps `StaleDataError` to `404 user_not_found`, and `DELETE` uses
`DELETE ... RETURNING id` and answers `404` when nothing was deleted. Tests delete the row over a second
connection mid-request (`tests/integration/test_users.py`). Since then pytest turns every `SAWarning`
into an error, but only for what a test actually triggers; spaces and listings have no such test yet.

| Domain   | Where                                                    | DELETE of a vanished row | PATCH of a vanished row                                                                                                       |
| -------- | -------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| spaces   | `backend/app/spaces/repositories/space.py` (`delete`)    | `204` instead of `404`   | `save()` flushes, but `services/space.py` catches only `IntegrityError`, so `StaleDataError` is a `500`                        |
| listings | `backend/app/listings/repositories/listing.py` (`delete`) | `204` instead of `404`   | `update` never flushes, so `StaleDataError` raises at `commit()` in `session_handler` and is a `500`                            |

- **`space_conflict` (409):** `entities.md` describes it as a race such as the host's account being
  deleted during the request. That race raises `StaleDataError`, not `IntegrityError`, so the 409 does
  not cover it. Before deciding whether `space_conflict` stays, check whether a `PATCH` or `POST` of a
  space can hit a database constraint (UNIQUE, CHECK, FOREIGN KEY) that Pydantic lets through; if none
  can, remove it the way `user_conflict` was removed.
- **listings** is the starter example and is removed with a migration once spaces works
  (`entities.md`), so it probably needs no fix.

## From the users review (left out of `backend-users` on purpose)

- Frontend: the `auth-api.ts` mock that forces `mode: guest`, and the 80-character `city` limit in the
  profile form; done when the frontend is connected to the backend.
- Escape `%` and `_` in `search` (users and spaces).
- bcrypt reads at most 72 bytes, not 72 characters: a password with non-ASCII letters can pass the
  length check and still be cut.
- `alembic/env.py` breaks when `DATABASE_URL` contains `%`.
