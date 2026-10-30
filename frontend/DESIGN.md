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
  - Guest nav: "Discover" (Home, Explore) and "You" (Favorites, Bookings, Profile)
  - Host nav: "Hosting" (My spaces, Reservations) and "You" (Profile); "Add a space" is a CTA on My
    spaces, not a nav item. The section titles only show in the side menu (desktop).
  - Reservations carries the number of pending bookings as a small `sidebar-primary` pill: at the right
    end of the row in the side menu, on the top right of the icon in the tab bar (with a `sidebar` ring).
    It is left out at 0; screen readers hear "Reservations, 2 pending".
  - After switching, the app goes to that mode's home: guest → `/`, host → `/host/spaces`
- In host mode a small "Hosting" `Badge` sits next to the logo in the side menu and in the mobile top
  bar, so it is always clear which mode is on.
- Host screens reuse the guest patterns: space card (with status "Listed" / "Draft"), Popular time (so
  the host sees when their space is busy), and a full-width pill CTA "Add a space".

## Routes

| Mode  | Path                    | Page                    | Access                  |
| ----- | ----------------------- | ----------------------- | ----------------------- |
| guest | `/`                     | Home ("Find your zone") | everyone                |
| guest | `/spaces`               | Explore spaces          | everyone                |
| guest | `/spaces/:id`           | Space details           | everyone                |
| guest | `/favorites`            | Favorites               | signed in               |
| guest | `/bookings`             | My bookings             | signed in               |
| both  | `/profile`              | Profile + mode switch   | signed in               |
| host  | `/host/spaces`          | My spaces               | signed in, in host mode |
| host  | `/host/spaces/new`      | Add a space             | signed in, in host mode |
| host  | `/host/spaces/:id/edit` | Edit space              | signed in, in host mode |
| host  | `/host/reservations`    | Reservations            | signed in, in host mode |

- Signed out on a protected page (opened by its address, e.g. typing `/bookings`): go to
  `/login?redirect=<page>`, and back there after logging in. `/login` and `/signup` are for these
  redirects and direct links; inside the app, "Log in" and a visitor's click on Favorites, Bookings or
  Profile in the navigation open the login dialog instead (see "Login dialog").
- In guest mode on a host page: go to `/`, the guest home. Switching from host to guest on a host page
  lands there too, so the redirect and the switch never send the user to two different places.

## Sign-in rules

- Browsing, searching and viewing spaces work **without** signing in.
- Booking a space, saving a favorite and listing a space **require** signing in. A visitor's "Log in to
  book" or click on a heart opens the login dialog over the page; once they have logged in or created an
  account, the action goes on (the picked slot is booked, the space is saved). Closing the dialog drops
  the action.
- Login: email and password. Sign-up: name, email and password.
- Google login comes later with the real backend and is not shown now. The login dialog shows "Remember
  me" and "Forgot password?", but neither does anything yet: the box is not sent, and the link only says
  (a toast) that resetting a password comes with the real backend.

## Tone

Playful, friendly, modern. Short, warm UI copy ("Find your zone", "23 desks available"), no jargon.

## Visuals

### Colors

Tokens live in `src/index.css`, light in `:root` and dark in `.dark`. The palette is taken from
`docs/ref/slika2.png`.

| Token                                    | Use                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `background`                             | sky-blue page background                                                                                      |
| `foreground`                             | navy text                                                                                                     |
| `card`, `popover`                        | white cards and dialogs; in dark mode the lightest surface, so cards stand out                                |
| `sheet`                                  | phones: the content sheet under the top bar; white, in dark mode between page and cards                       |
| `primary`                                | main CTA (Book, Checkout), active tab, selected bar, links                                                    |
| `secondary`                              | pale blue pills: price pill ("€4–8 /hr"), selected list row, mode switch button                               |
| `muted` / `muted-foreground`             | search field and inactive chips / addresses, "/hr", meta text                                                 |
| `accent`                                 | hover backgrounds only (shadcn uses it this way), pale blue                                                   |
| `highlight`                              | pink: **only** for discounts ("−30%") and the "Popular" badge                                                 |
| `success`                                | green: availability ("23 desks available", "Open now")                                                        |
| `warning`                                | amber: **only** the "Pending" booking badge (waiting for the host); 5:1 on `card`, 7.9:1 in dark              |
| `favorite`                               | red: **only** the favorite heart (its outline on hover, filled once saved); 4.8:1 on `card`, 5.1:1 in dark    |
| `destructive` / `destructive-foreground` | errors, cancel booking, delete / text on a `destructive` button (white light, navy dark)                      |
| `border` / `input`                       | dividers and card borders / input borders (stronger, 3:1 against `card`)                                      |
| `sidebar-*`                              | navy navigation: tab bar on phones, side menu on desktop; `sidebar-primary` = the active item's icon and line |
| `chart-1` / `chart-2`                    | Popular time: selected (busy) hour / other hours                                                              |
| `shadow-soft`                            | floating elements (sheets, popovers, the booking bar) and buttons and chips on hover                          |
| `shadow-lift`                            | a clickable card on hover (space card, booking card, New on Zona); deeper in dark mode                        |
| `overlay`                                | dims the page behind dialogs (navy at 50%, black at 60% in dark)                                              |

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
- Buttons, inputs, search, chips, tabs and price pills: `rounded-full`. The side menu's rows and its
  account surface: `rounded-lg` / `rounded-xl`.
- Thin `border` instead of shadows. `shadow-soft` only for elements that float above content, and for
  buttons on hover; `shadow-lift` only for a clickable card on hover (see "Motion").

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
  (`bg-sheet rounded-t-xl`). A slim top bar holds the wordmark (`text-2xl`, + "Hosting" badge), the
  theme toggle and the account button. A full-width navy tab bar sits at the bottom
  (`components/layout/bottom-nav.tsx`: `bg-sidebar`, a `sidebar-border` line on top, clear of the home
  indicator) with every item as icon and label; the active tab has a `sidebar-primary` icon, a semibold
  label and a short `sidebar-primary` line on top that slides to the tab that opens.
- **Fixed bars on phones**: the scroll padding in `index.css` keeps a focused field above the tab bar;
  a bar fixed above it (the booking bar) sets `data-booking-bar`, which raises that padding.
- **Desktop (md+)**: a navy side menu on the left (18rem, `components/layout/sidebar.tsx`); in dark mode
  a `sidebar-border` line separates it from the content.
  - On top the wordmark (`text-2xl`), then the items in sections with small uppercase titles
    (`text-xs`, `sidebar-foreground/70`). Wordmark, titles and icons all start at 32 px.
  - Items are `rounded-lg` rows (icon + label). The active one has a `sidebar-accent` row, a
    `sidebar-primary` icon, weight 600 and a `sidebar-primary` accent line in the gutter that slides to
    the item that opens; hover tints the row (`sidebar-accent/40`) and nudges the label right.
  - At the bottom the account on its own surface (`sidebar-accent`, `rounded-xl`,
    `components/layout/sidebar-account.tsx`): photo or initials, name, email and "Log out"; a visitor
    sees "Find your zone", one line and "Log in". Only the items scroll, so the account stays in view
    on a short window.
  - The theme toggle sits in a slim top bar on the right, above the content. Content on the right, max
    width ~1200 px. Space cards in a grid: 1 column → 2 at `md` → 3 at `lg`.
- On phones the account stays in the top bar ("Log in", or "Log out"), since there is no side menu.
- Spacing: large gaps between sections (`py-12` or more on desktop, `py-8` on mobile), small gaps inside
  groups (`gap-2` to `gap-4`).

## Key patterns (from slika2)

- **Hero panel** (`src/components/layout/hero-panel.tsx`): the top of Home, Explore, Favorites, My
  bookings, Profile and the host pages (My spaces with "Add a space", Add a space and Edit space with the "My spaces"
  back link above the title). One `card` panel (`rounded-xl`, thin border, `p-8` on md+) holds the page title and the page's
  main controls, over flat shapes in the style of the category illustrations: a big `secondary` circle top
  right, a patch of `input` dots (`bg-dots`, `lg` only, next to the title) and, on the tall panels with
  an aside (Home, Explore), a `chart-2` ring in the bottom-left corner. On phones it is the top of the sheet, edge to edge, so it is
  always the page's first element. On `lg` an aside can sit on its right (20rem): **New on Zona** on
  Home, the **category spotlight** on Explore.
- **Search**: `muted` pill input with a `Search` icon, next to it a round outline filter button and a `primary`
  "Search" button (round with only the icon on phones, where the field needs the room). The pill outlines
  `primary` on hover and turns `card` with a `primary` icon while typing; the filter button stays `secondary`
  with a `primary` border while the filters are open. A click in the field opens the city list under it (a
  floating card like the time select's, "Cities" title, pill rows with a `MapPin`, scrolls after six); typing
  filters it and bolds the matching part. Picking a city only fills the field; Search or Enter runs it
  (`/spaces?city=` for a picked city, `/spaces?q=` for typed text). Code:
  `features/spaces/components/space-search.tsx` and `search-suggestions.tsx`.
- **Search chips** (Explore): the active search above the results, "Podgorica ✕" or "“hub” ✕", as a selected
  chip (`secondary`, `primary` border, `secondary-foreground` label) that is one button; a click removes that
  filter and moves focus to the results.
- **Categories**: illustration + label per category (All, Desk, Meeting room, Office, Event hall), and the
  number of spaces as a small round badge on each illustration (`primary` on the selected one). The
  numbers follow the search and price filters, never the category itself. The selected one sits in a
  `secondary` box with a thin `primary` border that slides to the new category (label
  `secondary-foreground`, since `primary` text on `secondary` is under 4.5:1). Phones: centered, and when
  they do not fit one row they wrap, the last row centered too; md+: left-aligned.
- **Live line** (Home, under the title): "● 5 open now · 5 spaces in Podgorica"; the open count in
  `success` with a slowly pulsing dot.
- **New on Zona** (Home aside): the newest listed space as a photo card (4:3 photo, `primary` "New on
  Zona" badge, the favorite heart top right, name, category · city, price pill) on a small fanned stack
  (`chart-2` and `primary/30` cards behind it) that opens a little further on hover.
- **Category spotlight** (Explore aside): the selected category's illustration on a `background` circle,
  its name and one line about it, "Spaces" and "From" (price pill), and one status line ("25 desks free
  now", "2 open now" in `success`, or "Closed now" / "None listed yet" in `muted-foreground`). It keeps
  its height for every category, so nothing around it moves.
- **Space card**: photo, name (600), address (`muted-foreground`, one line, truncated), opening hours
  with a `Clock` icon, availability in `success` (desks: "23 desks available"; "Fully booked now" /
  "Closed now" and "Up to 8 people" stay `muted-foreground`), price pill "€3 /hr" in `secondary` at the
  bottom right. The price per hour is **always** visible. The favorite heart sits top right on the photo
  (Home, Explore, Favorites). The whole card links to `/spaces/:id`: the name is a link stretched over the
  card and the heart sits above it, so a click on the heart never opens the space; the card stays lifted
  while the pointer is on the heart. Cards always stack down the page on phones (one column), never in a
  sideways row.
- **Home**: the hero panel, then "Spaces near you" with **three** listed spaces; the rest are on Explore.
  "See all" is an outline pill button (`h-11 md:h-9`) at the right of the section title, with an
  `ArrowRight` that nudges right on hover, and goes to `/spaces`.
- **Favorite heart** (`features/favorites/components/favorite-button.tsx`, wired to the signed-in user in
  `src/app/favorite-heart.tsx`): a round toggle button (`aria-pressed`, `size-11 md:size-9`) with a
  `Heart`. On a card's photo it is a `card` disc with `shadow-soft` (it floats over the photo); next to
  the title on the space page it is an outline button like the theme toggle (only for listed spaces). The
  outline is `foreground` and turns `favorite` on hover; a click fills it `favorite` and saves the space,
  the next click empties it and removes it again. Every click pulses the heart once. All hearts of a
  space read one query, so Home, Explore, Favorites and the space page always agree, and they change at
  once (optimistic) and go back if saving fails.
- **Favorites** (`/favorites`): the title and one line in the hero panel, then "3 spaces" and the saved
  spaces as space cards, newest saved first. Removing one on this page fades and shrinks its card away
  (300ms) before the grid closes the gap; focus moves to the list. Empty: `EmptyState` with a `Heart`,
  "No favorites yet", "Tap the heart on any space to save it here." and "Explore spaces"; when the last
  card is removed, it comes in once that card has faded out.
- **Tabs**: text tabs with a `primary` underline under the active one; the underline slides to the tab
  that opens.
- **Selectable list rows**: white row with border; selected = `secondary` background + `primary`
  border; rating badge in `primary` ("5 ★"); `ChevronRight` on the right.
- **Time select** (`src/components/form/time-select.tsx` on `components/ui/select.tsx`): booking From / To
  and a space's opening hours. A pill with a `Clock`, the hour and a round `secondary` chip with a
  `ChevronDown`; the pill outlines `primary` on hover and while open, and the chip turns `primary` and
  upside down when the list opens. The list is a floating card (`rounded-lg`, `shadow-soft`) under the
  field that fades, grows and slides in (200ms) and back out when it closes (150ms); it shows about six
  hours and scrolls to the selected one. Rows are pills, 44 px tall on phones: hover or the arrow keys give
  an `accent` background and nudge the hour right; the selected hour is a selectable list row (`secondary`,
  `primary` border, weight 600) with a `primary` check.
- **Booking summary**: label/value rows, a dashed divider before the total, total in weight 600.
- **Main action**: one full-width `primary` pill button at the bottom of the screen.
- **Host space card** (My spaces): the space card plus a "Draft" `secondary` badge for unlisted
  spaces, the active booking count ("2 bookings · 1 pending" or "No active bookings", it wraps on
  phones instead of truncating), the price pill on its own row at the right, and two actions: outline
  pill "Edit" and ghost "Delete" in `destructive`. The whole card opens the editor: the Edit link is
  stretched over the card and Delete sits above it, so the card lifts like a space card and Edit turns
  `accent` when the pointer is anywhere on it except Delete. The Edit link is a ghost pill with a border,
  not outline: a lift (translate) on it would make it its stretched area's containing block.
- **Space form** (Add a space / Edit space): the "My spaces" back link and the title in the hero panel,
  under it one column (`max-w-2xl`) of section cards (`rounded-lg border bg-card p-4 md:p-6`, not
  clickable, so they never lift; they fade in on scroll), each with a `text-lg` title: About the space
  (name, optional description, category chips), Location, size and price ("Number of desks" appears only
  for Desk), Opening hours (a row per day: `Switch` + two time selects in whole hours, "Closed" when off),
  Photos (link fields with a 16:10
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
- **Booking status badges** (outline): Pending `warning`, Confirmed `success`, Declined and Cancelled
  `destructive`, Finished muted, Expired muted with a dashed border. Only Pending and Confirmed
  (upcoming) are "active"; past bookings become Finished (was confirmed) or Expired (was never
  confirmed). Guests and hosts see the same badges.
- **My bookings** (`/bookings`): the title and the text tabs "Upcoming" and "Past" (with a count pill)
  share the hero panel; the cards are below it. The open tab is in the URL (`?tab=past`). Upcoming = pending and confirmed, soonest first; Past = finished, expired,
  declined and every cancelled booking, newest first. The count pill has a `card` ring, so it still
  reads where it sits on the hero panel's `secondary` circle (phones). Booking card = the space card layout: cover photo (joined in
  by the route), status badge, space name, address, date (`CalendarDays`) and slot with hours
  (`Clock`), total in the price pill. The whole card links to `/spaces/:id` (stretched link on the
  name); an active booking also has a ghost "Cancel booking" in `destructive` above that link.
- **Reservations** (`/host/reservations`): the host's side of My bookings, the same list and booking
  card (`features/bookings/components/bookings-list.tsx` with `view="host"`). Tabs "Pending" (the
  default, no `?tab`), "Upcoming" (confirmed) and "Past" (finished, expired, declined, cancelled), each
  with its count pill. The card adds the guest (`UserAvatar` 32 px and name, weight 500) above the date,
  and a pending booking has a `primary` "Approve" (`Check`, fills the row) and a ghost "Decline" (`X`,
  `destructive`) in place of "Cancel booking". Approve needs no confirmation; Decline asks first.
  Afterwards the booking leaves Pending, focus moves to the Pending panel and a toast says
  "Booking confirmed" / "Booking declined" with the guest, space, date and slot. A failed approve (e.g.
  the slot filled up meanwhile) is an error toast with the reason. The count next to Reservations, the
  guest's badge and the counts on My spaces all follow at once. Empty: "No reservations yet" with "Go
  to My spaces"; per tab "All caught up" (Pending), "No upcoming reservations", "Nothing here yet".
- **Decline booking**: `AlertDialog` "Decline this booking?" with the space, guest, date and slot and
  that the guest will see it as declined; "Keep booking" (outline) + "Decline" (`bg-destructive`). Same
  behavior as the cancel dialog.
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
- **Toast**: the result of a quick action in a list that keeps going (Approve / Decline on
  Reservations): a floating `card` (`rounded-lg`, thin border, `shadow-soft`) with a `CircleCheck` in
  `primary` (or an `OctagonX` in `destructive` for an error), a weight-600 title and one line in
  `muted-foreground`. Bottom right on md+, full width above the tab bar on phones; it leaves after 4s and
  can be swiped away. Code: `src/components/ui/sonner.tsx` (shadcn's Sonner, drawn only with tokens),
  mounted once in `AppLayout`; call `toast.success(title, { description })` from `sonner`.

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
  the arrow keys change it (one tab stop for the whole chart). The chart is the only view (no table);
  screen readers get every hour from the bars' labels ("16:00, usually 72% booked").
- `chart-2` is a de-emphasis color with low contrast against the card by design, which is why the
  readout and the bars' labels are required, not optional. Dark `chart-1` is L 0.66 so it stays inside
  the dark-mode band for chart marks (checked with the dataviz palette validator).
- Code: `features/bookings/components/popular-times.tsx`.

## Auth pages (`/login`, `/signup`)

- md+: one wide card (`max-w-4xl`, `rounded-xl`, thin border, `p-2`, no shadow) in two halves. Left: a
  sky (`background`) panel with the hero panel's flat shapes (a big `secondary` circle, a dashed
  `primary/30` ring that turns slowly, a patch of dots), the "Zona" wordmark (`text-2xl`, `primary`),
  "Find your zone" with one line about Zona, the four category illustrations on `card` circles (2×2) and
  the live line. Right: the form. Shell: `src/components/layout/auth-layout.tsx`; the showcase comes from
  the spaces feature through `src/app/auth-shell.tsx`.
- The card sits in the middle of the screen: its top is half the Log in card's height above the middle,
  so Log in is centered and errors make the card grow downward instead of moving it (at least `4rem` from
  the top on short screens).
- Phones: the sky band with the wordmark, the theme toggle, "Find your zone" and the illustrations in a
  row; under it the sheet (`bg-sheet rounded-t-xl`) with the form.
- One heading ("Log in" / "Create account", `text-2xl md:text-3xl`) and one short line under it: centered
  on phones, left-aligned in the form half on md+. The wordmark is never bigger than the heading.
- The theme toggle sits top right: in the wordmark's row on phones, where the app's top bar has it on md+.
- Fields (`features/auth/components/auth-field.tsx`): tall `muted` pills (`h-14`) with an icon and the
  label inside, like a placeholder. On focus the pill turns `card` with a `primary` border, the icon turns
  `primary` and the label moves up (smaller, `primary`); it stays up once there is a value, and only then
  the placeholder shows. Full-width `primary` pill submit.
- Field errors under the input in `destructive`; rules that must stay visible (e.g. "At least 8
  characters") are hint text under the field, not a placeholder.
- A server error ("Wrong email or password") in a `role="alert"` box with a `CircleAlert` icon above
  the button. It takes focus when it appears, because the submit button is disabled while pending.
- Under the button, centered: "No account? Sign up" / "Have an account? Log in", and a "Continue
  browsing" link back to `/`. Links are always underlined, not only on hover.
- Motion: the card grows in (md+) or the sheet slides up (phones), then the heading, the form and
  "Continue browsing" come in one after another (`authEnter`, 300 / 500 / 700ms); the illustrations pop
  in one by one and then float, and the dashed ring turns, slowly. With reduced motion nothing moves.
- A signed-in user who opens `/login` or `/signup` is sent on to `?redirect=` or home.

## Login dialog

"Log in" in the app (the account in the top bar and at the bottom of the side menu), "Log in to book",
a visitor's heart and a visitor's click on Favorites, Bookings or Profile in the side menu or the tab bar
open a dialog over the current page instead of going to `/login`
(`features/auth/components/auth-dialog.tsx`, opened through `src/app/login-dialog.tsx`).

- Look (after `docs/ref/docs/ref/login-reference.png`): a navy (`sidebar`) header with the wordmark
  ("Zona", `text-2xl`) and "Find your zone" over the hero panel's flat shapes (a `sidebar-accent` circle,
  a dashed `sidebar-primary` ring, dots). The sky (`background`) card with the form rises over it with a
  large rounded top (`rounded-t-xl`). One heading, centered: "Welcome back" / "Create account"
  (`text-2xl`), and one line under it.
- The same forms as the auth pages, with the dialog's fields (`features/auth/components/stacked-auth-field.tsx`):
  the label above a `card` pill with a thin `input` border; in the pill the icon, a thin line and the
  input; a password gets an eye button that shows it ("Show password", `aria-pressed`). Hints and errors
  under the pill. Log in has "Remember me" and "Forgot password?" above the button (see "Sign-in rules")
  and "Don't have an account? Sign up" at the bottom; sign-up ends with "Already have an account? Log in".
- "Sign up" / "Log in" under the button switch the dialog between the two without closing it; focus moves
  to the first field of the other form.
- After logging in or signing up the dialog closes and the user stays on the same page, signed in; the
  action that opened it goes on. Focus goes back to the button that opened it while that is still there.
- From the navigation: the item does not open its page (no navigation, the active item stays), and
  after logging in or signing up the user goes to the page they clicked, once the dialog has closed; its
  title takes focus, like after any navigation. Closing the dialog changes
  nothing, not even the URL. A click that opens a new tab (Ctrl/Cmd, middle button) still follows the
  link, and that tab goes to `/login`.
- Closes on the X (top right, round ghost icon button, `size-11 md:size-9`), a click on the `overlay`
  and Esc. Every opening starts at Log in with empty fields.
- Phones: a bottom sheet as tall as its content (at most the screen less 1rem, then it scrolls on its
  own and the page behind stays put). md+: a `max-w-md` dialog in the middle of the screen (`rounded-xl`,
  thin border, `shadow-soft`).
- Motion:
  - Phones: a calm slide. The sheet comes up from below the screen in 250ms (ease-out) while the
    `overlay` fades in, and goes back down in 200ms (ease-in) while it fades out.
  - md+: fades in and zooms from 95% in 200ms (ease-out), and back on close (ease-in); the overlay fades
    along.
  - Log in ↔ sign up: the sheet's height animates to the new form's and the new content fades in, a little
    upward.
  - With reduced motion: no slide, zoom or height animation, only a 150ms fade of the dialog and the
    overlay (see "Motion").

## Profile (`/profile`, from profilePageUI)

- The hero panel holds the page title and the header: `UserAvatar` (`lg`), name, role ("Guest" /
  "Guest and host"), city with `MapPin`. Under it two cards, `gap-6 md:gap-8`, each
  `rounded-lg border bg-card p-4 md:p-6`, no shadow (they are not clickable, so they do not lift); they
  fade in on scroll:
  1. "Personal information": `text-lg` title and an outline pill "Edit" (`Pencil`) above a divider, then
     label/value pairs (label in `muted-foreground`, value weight 500): Name, Email, City, Member
     since, Role; About spans the whole row. One column on phones, 2 at `md`, 3 at `lg`. A missing
     value says "Not set" / "No bio yet." in `muted-foreground`.
  2. "Mode": one line ("You are renting spaces now." / "You are hosting now.") and the mode switch.
- "Edit" turns the pairs into fields in the same card (the fields fade in, and the values again after
  Save or Cancel): Name, City (optional) and About (optional, with
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

## Motion

Subtle and quick, always with a reason: it shows what can be clicked and what just changed. Every
movement is behind `motion-safe:` (or `prefers-reduced-motion: no-preference` in `index.css`); with
reduced motion nothing moves, zooms or fades, and color and shadow changes stay. The one exception is a
dialog: it keeps a short 150ms fade, so it does not pop in and out (`ui/dialog.tsx`, "Login dialog").

- **Clickable cards** (space card, booking card, host space card, New on Zona): on hover the card lifts 4px with
  `shadow-lift` and a `primary/60` border, the photo zooms to 1.05 over 700ms and the name turns
  `primary`. Cards that are not clickable (Profile, empty states) never lift.
- **Buttons** with a surface (default, secondary, outline, destructive) and the price chips lift 2px with
  `shadow-soft` on hover and settle back when pressed (`components/ui/button.tsx`); ghost and link
  buttons only change color. "See all" nudges its arrow right. The favorite heart pulses once on every
  click (450ms, `animate-heart-pulse` in `index.css`).
- **Changes**: the category selection box and the tab underline slide to the new item (300ms, measured
  with `src/lib/use-active-indicator.ts`); the price filter panel slides in when it opens; the category
  spotlight fades in again on a new category; the hero panel fades in when a page opens; a time select's
  list fades and slides in and out, and its chevron chip turns; the side menu's accent line and the tab
  bar's line slide to the item that opens (300ms).
- **Results**: skeletons, results and empty states fade in (300ms). On every filter or tab change the
  cards come in again, one after another along a row (90ms apart). A card removed from Favorites fades and
  shrinks to 95% (300ms; `display` is transitioned with `transition-discrete`, so it leaves the grid at
  the end).
- **On scroll**: section headings and cards further down fade in, 1rem upward, once
  (`src/components/motion/reveal.tsx`, 600ms).

## Dark mode

Both themes from day one. The `dark` class on `<html>` turns it on. Every page is checked in both
themes.

- **Surfaces step up in lightness**, so cards always stand out from what they sit on: page
  `background` (L 0.155) < phone `sheet` (0.195) < navigation `sidebar` (0.225) < `card` (0.275). Card
  on sheet is 1.23:1 and card on page 1.31:1 (before, card and sheet were the same color), with a
  visible `border` (L 0.39).
- Text is brighter (`foreground` L 0.975, `muted-foreground` 0.8: 8:1 on a card), and the blue
  `primary` (L 0.72) and the `secondary` price pill are more vivid, so the important parts stand out.
- The **navigation** (side menu and tab bar) is a navy between the page and the cards, never the page
  color, with a `sidebar-border` line toward the content.

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
- Lifting or zooming things that cannot be clicked; motion that loops or ignores reduced motion (the
  exceptions are the live line's slow pulse and, on the auth pages, the floating illustrations and the
  slowly turning ring; they stop with reduced motion too)
- Sharp corners
- Hidden prices ("Contact us for a price"): the price per hour is always on the card
- Black buttons and chips (from slika3); the main action is always `primary`
- Pink (`highlight`) for anything other than discounts and "Popular"
- Different colors for host mode: the mode changes navigation, not the theme
