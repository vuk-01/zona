import { cva } from 'class-variance-authority'
import { CalendarDays, Clock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { Booking } from '@/lib/booking'

import { STATUS_LABELS } from '../types'

const statusBadge = cva('', {
  variants: {
    status: {
      pending: 'text-muted-foreground',
      confirmed: 'border-success text-success',
      cancelled: 'border-destructive text-destructive',
    },
  },
})

// Dates are stored as 'YYYY-MM-DD'; formatting them in UTC keeps the day from shifting.
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const hoursBetween = (start: string, end: string) => Number(end.slice(0, 2)) - Number(start.slice(0, 2))

type BookingCardProps = {
  booking: Booking
}

export function BookingCard({ booking }: BookingCardProps) {
  const hours = hoursBetween(booking.startTime, booking.endTime)

  return (
    <Card>
      <CardHeader className="gap-2">
        <Badge variant="outline" className={statusBadge({ status: booking.status })}>
          {STATUS_LABELS[booking.status]}
        </Badge>
        <CardTitle className="text-base font-semibold">{booking.space.name}</CardTitle>
        <p className="truncate text-sm text-muted-foreground">{booking.space.address}</p>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4 text-sm">
        <div className="flex flex-col gap-1 text-muted-foreground">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden />
            {dateFormat.format(new Date(`${booking.date}T00:00:00Z`))}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="size-4" aria-hidden />
            {booking.startTime}–{booking.endTime} · {hours} {hours === 1 ? 'hour' : 'hours'}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-3 py-1 font-semibold text-secondary-foreground">
          €{booking.totalPrice}
        </span>
      </CardContent>
    </Card>
  )
}
