---
paths:
  - "frontend/src/features/**/api/**"
---

# Data

- Entity types live in `src/features/<name>/types.ts`, and every type change also goes into both copies of the contract, `docs/entities.md` at the repo root and `backend/docs/entities.md`, kept identical
- `src/features/<name>/api/<name>-api.ts` exposes `list`, `get`, `create`, `update`, `remove`, matching the REST API
- `<name>-api.ts` calls the backend through `api` from `@/lib/api-client` (paths, bodies and error codes from `docs/entities.md`): a list is `Page<T>`, an error is `ApiError` (`isNotFound`, `errorMessage`), and a form puts the server's `fieldErrors` on its fields with `applyFieldErrors` from `@/lib/form-errors`
- Until a feature moves to the API, its mock uses `delay` and `NotFoundError` from `@/lib/mock-db`; a feature's mock data stays in its own `api/` folder
- Mock data looks real (real titles, cities, prices), no "Lorem ipsum"
- Hooks live in `src/features/<name>/api/use-<name>.ts`: reads use `useQuery`, writes use `useMutation` and call `invalidateQueries` on success
- Cache keys: `[entity]`, `[entity, id]`, `[entity, filter]`
