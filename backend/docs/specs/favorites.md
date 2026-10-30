# Favorites

## Goal
A signed-in user saves a space with the heart and finds it again on the Favorites page.
This slice: the `favorites` table, its 3 routes, and the `favoriteOf` filter on `GET /api/spaces`
(ignored until now). Out of scope: connecting the frontend (`favorites-api.ts` and the spaces mock
stay mocks; a follow-up), a favorite count on a space, removing `app/listings/`.

## Entities & fields
**Favorite** (`favorites`, `app/favorites/`)

| field | type | required | limits | notes |
|---|---|---|---|---|
| id | int PK | yes | | internal only, never in the API; tie-break for ordering |
| user_id | FK `users.id` ON DELETE CASCADE, index | yes | | from the token (ADR-006); JSON `userId` |
| space_id | FK `spaces.id` ON DELETE CASCADE, index | yes | 1–2147483647 | from the body; JSON `spaceId` |
| created_at | TIMESTAMP(tz), `server_default=now()` | yes | | backend; JSON `createdAt` |

`UNIQUE(user_id, space_id)`: a user saves a space at most once (ADR-007).
Relations: User 1–N Favorite and Space 1–N Favorite (`passive_deletes`); deleting a user or a space
deletes their favorites through the database cascade.

## Routes
| method | path | auth | body | responses |
|---|---|---|---|---|
| GET | `/api/favorites?page=&size=` | yes | | `200 Page[Favorite]` (own only, newest saved first); `401`; `422` bad page/size |
| POST | `/api/favorites` | yes | `{spaceId}` | `201` favorite; `200` the existing one unchanged; `401`; `404 space_not_found`; `422` |
| DELETE | `/api/favorites/{space_id}` | yes | | `204`, also when it was not saved; `401`; `422` invalid id |
| GET | `/api/spaces?favoriteOf=` | yes with `favoriteOf` | | own id: the saved spaces, newest saved first, other filters and visibility still apply; `401`; `403 not_own_favorites`; `422` invalid id |

POST: the space must be one the user can view (`ISpaceService.get`: `404` for an unknown id or
someone else's draft). Then the INSERT runs in a SAVEPOINT, with no SELECT for the pair before it
(ADR-007). On `IntegrityError` (ADR-019): the user is gone → `401 invalid_token`; the space is gone
→ `404 space_not_found`; the pair exists (a parallel POST) → `200` with the existing favorite;
otherwise re-raise. The service returns the favorite and whether it was created; the endpoint
sets `201` or `200`. A repeat is not an error (ADR-021): a second POST is `200`, not `409`, and
DELETE is `204` whether or not a row went, also when a parallel request removed it first.

Order: `GET /api/spaces` has no sort parameter, only `page`, `size` and the filters. Without
`favoriteOf` the order is newest created first. `favoriteOf` replaces it with newest saved first
(`favorites.created_at desc, favorites.id desc`); the other filters only narrow the list. If a sort
parameter is added later, an explicit sort wins over the `favoriteOf` order, and that PR states it
in the contract.

## Access rules
- Only a signed-in user; `user_id` is always `current_user.id`, never from the body (ADR-006).
- Favorites are private: GET returns only the user's own, DELETE removes only the user's own pair.
- `GET /api/favorites` and `favoriteOf` both leave out a saved space the user can no longer view
  (another host's space that became a draft); the row stays and comes back when the space is
  listed again. Both use the one visibility rule, `space_visible_to` in `app/spaces/models/space.py`.

## Error cases
| status | when | detail | code |
|---|---|---|---|
| 401 | no / invalid token; on POST also a user deleted during the request | Authentication required / Invalid or expired token | `not_authenticated` / `invalid_token` |
| 403 | `favoriteOf` with another user's id | You can only list your own favorites | `not_own_favorites` |
| 404 | POST for an unknown space, someone else's draft, or a space deleted during the request | Space not found | `space_not_found` |
| 422 | missing or invalid `spaceId`, invalid id in the path or `favoriteOf`, bad page/size | Validation failed | `validation_error` + `fieldErrors` |

## Done when
- [ ] Unit `test_favorites_api.py`: routing, 401 without token, 422 shapes, `201` vs `200` from the service flag, `204` empty body; `test_favorites_service.py`: FK user → 401, FK space → 404, pair exists → existing + `created=False`
- [ ] Integration `test_favorites.py`: POST 201 / again 200 (same `createdAt`) / unknown 404 / other's draft 404 / own draft 201 / 401 / 422; GET own only, newest first, pagination; DELETE 204 / not saved 204 / other user's pair untouched / 401 / 422; space and user deletion cascade; mid-request (second connection, before the INSERT): space deleted → 404, user deleted → 401, same pair inserted → 200
- [ ] `test_spaces.py`: `favoriteOf` own → saved spaces newest saved first (a space created earlier but saved later comes first), with `status=listed`; 401 / 403 / 422; another host's draft that was saved is hidden
- [ ] Integration: a favorite removed over a second connection while its DELETE runs → still `204`
- [ ] Migration `create favorites` read before `migrate` (on SQLite only a new table, no rebuild); `alembic check` clean
- [ ] `docs/entities.md` (both copies): `422` on the favorite routes, `401` on POST for a deleted user, `403 not_own_favorites`, "Built so far" no longer says `favoriteOf` is ignored
- [ ] Frontend: `favorites-api.ts` takes `userId`, the real API reads the token; listed in `docs/follow-ups.md` (ADR-018)
- [ ] `poetry run lint && poetry run typecheck && poetry run test` green; `/review-changes` APPROVED
