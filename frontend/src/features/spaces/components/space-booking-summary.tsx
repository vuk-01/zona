import { CalendarCheck } from 'lucide-react'

import type { Space } from '../types'

type SpaceBookingSummaryProps = {
  counts: NonNullable<Space['bookingCounts']>
}

const activeLabel = (count: number) =>
  count === 0 ? 'No active bookings' : `${count} ${count === 1 ? 'booking' : 'bookings'}`

// Active bookings of a space for its host: "2 bookings · 1 pending". Finished, expired and
// cancelled bookings are not counted.
export function SpaceBookingSummary({ counts }: SpaceBookingSummaryProps) {
  return (
    <span className="flex items-center gap-2">
      <CalendarCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>
        {activeLabel(counts.active)}
        {counts.pending > 0 && <span className="text-muted-foreground"> · {counts.pending} pending</span>}
      </span>
    </span>
  )
}
