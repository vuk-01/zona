# Entities

> This file is the contract between the frontend and the backend (next workshop).
> For each entity: fields with types, relations, and who is allowed to do what.
> The entity type lives in `frontend/src/features/<name>/types.ts` and the mock API in
> `frontend/src/features/<name>/api/<name>-api.ts`.

## Listing (example, replace with your own)

Code: `frontend/src/features/listings/` (`types.ts`, `api/listings-api.ts`, `api/use-listings.ts`).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | number | yes | assigned by the backend |
| title | string, 3–80 characters | yes | |
| description | string | no | |
| price | number ≥ 0, EUR | yes | |
| category | `games` \| `consoles` \| `accessories` | yes | |
| city | string | yes | |
| imageUrl | URL | no | |
| createdAt | date | yes | assigned by the backend |

**Relations:** a listing belongs to one user (the seller).

**Access rules:** everyone can see listings; only a signed-in user can create one; only the author can edit or delete their listing.

**API the frontend expects:** `GET /listings?search=`, `GET /listings/:id`, `POST /listings`, `PATCH /listings/:id`, `DELETE /listings/:id`.

## User

Code: `frontend/src/features/auth/` (`types.ts`, `api/auth-api.ts`, `api/use-auth.ts`).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | number | yes | assigned by the backend |
| name | string, 2–60 characters | yes | |
| email | string, valid email, unique | yes | stored lowercase |
| password | string, at least 8 characters | yes | only sent on sign-up and login; stored as a hash, **never returned** |
| isHost | boolean | yes | `false` on sign-up; set to `true` by "Switch to hosting" in Profile |
| createdAt | date | yes | assigned by the backend |

**Relations:** a user can book spaces (as a guest) and, once `isHost` is `true`, list their own spaces (as a host). One account, two modes; there is no role choice at sign-up.

**Access rules:** anyone, signed in or not, can browse, search and view spaces; booking a space and listing a space require a signed-in user; a user can see and edit only their own profile.

**API the frontend expects:** `POST /auth/signup` (name, email, password → User, starts a session), `POST /auth/login` (email, password → User; 401 "Wrong email or password"), `POST /auth/logout`, `GET /auth/me` (User, or 401 when signed out). Sign-up with an existing email returns 409 "Email already in use". Google login and password reset come later.
