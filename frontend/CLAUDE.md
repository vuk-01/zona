# Frontend

React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + React Router + TanStack Query.
Design is described in @DESIGN.md, entities in @../docs/entities.md.
All paths below are relative to `frontend/`.

## Theme (details in DESIGN.md)

- Poppins only, for headings and body
- Blue `primary` for the main action, navy `sidebar-*` tokens for navigation (bottom nav on mobile,
  sidebar on desktop), sky-blue `background`, white `card`
- Pink `highlight` only for discounts and "Popular"; green `success` for availability
- Radius 1rem for cards and images; `rounded-full` for buttons, inputs, chips and pills; thin borders;
  `shadow-soft` for floating elements and hovered buttons, `shadow-lift` for hovered clickable cards
- Motion follows DESIGN.md "Motion", every movement behind `motion-safe:`
- Light and dark theme (`.dark` on `<html>`): check every page in both. `src/lib/theme.ts` and the
  inline script in `index.html` share the `zona-theme` key, so change them together
- Guest/host mode changes the navigation and screens, never the colors

## Feature-first

Every feature (spaces, bookings, users…) lives in `src/features/<name>/` and has only the
subfolders it needs: `api/`, `components/`, `hooks/`, `types.ts`. Features do not import each
other; a route in `src/app/routes/` combines them on one page. Shared code goes to
`src/components` or `src/lib`, and only once at least two features use it.
Dependency direction: shared code -> features -> app, never the other way around.

## Structure

- `src/app/router.tsx`: all routes; `src/app/providers.tsx`: global providers (TanStack Query)
- `src/app/routes/`: one file per route, only combines features and layout
- `src/features/<name>/types.ts`: entity types of that feature
- `src/features/<name>/api/<name>-api.ts`: the only place that fetches data (mock for now)
- `src/features/<name>/api/use-<name>.ts`: TanStack Query hooks around the API
- `src/features/<name>/components/`: components of that feature (e.g. `space-card.tsx`)
- `src/components/ui/`: shadcn/ui components, added with `pnpm dlx shadcn@latest add <name>` (run inside `frontend/`)
- `src/components/layout/`: app layout (sidebar, bottom nav, top bar, `nav-items.ts`, `page-title.tsx`,
  `hero-panel.tsx`: the page top on Home, Explore, Favorites, My bookings, Profile and the host pages) and the auth
  page shell; it imports no features
- `src/components/form/`: `FormField`, `FormAlert` and `TimeSelect` (a whole hour, on `ui/select.tsx`)
- `src/components/feedback/`: `EmptyState` (every empty list and "not found" page) and `StatusNotice`
  (the visible result of an action); quick actions in a list (Approve / Decline) use a toast instead
  (`toast` from `sonner`, `Toaster` in `src/components/ui/sonner.tsx`, mounted in `AppLayout`)
- `src/components/user-avatar.tsx`: a user's photo or initials (profile, side menu, the guest on a
  host's reservation)
- `src/app/app-shell.tsx`: reads the signed-in user and passes the guest/host `mode`, the account menu
  (top bar on phones) and the account for the bottom of the side menu into `AppLayout`; the mode switch
  lives in `src/app/routes/profile.tsx`
- `src/app/favorite-heart.tsx`: the favorite heart (favorites feature) with the signed-in user (auth); routes
  pass it into space cards through `cardAction` / `action` and next to the title on the space page
- `src/app/auth-shell.tsx`: passes the spaces showcase (category illustrations, live line) into
  `AuthLayout` for `/login` and `/signup`
- `src/app/login-dialog.tsx`: `LoginDialogProvider` (around `AppShell` in `src/app/router.tsx`) and
  `useLoginDialog()`, which opens the login dialog (`features/auth/components/auth-dialog.tsx`) over the
  current page: `openLogin({ continueWith, redirect })`, where `continueWith(user)` continues the action
  and `redirect` is the page to go to after logging in (checked with `safeRedirect` from
  `features/auth/hooks/use-redirect-target.ts`, like `?redirect=` on `/login`). Features get it as an
  `onLogin` prop from `src/app` (`AccountMenu`, `navAccount`, `BookingForm`, `FavoriteButton`), the
  layout as `onProtectedNav` (nav items with `requiresAuth`); `/login` stays for direct links and
  `RequireAuth`'s redirects
- Protected routes are wrapped in `RequireAuth` (`mode="host"` for `/host/*`) in `src/app/router.tsx`
- `src/lib/`: `utils.ts` (`cn`), `mock-db.ts` (mock database and delay) and `auth-token.ts` (the API
  token in `localStorage`, `onSessionExpired` for `src/app`)

## Rules

- A feature never imports another feature; `src/components` and `src/lib` never import from `src/features` or `src/app`
- No barrel `index.ts` files: import the file directly (`@/features/spaces/components/spaces-list`)
- Components and routes never call `*-api.ts` directly, only through a hook from `use-<name>.ts`
- Use an existing component from `src/components/ui` first, only then create a new one
- Colors, fonts and radius only from tokens in `src/index.css`, no hex values in components
- Every list and data page has loading, empty and error states
- No `any` and no `!` (non-null assertion)
- If you are not sure how a library API works (Tailwind v4, React Router 8, TanStack Query 5), check the docs via Context7, do not guess.
- Changes to shared data (`types.ts`, `api/`, `src/lib/mock-db.ts`) are announced to the team and go in a small separate PR
- Before creating a helper, check `src/lib` for an existing one

## Done when

- `pnpm typecheck` and `pnpm lint` pass
- The page was opened with Playwright MCP and screenshots at 375 px and 1440 px match DESIGN.md
- No errors in the browser console
