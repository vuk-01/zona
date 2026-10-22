# Zona: design

## Product

Zona lets guests book desks, meeting rooms, offices and event halls by the hour or day, and lets
hosts list their own spaces for rent.

## Users

- Freelancers, students and companies, aged roughly 20–45.
- Phone first (design at 375 px first), but desktop (1440 px) must be just as good.
- Two roles, one account:
  - **Guest**: searches and books spaces. Everyone starts as a guest.
  - **Host**: lists their own space, manages bookings and availability.

## Guest and host mode

- The same account switches modes with a full-width `secondary` pill button with the `ArrowLeftRight`
  icon: "Switch to hosting" in guest mode, "Switch to renting" in host mode.
- It sits in Profile, on every screen. There is no role choice at sign-up.
- Switching changes the navigation items and the home screen, **never the colors**:
  - Guest nav: Home, Explore, Bookings, Profile
  - Host nav: My spaces, Profile ("Add a space" is a CTA on My spaces, not a nav item)
  - After switching, the app goes to that mode's home: guest → `/`, host → `/host/spaces`
- In host mode a small "Hosting" `Badge` sits next to the logo in the sidebar and in the mobile page
  title, so it is always clear which mode is on.
- Host screens reuse the guest patterns: space card (with status "Listed" / "Draft"), Popular time (so
  the host sees when their space is busy), and a full-width pill CTA "Add a space".

## Routes

| Mode  | Path                    | Page                    | Access                  |
| ----- | ----------------------- | ----------------------- | ----------------------- |
| guest | `/`                     | Home ("Find your zone") | everyone                |
| guest | `/spaces`               | Explore spaces          | everyone                |
| guest | `/spaces/:id`           | Space details           | everyone                |
| guest | `/bookings`             | My bookings             | signed in               |
| both  | `/profile`              | Profile + mode switch   | signed in               |
| host  | `/host/spaces`          | My spaces               | signed in, in host mode |
| host  | `/host/spaces/new`      | Add a space             | signed in, in host mode |
| host  | `/host/spaces/:id/edit` | Edit space              | signed in, in host mode |

- Signed out on a protected page: go to `/login?redirect=<page>`, and back there after logging in.
- In guest mode on a host page: go to `/`, the guest home. Switching from host to guest on a host page
  lands there too, so the redirect and the switch never send the user to two different places.

## Sign-in rules

- Browsing, searching and viewing spaces work **without** signing in.
- Booking a space and listing a space **require** signing in. The user is sent to `/login?redirect=…`
  and comes back to the same page afterwards.
- Login: email and password. Sign-up: name, email and password.
- Google login and "Forgot password" come later with the real backend; they are not shown at all now.

## Tone

Playful, friendly, modern. Short, warm UI copy ("Find your zone", "23 desks available"), no jargon.

## Visuals

### Colors

Tokens live in `src/index.css`, light in `:root` and dark in `.dark`. The palette is taken from
`docs/ref/slika2.png`.

| Token                                    | Use                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `background`                             | sky-blue page background                                                                   |
| `foreground`                             | navy text                                                                                  |
| `card`, `popover`                        | white cards, sheets and dialogs                                                            |
| `primary`                                | main CTA (Book, Checkout), active tab, selected bar, links                                 |
| `secondary`                              | pale blue pills: price pill ("€4–8 /hr"), selected list row, mode switch button            |
| `muted` / `muted-foreground`             | search field and inactive chips / addresses, "/hr", meta text                              |
| `accent`                                 | hover backgrounds only (shadcn uses it this way), pale blue                                |
| `highlight`                              | pink: **only** for discounts ("−30%") and the "Popular" badge                              |
| `success`                                | green: availability ("23 desks available", "Open now")                                     |
| `destructive` / `destructive-foreground` | errors, cancel booking, delete / text on a `destructive` button (white light, navy dark)   |
| `border` / `input`                       | dividers and card borders / input borders (stronger, 3:1 against `card`)                   |
| `sidebar-*`                              | navy navigation: bottom nav on mobile, sidebar on desktop; `sidebar-primary` = active item |
| `chart-1` / `chart-2`                    | Popular time: selected (busy) hour / other hours                                           |
| `shadow-soft`                            | the only shadow, for floating elements (bottom nav, sheets, popovers)                      |
| `overlay`                                | dims the page behind dialogs (navy at 50%, black at 60% in dark)                           |

All text/background pairs are at least 4.5:1 in both themes. Check this again after changing a
color token.

### Fonts

- **Poppins only** (from `docs/ref/slika3.png`), weights 400, 500, 600, 700.
- Page title: 24 px (`text-2xl`) on mobile, 28–30 px (`md:text-3xl`), weight 600.
- Section title ("Spaces near you"): 18 px (`text-lg`), weight 600.
- Body: 14–16 px (`text-sm`/`text-base`), weight 400; meta 12–14 px in `muted-foreground`.
- Prices: weight 600, unit in `muted-foreground`: "€4 /hr", desks "€3 /desk·hr". `SpacePrice`
  (`features/spaces/components/space-price.tsx`) writes every price pill, so the unit is the same everywhere.
- At most two heading sizes per screen.

### Shape

- Everything is rounded, no sharp corners.
- Cards, images and sheets: `rounded-lg` (1rem); large sheets `rounded-xl`.
- Buttons, inputs, search, chips, tabs, price pills and the bottom nav: `rounded-full`.
- Thin `border` instead of shadows. `shadow-soft` only for elements that float above content.

### Images

- **Real photos** of the spaces: 16:10 at the top of the space card, rounded, `object-cover`, always
  with `alt`.
- **Flat illustrations** for the category options (All, Desk, Meeting room, Office, Event hall), in the
  style of slika2. They are inline SVG components
  (`features/spaces/components/category-illustration.tsx`) filled only with tokens: `primary`,
  `chart-2` (pale blue) and `foreground` (navy outlines), so they follow light and dark mode and need
  no hex values.

### Icons

`lucide-react` only, 16–20 px, stroke matches text color. Illustrations are not icons and do not
replace them.

## Layout

- **Mobile (375 px)**: the sky background at the top, content in a white sheet
  (`bg-card rounded-t-xl`). A slim top bar holds the wordmark (+ "Hosting" badge), the theme toggle and
  the account button. A navy pill bottom nav floats at the bottom (`bg-sidebar rounded-full shadow-soft`) with
  the mode's items as icons; the active item is a blue pill with icon and label.
- **Fixed bars on phones**: the scroll padding in `index.css` keeps a focused field above the bottom
  nav; a bar fixed above it (the booking bar) sets `data-booking-bar`, which raises that padding.
- **Desktop (md+)**: a navy sidebar on the left with only the wordmark and the same items (icon +
  label). The theme toggle and the account ("Log in", or name + "Log out") sit in a slim top bar on the
  right, above the content. Nothing important goes at the bottom of the fixed sidebar: a short window can hide it.
  Content on the right, max width ~1200 px. Space cards in a grid: 1 column → 2 at `md`
  → 3 at `lg`.
- Spacing: large gaps between sections (`py-12` or more on desktop, `py-8` on mobile), small gaps inside
  groups (`gap-2` to `gap-4`).

## Key patterns (from slika2)

- **Search**: `muted` pill input with a `Search` icon, next to it a round outline filter button.
- **Categories**: a row of illustration + label (All, Desk, Meeting room, Office, Event hall); the selected
  one has a `primary` label and a thin `primary` border.
- **Space card**: photo, name (600), address (`muted-foreground`, one line, truncated), opening hours
  with a `Clock` icon, availability in `success` (desks: "23 desks available"; "Fully booked now" /
  "Closed now" and "Up to 8 people" stay `muted-foreground`), price pill "€3 /hr" in `secondary` at the
  bottom right. The price per hour is **always** visible. The whole card links to `/spaces/:id`. Cards always
  stack down the page on phones (one column), never in a sideways row.
- **Tabs**: text tabs with a `primary` underline under the active one.
- **Selectable list rows**: white row with border; selected = `secondary` background + `primary`
  border; rating badge in `primary` ("5 ★"); `ChevronRight` on the right.
- **Booking summary**: label/value rows, a dashed divider before the total, total in weight 600.
- **Main action**: one full-width `primary` pill button at the bottom of the screen.
- **Host space card** (My spaces): the space card plus a "Draft" `secondary` badge for unlisted
  spaces, the active booking count ("2 bookings · 1 pending" or "No active bookings", it wraps on
  phones instead of truncating), the price pill on its own row at the right, and two actions: outline
  pill "Edit" and ghost "Delete" in `destructive`.
- **Space form** (Add a space / Edit space): one column (`max-w-2xl`) under a "My spaces" back link,
  in sections with a `text-lg` title: About the space (name, optional description, category chips),
  Location, size and price ("Number of desks" appears only for Desk), Opening hours (a row per day:
  `Switch` + two pill selects in whole hours, "Closed" when off), Photos (link fields with a 16:10
  thumbnail, the first is the cover, "Add photo" up to 8). Category chips are radio buttons styled as
  pills; selected = `secondary` background, `primary` border and `secondary-foreground` label
  (`primary` text on `secondary` is under 4.5:1). Errors under each field in
  `destructive`; a server error in the `role="alert"` box above the buttons. New: `primary` "Publish
  space" + outline "Save as draft"; Edit: a "Listed" `Switch` row and `primary` "Save changes". Full
  width on phones, auto width from `md`; disabled with a spinner while saving. After saving the app
  returns to My spaces, where a status notice says "{name} is published", "{name} was saved as a
  draft" or "Changes to {name} were saved".
- **Delete confirmation**: `AlertDialog` "Delete {name}?" with what happens and that it can't be
  undone; Cancel (outline) + "Delete" (`bg-destructive text-destructive-foreground`). The dialog
  stays open while deleting and on an error; afterwards focus moves to the list and a status notice
  says "{name} was deleted".
- **Blocked delete**: a space with active bookings cannot be deleted. "Delete" still opens the dialog,
  so the reason is always reachable (a disabled button would hide it): "You can't delete {name} yet",
  "It has 2 active bookings. You can delete it once they are finished or cancelled.", one outline "OK",
  no destructive button.
- **Booking status badges** (outline): Pending muted, Confirmed `success`, Cancelled `destructive`,
  Finished muted, Expired muted with a dashed border. Only Pending and Confirmed (upcoming) are
  "active"; past bookings become Finished (was confirmed) or Expired (was never confirmed).
- **My bookings** (`/bookings`): text tabs "Upcoming" and "Past" with a count pill; the open tab is in
  the URL (`?tab=past`). Upcoming = pending and confirmed, soonest first; Past = finished, expired and
  every cancelled booking, newest first. Booking card = the space card layout: cover photo (joined in
  by the route), status badge, space name, address, date (`CalendarDays`) and slot with hours
  (`Clock`), total in the price pill. The whole card links to `/spaces/:id` (stretched link on the
  name); an active booking also has a ghost "Cancel booking" in `destructive` above that link.
- **Cancel booking**: `AlertDialog` "Cancel your booking?" with the space, date and slot; "Keep booking"
  (outline) + "Cancel booking" (`bg-destructive`). Same behavior as the delete confirmation; afterwards
  focus moves to the Upcoming panel and a status notice says "Your booking at {space} was cancelled.
  You can find it under Past."
- **Empty state**: white card with a `lucide` icon in `primary`, one heading, one line of text and one
  `primary` pill action ("You have no spaces yet" → "Add your space"). Every empty list and every
  "not found" page renders `EmptyState` (`src/components/feedback/empty-state.tsx`); a "not found"
  page passes its `PageTitle` as the heading. The action is left out only when there is nothing to do
  next.
- **Status notice**: the visible result of an action, a line in `secondary` with a `primary` border and
  a `CircleCheck`, always rendered as a `role="status"` live region. Code:
  `src/components/feedback/status-notice.tsx`.

## Popular time (from slika3)

- On the space page (and for hosts on their own space): "Popular time" heading + day tabs Mon–Sun
  (pill chips; selected = `primary`).
- Bar chart per hour, 8:00–22:00, x labels every 3 hours ("9", "12", "15", "18", "21"), rounded bars,
  no y axis.
- Other hours in `chart-2`, the selected/current hour in `chart-1`.
- One line of text under the chart: "Usually busiest around 16:00".
- Loading: skeleton bars. Empty: "Not enough data yet". Error: short message + "Try again".
- Marks: bars at most 24px wide with a 2px gap, a 4px rounded top (`rounded-t-xs`, token
  `--radius-xs`) and square on a hairline `border` baseline.
- The selected hour's value sits in a small pill above its bar ("72% at 16:00"); hover, tap, focus or
  the arrow keys change it (one tab stop for the whole chart). Every value is also in "Show as table".
- `chart-2` is a de-emphasis color with low contrast against the card by design, which is why the
  table view and the readout are required, not optional. Dark `chart-1` is L 0.66 so it stays inside
  the dark-mode band for chart marks (checked with the dataviz palette validator).
- Code: `features/bookings/components/popular-times.tsx`.

## Auth pages (`/login`, `/signup`)

- Mobile: sky `background` at the top with the "Zona" wordmark (`text-2xl`, `primary`), under it a
  white sheet (`bg-card rounded-t-xl`) with the form.
- md+: the same form in a white card (`max-w-md`, `rounded-lg`, thin border, no shadow) on the sky
  background, pinned near the top (`py-16`), not vertically centered, so it does not jump when errors
  appear.
- One centered heading ("Log in" / "Create account", `text-2xl md:text-3xl`) and one short line of
  text under it. The wordmark is never bigger than the heading.
- The theme toggle sits top right: in the wordmark's row on phones, where the app's top bar has it on md+.
- Labeled inputs and the submit button are `rounded-full`; full-width `primary` submit.
- Field errors under the input in `destructive`; rules that must stay visible (e.g. "At least 8
  characters") are hint text under the field, not a placeholder.
- A server error ("Wrong email or password") in a `role="alert"` box with a `CircleAlert` icon above
  the button. It takes focus when it appears, because the submit button is disabled while pending.
- Under the button: "No account? Sign up" / "Have an account? Log in", and a "Continue browsing" link
  back to `/`. Links are always underlined, not only on hover.
- A signed-in user who opens `/login` or `/signup` is sent on to `?redirect=` or home.

## Profile (`/profile`, from profilePageUI)

- Three cards under the page title, `gap-6`, each `rounded-lg border bg-card p-4 md:p-6`, no shadow:
  1. Header: `UserAvatar` (`lg`), name, role ("Guest" / "Guest and host"), city with `MapPin`.
  2. "Personal information": `text-lg` title and an outline pill "Edit" (`Pencil`) above a divider, then
     label/value pairs (label in `muted-foreground`, value weight 500): Name, Email, City, Member
     since, Role; About spans the whole row. One column on phones, 2 at `md`, 3 at `lg`. A missing
     value says "Not set" / "No bio yet." in `muted-foreground`.
  3. "Mode": one line ("You are renting spaces now." / "You are hosting now.") and the mode switch.
- "Edit" turns the pairs into fields in the same card: Name, City (optional) and About (optional, with
  an x/200 counter); email and password changes come with the backend. `primary` "Save" + outline
  "Cancel", full width on phones; disabled with a spinner while saving; a server error in the
  `role="alert"` box. Focus goes to Name on Edit and back to "Edit" after Save or Cancel; after saving,
  a status notice says "Your profile was saved."
- Code: `features/users/components/profile-details.tsx` (and `profile-header.tsx`,
  `profile-mode-card.tsx`).

## Accessibility

- Text at least 4.5:1; input borders (`input` token) and focus rings at least 3:1 against `card`.
- Focus is always visible: `focus-visible:ring-[3px] focus-visible:ring-ring` (full opacity), with
  `ring-offset-2` on filled pill buttons so the ring does not blend into `primary`.
- When an action disables or removes the focused element, move focus to its result.
- Tap targets at least 44 px tall on phones: buttons and chips are `h-11 md:h-9` (shadcn's default is
  36 px), text links `inline-flex min-h-11 items-center md:min-h-0`, and a smaller control (`Switch`)
  gets a larger `after:` hit area.

## Dark mode

Both themes from day one. The `dark` class on `<html>` turns it on. Deep navy background, slightly
lighter navy cards, lighter blue `primary` with navy text. Every page is checked in both themes.

- **Theme toggle** (`src/components/layout/theme-toggle.tsx`): a round outline icon button
  (`size-11 md:size-9`) in the top bar and on the auth pages. A click flips between light and dark; the
  icon shows the theme it switches to (`Sun` on dark, `Moon` on light) and turns and fades into the
  other one, and the label says the same ("Switch to light theme"). The new theme spreads in a circle
  from the button (View Transitions API); without it, or with reduced motion, it switches at once.
- System follows `prefers-color-scheme` and is the default until the first click. The choice is saved per device in
  `localStorage` (`src/lib/theme.ts`); a script in `index.html` applies it before the first paint, so a
  dark page never flashes light.

## References

- `docs/ref/slika2.png` (coworking app): **everything**: colors, layout, bottom nav, search + filter,
  category row, space card, tabs, selectable rows, booking summary, pill CTA.
- `docs/ref/slika3.png` (parking app): **only the font** (Poppins-like geometric sans) and the
  **Popular time** chart. Not its black buttons, black chips or grey palette.
- `docs/ref/profilePageUI.png` (profile page): **only the layout** of Profile: a header card, cards
  with a title and "Edit", label/value pairs in columns. Not its orange and green palette.

## Don't

- Gradients without a reason, emoji instead of icons, a "Welcome to…" hero
- Everything in cards with shadows; heavy shadows in general
- Sharp corners
- Hidden prices ("Contact us for a price"): the price per hour is always on the card
- Black buttons and chips (from slika3); the main action is always `primary`
- Pink (`highlight`) for anything other than discounts and "Popular"
- Different colors for host mode: the mode changes navigation, not the theme
