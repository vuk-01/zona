import { cva } from 'class-variance-authority'
import { CalendarDays, Clock, ImageOff } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type Booking, isActive } from '@/lib/booking'

import { STATUS_LABELS } from '../types'
import { CancelBookingDialog } from './cancel-booking-dialog'
import { bookingHours, formatBookingDate } from './format-booking'

const statusBadge = cva('rounded-full', {
  variants: {
    status: {
      pending: 'text-muted-foreground',
      confirmed: 'border-success text-success',
      cancelled: 'border-destructive text-destructive',
      // Past bookings: quiet, they no longer need attention
      finished: 'text-muted-foreground',
      expired: 'border-dashed text-muted-foreground',
    },
  },
})

type BookingCardProps = {
  booking: Booking
  // The space's cover photo, joined in by the route: undefined while the spaces load, null when there is none
  imageUrl?: string | null
  onCancelled?: (booking: Booking) => void
}

// One of the guest's bookings. The whole card opens the space page: the name is a link stretched over
// the card, and "Cancel booking" sits above it, so the button is never inside the link.
export function BookingCard({ booking, imageUrl, onCancelled }: BookingCardProps) {
  const hours = bookingHours(booking.startTime, booking.endTime)

  return (
    <Card className="relative h-full gap-4 overflow-hidden rounded-lg pt-0 pb-4 shadow-none transition-colors has-[a:hover]:border-primary has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring">
      {imageUrl === undefined ? (
        <Skeleton className="aspect-[16/10] w-full rounded-lg" />
      ) : imageUrl === null ? (
        <div className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ImageOff className="size-6" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={`Photo of ${booking.space.name}`}
          className="aspect-[16/10] w-full rounded-lg bg-muted object-cover"
        />
      )}
      <CardHeader className="gap-2 px-4">
        <Badge variant="outline" className={statusBadge({ status: booking.status })}>
          {STATUS_LABELS[booking.status]}
        </Badge>
        <CardTitle className="text-base leading-snug font-semibold wrap-break-word">
          <Link
            to={`/spaces/${booking.spaceId}`}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {booking.space.name}
          </Link>
        </CardTitle>
        <p className="truncate text-sm text-muted-foreground">{booking.space.address}</p>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3 px-4 text-sm">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
              {formatBookingDate(booking.date)}
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              {booking.startTime}–{booking.endTime} · {hours} {hours === 1 ? 'hour' : 'hours'}
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 font-semibold text-secondary-foreground">
            <span className="sr-only">Total </span>€{booking.totalPrice}
          </span>
        </div>
        {isActive(booking.status) && (
          <div className="relative z-10 self-start">
            <CancelBookingDialog booking={booking} onCancelled={onCancelled} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
