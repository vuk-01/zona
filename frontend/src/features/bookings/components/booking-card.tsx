import { cva } from 'class-variance-authority'
import { CalendarDays, Clock, ImageOff } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  // guest: one of their own bookings, with "Cancel booking" while it is active. host: a booking of one of
  // their spaces, with the guest and, while it is pending, Approve and Decline.
  variant?: 'guest' | 'host'
  onCancelled?: (booking: Booking) => void
  onReviewed?: (booking: Booking, decision: ReservationDecision) => void
}

// A booking. Only the space's name is a link (to the space page); the card itself is not clickable, so
// the actions below never compete with a link around them.
export function BookingCard({ booking, variant = 'guest', onCancelled, onReviewed }: BookingCardProps) {
  const hours = bookingHours(booking.startTime, booking.endTime)
  // The space's cover photo comes with the booking; null when the space has none
  const imageUrl = booking.space.imageUrl

  return (
    <Card className="h-full gap-4 overflow-hidden rounded-lg pt-0 pb-4 shadow-none">
      {imageUrl === null ? (
        <div className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ImageOff className="size-6" aria-hidden="true" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-muted">
          <img
            src={imageUrl}
            alt={`Photo of ${booking.space.name}`}
            className="aspect-[16/10] w-full object-cover"
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
            className="rounded-xs underline-offset-4 outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring"
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
          <div className="self-start">
            <CancelBookingDialog booking={booking} onCancelled={onCancelled} />
          </div>
        )}
        {variant === 'host' && booking.status === 'pending' && (
          <ReservationActions booking={booking} onReviewed={onReviewed} />
        )}
      </CardContent>
    </Card>
  )
}
