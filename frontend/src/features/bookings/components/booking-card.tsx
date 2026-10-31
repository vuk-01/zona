import { cva } from 'class-variance-authority'
import { CalendarDays, Clock, ImageOff } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/user-avatar'

import { type Booking, STATUS_LABELS, isActive } from '../types'
import { CancelBookingDialog } from './cancel-booking-dialog'
import { bookingHours, formatBookingDate } from './format-booking'
import { ReservationActions, type ReservationDecision } from './reservation-actions'

const statusBadge = cva('rounded-full', {
  variants: {
    status: {
      // Waiting for the host
      pending: 'border-warning text-warning',
      confirmed: 'border-success text-success',
      declined: 'border-destructive text-destructive',
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
  // guest: one of their own bookings, with "Cancel booking" while it is active. host: a booking of one of
  // their spaces, with the guest and, while it is pending, Approve and Decline.
  variant?: 'guest' | 'host'
  onCancelled?: (booking: Booking) => void
  onReviewed?: (booking: Booking, decision: ReservationDecision) => void
}

// A booking. The whole card opens the space page: the name is a link stretched over the card, and the
// actions sit above it, so a button is never inside the link. Hovering the link lifts the card like a
// space card (DESIGN.md "Motion"); hovering a button does not.
export function BookingCard({
  booking,
  imageUrl,
  variant = 'guest',
  onCancelled,
  onReviewed,
}: BookingCardProps) {
  const hours = bookingHours(booking.startTime, booking.endTime)

  return (
    <Card className="group relative h-full gap-4 overflow-hidden rounded-lg pt-0 pb-4 shadow-none transition-[translate,box-shadow,border-color] duration-300 ease-out has-[a:hover]:border-primary/60 has-[a:hover]:shadow-lift has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring motion-safe:has-[a:hover]:-translate-y-1">
      {imageUrl === undefined ? (
        <Skeleton className="aspect-[16/10] w-full rounded-lg" />
      ) : imageUrl === null ? (
        <div className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ImageOff className="size-6" aria-hidden="true" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-muted">
          <img
            src={imageUrl}
            alt={`Photo of ${booking.space.name}`}
            className="aspect-[16/10] w-full object-cover transition-transform duration-700 ease-out motion-safe:group-has-[a:hover]:scale-105"
          />
        </div>
      )}
      <CardHeader className="gap-2 px-4">
        <Badge variant="outline" className={statusBadge({ status: booking.status })}>
          {STATUS_LABELS[booking.status]}
        </Badge>
        <CardTitle className="text-base leading-snug font-semibold wrap-break-word">
          <Link
            to={`/spaces/${booking.spaceId}`}
            className="outline-none transition-colors after:absolute after:inset-0 after:content-[''] hover:text-primary"
          >
            {booking.space.name}
          </Link>
        </CardTitle>
        <p className="truncate text-sm text-muted-foreground">{booking.space.address}</p>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3 px-4 text-sm">
        {variant === 'host' && (
          <p className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={booking.guest.name}
              avatarUrl={booking.guest.avatarUrl}
              className="size-8 text-xs"
            />
            <span className="min-w-0 truncate font-medium">
              <span className="sr-only">Guest: </span>
              {booking.guest.name}
            </span>
          </p>
        )}
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
        {variant === 'guest' && isActive(booking.status) && (
          <div className="relative z-10 self-start">
            <CancelBookingDialog booking={booking} onCancelled={onCancelled} />
          </div>
        )}
        {variant === 'host' && booking.status === 'pending' && (
          <div className="relative z-10">
            <ReservationActions booking={booking} onReviewed={onReviewed} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
