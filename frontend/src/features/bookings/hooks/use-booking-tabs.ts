import { useSearchParams } from 'react-router'

import { type Booking, isActive } from '../types'

// Who looks at the bookings: a guest at their own (My bookings), or a host at those of their spaces
// (Reservations).
export type BookingView = 'guest' | 'host'

export type BookingTab = 'pending' | 'upcoming' | 'past'

// The first tab opens by default. The host starts on Pending: those are the bookings waiting for them.
export const VIEW_TABS: Record<BookingView, BookingTab[]> = {
  guest: ['upcoming', 'past'],
  host: ['pending', 'upcoming', 'past'],
}

// Guest: Upcoming is everything still pending or confirmed, soonest first (the API sorts by date and
// time). Host: Pending and Upcoming (confirmed) split that in two. Past & cancelled: everything else,
// so finished, expired, declined and every cancelled booking (also one for a later date), newest first.
// The API already returns the status right now, so a booking whose slot has ended is never active.
export function splitBookings(bookings: Booking[], view: BookingView): Record<BookingTab, Booking[]> {
  const past = bookings.filter((b) => !isActive(b.status)).reverse()
  if (view === 'guest') return { pending: [], upcoming: bookings.filter((b) => isActive(b.status)), past }
  return {
    pending: bookings.filter((b) => b.status === 'pending'),
    upcoming: bookings.filter((b) => b.status === 'confirmed'),
    past,
  }
}

// The open tab lives in the URL (?tab=past), so going back from a space page lands on the same tab. The
// default tab is left out of the URL.
export function useBookingTab(view: BookingView) {
  const tabs = VIEW_TABS[view]
  const [searchParams, setSearchParams] = useSearchParams()
  const fromUrl = tabs.find((t) => t === searchParams.get('tab'))
  const tab: BookingTab = fromUrl ?? tabs[0]

  const setTab = (next: string) =>
    setSearchParams(
      (params) => {
        if (next !== tabs[0] && tabs.some((t) => t === next)) params.set('tab', next)
        else params.delete('tab')
        return params
      },
      { replace: true },
    )

  return [tab, setTab] as const
}
