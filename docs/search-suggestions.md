# City search suggestions

> The contract between the frontend and the backend for the city suggestions under the search field
> (after `docs/ref/search-reference.png`, cities only). Same conventions as `docs/entities.md`: base path
> `/api`, camelCase JSON, one error shape.

A click or focus on the search field (Home and Explore) opens a list of every city with spaces. Typing filters
that list in the browser. Picking a city opens Explore at `/spaces?city=<name>` right away. The number of spaces per city is ready in the component but hidden until this route
gives real counts.

The backend only returns the cities. Filtering, ordering the matches and bolding the matching part all
happen in the frontend, so the list is asked for once, not on every keystroke.

## Route

| Route                    | Auth | Body | Response                                                                       |
| ------------------------ | ---- | ---- | ------------------------------------------------------------------------------ |
| `GET /api/spaces/cities` | no   |      | `200 [{name, count}]`; `401 invalid_token` when an invalid or expired token is sent |

```json
GET /api/spaces/cities

[
  { "name": "Podgorica", "count": 128 },
  { "name": "Nikšić", "count": 46 },
  { "name": "Budva", "count": 41 },
  …
  { "name": "Andrijevica", "count": 1 },
  { "name": "Plav", "count": 1 }
]
```

| Field | Type        | Notes                                                            |
| ----- | ----------- | ---------------------------------------------------------------- |
| name  | string      | the city exactly as stored in `Space.city` (with its diacritics) |
| count | integer ≥ 1 | the number of `listed` spaces in that city                       |

## Rules

- **Every city with at least one `listed` space.** Guests never see drafts, so drafts are not counted, and a
  city whose spaces are all drafts is not returned. Every city has `count ≥ 1`.
- **Order**: most spaces first, then by name (A–Z), so the order is stable.
- **Not paginated**: a plain array, not `{total, items, pages}`. This is the one exception to the list
  convention: there are only a few dozen towns in Montenegro, and the frontend needs all of them at once.
- **No query parameters.** There is no `q` and no limit.
- **`name` feeds the `city` filter**: Explore will call `GET /api/spaces?city=<name>`, which matches exactly
  (case-insensitive), so return the stored spelling.

## Notes for the backend

- **Declare `/spaces/cities` before `/spaces/{id}`**, or FastAPI takes "cities" as the id and answers `422`.
- One query is enough: `SELECT city, COUNT(*) … WHERE status = 'listed' GROUP BY city`.
- If the same city is stored in two spellings ("Žabljak" and "žabljak"), add them up under one name, so the list
  never shows a city twice. Lowercase in Python, not with SQL `lower()`: SQLite folds only ASCII letters (see
  `city` in `docs/entities.md`), so it would keep those two apart.
- If the list ever grows to thousands of cities, add a `?q=` filter here then. Until then the frontend filters.

## Frontend

- `frontend/src/features/spaces/api/suggestions-api.ts`: `CitySuggestion` and `suggestionsApi.list()`. For now a
  mock with towns in Montenegro and made-up counts, following the rules above.
- `frontend/src/features/spaces/api/use-suggestions.ts`: `useCitySuggestions()`, cache key `['spaces', 'cities']`,
  so any change to spaces refreshes it.
- `frontend/src/features/spaces/components/search-suggestions.tsx`: the field and the list (`SearchSuggestions`),
  inside the search form `space-search.tsx` on Home and Explore. How it filters:
  - an empty field lists every city; the list scrolls after six;
  - case and diacritics do not matter (š→s, č and ć→c, ž→z, đ→d): `niksic` → Nikšić, `HERCEG` → Herceg Novi;
  - cities whose name **starts** with the term come first, then those that only **contain** it, each group
    by number of spaces: `ko` → Kotor, Kolašin, then Mojkovac;
  - the matching part of the name is bold;
  - nothing matches: "No city matches this search";
  - `showCount` shows the number of spaces next to each city; it is off while the counts are made up.
- Searching:
  - picking a city (a click, or ↑/↓ and Enter) searches it at once → `/spaces?city=Podgorica`, which Explore
    passes to `GET /api/spaces?city=` (exact name);
  - Search, or Enter with no city marked, searches the typed text → `/spaces?q=hub`, which Explore passes to
    `GET /api/spaces?search=` (name or city).
  Explore shows every active filter (city, text, price, category) as a removable chip above the results, with
  "Clear all" when there are two or more.

## Next steps

- Backend: the route above; then `list()` calls it instead of the mock, and the search form turns on
  `showCount`.
- Move `CitySuggestion` into `frontend/src/features/spaces/types.ts` and this contract into `docs/entities.md`
  (Space section), once the current changes to both have landed.
