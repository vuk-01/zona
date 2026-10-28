# Spaces

## Goal
Hosts list spaces (desks, meeting rooms, offices, event halls) that guests browse and later book by the hour.
This slice: the `spaces` table, its 5 routes and list filters, plus `users.is_host` so only hosts can create.
Fields that depend on bookings keep their contract shape and are filled in by the bookings feature
(`availableDesks` = `deskCount` while open, `bookingCounts` = `{active: 0, pending: 0}`, no `409` on delete).
Out of scope: `favoriteOf` (favorites feature), `mode` and `PATCH /api/users/:id` (users feature),
removing `app/listings/` (follow-up PR with its own migration).

## Entities & fields
**Space** (`spaces`, `app/spaces/`)

| field | type | required | limits | notes |
|---|---|---|---|---|
| id | int PK | yes | | backend |
| name | String(80) | yes | 3–80, trimmed | |
| description | Text | no | ≤ 500 | default `""` |
| category | String(20), `SpaceCategory` | yes | `desk` \| `meeting-room` \| `office` \| `event-hall` | CHECK |
| city | String(80) | yes | 1–80, trimmed | new limit, added to entities.md |
| address | String(120) | yes | 1–120, trimmed | new limit, added to entities.md |
| price_per_hour | Numeric(6,2, asdecimal=False) | yes | > 0, ≤ 1000, ≤ 2 decimals | CHECK |
| capacity | int | yes | 1–1000 | CHECK |
| desk_count | int \| null | desk only | 1 ≤ x ≤ capacity | CHECK: not null ⇔ `category = 'desk'`; dropped for other categories |
| images | JSON list[str] | yes | 1–8 http(s) URLs | Pydantic only (JSON length differs per engine, ADR-003) |
| opening_hours | JSON `mon`…`sun` → `{open, close}` \| null | yes | whole hours, `close` ≤ `24:00`, `close > open`, ≥ 1 open day | Pydantic only |
| status | String(10), `SpaceStatus` | yes | `listed` \| `draft` | CHECK |
| host_id | FK `users.id` ON DELETE CASCADE, index | yes | | from the token; JSON `host: {id, name}` |
| created_at | TIMESTAMP(tz), `server_default=now()` | yes | | backend |
| availableDesks | computed | yes | int ≥ 0 \| null | `deskCount` if desk and open now (Europe/Podgorica), else `null` |
| bookingCounts | computed | own list only | `{active, pending}` | zeros until bookings exist |

**User** (existing): add `is_host: bool`, NOT NULL, `server_default` false; exposed on `CurrentUser`.
Relations: User 1–N Space (`User.spaces`, `cascade="all, delete-orphan"`, `passive_deletes`). Deleting a user deletes their spaces.
PATCH validates the merged state: switching to `desk` needs a `deskCount` (body or stored); leaving `desk` sets it to null.

## Routes
| method | path | auth | body | responses |
|---|---|---|---|---|
| GET | `/api/spaces?search=&category=&city=&hostId=&status=&minPrice=&maxPrice=&page=&size=` | optional | | `200 Page[Space]`, newest first; `422` bad enum/number |
| GET | `/api/spaces/{space_id}` | optional | | `200`, `404` |
| POST | `/api/spaces` | host | all writable fields | `201`, `401`, `403 not_a_host`, `422` |
| PATCH | `/api/spaces/{space_id}` | owner | any subset | `200`, `401`, `403`, `404`, `422` |
| DELETE | `/api/spaces/{space_id}` | owner | | `204`, `401`, `403`, `404` |

Filters: `search` = name or city, `ilike`; `city` exact, case-insensitive; `minPrice`/`maxPrice` inclusive;
`hostId` = own id → drafts included and `bookingCounts` set; other people's drafts are never returned.

## Access rules
- Anyone (signed in or not) lists and views `listed` spaces; the host also sees their own drafts.
- Only a signed-in user with `is_host = true` creates; `host_id = current_user.id`, never from the body (ADR-006).
- Only the host edits or deletes. Someone else's draft is `404` on every route (its existence is not revealed).

## Error cases
| status | when | detail | code |
|---|---|---|---|
| 401 | no / invalid token on POST, PATCH, DELETE | Authentication required / Invalid token | `not_authenticated` / `invalid_token` |
| 403 | POST by a user with `is_host = false` | Only hosts can create spaces | `not_a_host` |
| 403 | PATCH / DELETE of a listed space by another user | Only the host can change this space | `not_space_owner` |
| 404 | unknown id, or someone else's draft | Space not found | `space_not_found` |
| 422 | field invalid; desk without `deskCount`; bad opening hours | Validation failed | `validation_error` + `fieldErrors` |

## Done when
- [ ] Unit `tests/unit/test_spaces_api.py`: routing, every query param reaches the service, 401 without token, 422 shape with `fieldErrors`, 204 has no body
- [ ] Integration `tests/integration/test_spaces.py`: create 201 / 401 / 403 not_a_host / 422 (each CHECK-backed field, desk without deskCount, bad hours, 0 and 9 images); get 200 / 404 / other's draft 404; list each filter, pagination, own drafts + `bookingCounts`, others' drafts hidden, `availableDesks` open vs closed (fixed clock); patch 200 / 401 / 403 / 404 / 422, desk ↔ meeting-room switch; delete 204 / 401 / 403 / 404; user delete cascades
- [ ] Fixtures: `host_auth_headers` (is_host flipped in the DB), `space_id`; seed adds one host with spaces
- [ ] Migration `add spaces and users.is_host`, read before `migrate`; `poetry run alembic check` clean
- [ ] `docs/entities.md`: city/address limits, deferred `favoriteOf` noted; frontend repo gets the same edit (ADR-001)
- [ ] `poetry run lint && poetry run typecheck && poetry run test` green; `/review-changes` APPROVED
