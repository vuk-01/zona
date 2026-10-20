import { useSearchParams } from 'react-router'

import { type Booking, isActive } from '@/lib/booking'

export type BookingTab = 'upcoming' | 'past'

// Upcoming: still pending or confirmed, soonest first (the API sorts by date and time). Past: everything
// else, so finished, expired and every cancelled booking (also one for a later date), newest first.
// The API already returns the status right now, so a booking whose slot has ended is never active.
export function splitBookings(bookings: Booking[]) {
  return {
    upcoming: bookings.filter((b) => isActive(b.status)),
    past: bookings.filter((b) => !isActive(b.status)).reverse(),
  }
}

// The open tab lives in the URL (?tab=past), so going back from a space page lands on the same tab.
export function useBookingTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: BookingTab = searchParams.get('tab') === 'past' ? 'past' : 'upcoming'

  const setTab = (next: string) =>
    setSearchParams(
      (params) => {
        if (next === 'past') params.set('tab', 'past')
        else params.delete('tab')
        return params
      },
      { replace: true },
    )

  return [tab, setTab] as const
}
