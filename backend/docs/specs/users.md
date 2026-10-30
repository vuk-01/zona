# Users

## Goal
One account, two modes: every user edits their profile, switches between guest and host mode, and can delete
their account; anyone can browse public profiles. This slice builds the whole User section of `docs/entities.md`:
a new `app/users/` domain with 4 routes, the full user on register/login/me, and two drift fixes (register takes
`name` 2–60, a failed login says "Wrong email or password"). Product change: login keeps the stored `mode` (the
last one used) instead of resetting to `guest`.
Out of scope: changing email or password, removing `app/listings/` (own PR), bookings/favorites cascades.

## Entities & fields
**User** (`users`, `app/users/`); existing rows keep their data, the migration fills the defaults below.

| field | type | required | limits | notes |
|---|---|---|---|---|
| id | int PK | yes | | backend |
| name | String(60) | yes | trimmed, 2–60 | **renamed** from `display_name` with `alter_column(new_column_name=)`, data kept |
| email | String(254), unique | yes | valid email, stored lowercase | only to the user themselves |
| avatar_url | String(500) \| null | yes | http(s) URL ≤ 500 or `null` | new; `null` → initials; PATCH `null` clears it |
| city | String(80) | yes | trimmed, 0–80 | new; `server_default ''`; 80 limit added to entities.md |
| bio | String(200) | yes | trimmed, 0–200 | new; `server_default ''` |
| is_host | bool | yes | | existing; set to true by `PATCH {mode: host}`, never back to false |
| mode | String(10), `UserMode` | yes | `guest` \| `host` | new; `server_default 'guest'`; CHECK `mode_known` (in enum); CHECK `host_mode_requires_is_host` (`mode = 'guest' OR is_host`) |
| created_at | TIMESTAMP(tz) | yes | | backend |

Both CHECKs are named in the model (`CheckConstraint(..., name=...)`); `Base`'s convention makes them
`ck_users_mode_known` and `ck_users_host_mode_requires_is_host`, so a later migration can drop them by name.
`PublicUser` = User without `email` and `mode`. `CurrentUser` carries every field so `/me` returns the full user.
Relations (unchanged): User 1–N Space and Listing, `ON DELETE CASCADE`; deleting a user deletes them.
Spaces: drop the `AliasChoices("name", "display_name")` workaround; seed uses `name`.

## Routes
| method | path | auth | body | responses |
|---|---|---|---|---|
| POST | `/api/auth/register` | no | `{name, email, password}` | `201 {token, user}` with `mode: guest`, `409`, `422` |
| POST | `/api/auth/login` | no | `{email, password}` | `200 {token, user}` with the **stored** mode, `401 invalid_credentials`, `422` |
| GET | `/api/auth/me` | yes | | `200` user, `401` |
| GET | `/api/users?search=&isHost=&page=&size=` | optional | | `200 Page[PublicUser]`, newest first; `401 invalid_token`; `422` |
| GET | `/api/users/{user_id}` | optional | | `200 PublicUser`, `401 invalid_token`, `404`, `422` bad id |
| PATCH | `/api/users/{user_id}` | self | any subset of `{name, avatarUrl, city, bio, mode}` | `200` user, `401`, `403`, `404`, `409`, `422` |
| DELETE | `/api/users/{user_id}` | self | | `204`, `401`, `403`, `404` |

Filters: `search` ≤ 80 chars, `ilike` on name; `isHost` boolean. PATCH: `mode: host` also sets `is_host = true`;
`mode: guest` keeps `is_host`; `{}` is `200` unchanged; explicit `null` is `422` except for `avatarUrl`.

## Access rules
- Anyone (signed in or not) lists and views `PublicUser`; nobody else ever gets `email` or `mode`.
- Only the user changes or deletes their own account: the path id must equal `current_user.id` (ADR-006).
- Checks in order: unknown id → `404`, someone else's id → `403`. After DELETE the token answers `401 invalid_token`.

## Error cases
| status | when | detail | code |
|---|---|---|---|
| 401 | wrong email or password | Wrong email or password | `invalid_credentials` |
| 401 | no token on `/me`, PATCH, DELETE / invalid or expired token anywhere | Authentication required / Invalid or expired token | `not_authenticated` / `invalid_token` |
| 403 | PATCH / DELETE of another user | Only the account owner can change this account | `not_account_owner` |
| 404 | unknown user id | User not found | `user_not_found` |
| 409 | register with a taken email | Email is already registered (+ `fieldErrors.email`) | `email_already_registered` |
| 409 | PATCH hits an `IntegrityError` the input checks let through (race) | The account could not be saved, please try again | `user_conflict` |
| 422 | invalid field, bad `isHost`/`search`, bad id, `null` name/city/bio/mode | Validation failed | `validation_error` + `fieldErrors` |

## Done when
- [ ] Unit `tests/unit/test_users_api.py` + `test_auth_api.py` updated: routing, query params reach the service, 401 without token, 422 shape (`name` 1 char, whitespace-only, 61 chars, bad URL, `mode: admin`, `null` name), 204 no body
- [ ] Integration `tests/integration/test_users.py`: list 200 (search, isHost, pagination, no `email`/`mode` in items) / 401 invalid token / 422; get 200 / 404 / 422; patch 200 each field, `mode: host` sets `isHost`, `mode: guest` keeps it, avatar `null` clears, `{}` / 401 / 403 / 404 / 422; delete 204 then token 401, spaces cascade / 401 / 403 / 404
- [ ] `test_auth.py`: register with `name` (trimmed, 2–60), login 401 body "Wrong email or password", login after `mode: host` returns `host`, `/me` returns every field
- [ ] Migration `rename users.display_name to name, add profile and mode`: rename (not drop+add), new columns with server defaults, both CHECKs by name; `poetry run alembic check` clean
- [ ] SQLite rebuild cannot delete spaces: on SQLite the batch rebuild drops the old `users` table, which with `foreign_keys=ON` cascades to `spaces` and `listings`. The `alembic/env.py` engine has no FK listener (only `SessionFactory` adds one), and the PRAGMA is a no-op inside a transaction, so the migration's `upgrade()` reads `PRAGMA foreign_keys` on SQLite and raises before touching the table if it is `1`. Postgres alters in place, no rebuild
- [ ] On a copy of the seeded DB: counts of `users`, `spaces`, `listings` before and after `migrate` are equal, every `name` equals the old `display_name`, and `PRAGMA foreign_key_check` is empty
- [ ] `display_name`/`displayName` gone from code, tests and seed; `app/users/routes.py` registered in `app/routes.py`
- [ ] `docs/entities.md` (repo root **and** `backend/docs/`): remove "Every login sets `mode: guest`", say the mode is remembered across logins, login row "with the stored mode", city ≤ 80, `user_conflict`, drop the "no route sets `isHost` yet" note
- [ ] `poetry run lint && poetry run typecheck && poetry run test` green; `/review-changes` APPROVED
