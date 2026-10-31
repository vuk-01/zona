import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'

import { useConfirmBooking } from '../api/use-bookings'
import type { Booking } from '../types'
import { DeclineBookingDialog } from './decline-booking-dialog'
import { formatBookingDate } from './format-booking'

// What the host decided; the booking's new status
export type ReservationDecision = 'confirmed' | 'declined'

type ReservationActionsProps = {
  booking: Booking
  // Called after either action. The booking then leaves Pending, so the list moves focus.
  onReviewed?: (booking: Booking, decision: ReservationDecision) => void
}

// Approve and Decline for the host on a pending booking (in place of the guest's "Cancel booking").
// Approve needs no confirmation: it can still be cancelled later. Decline asks first, since it is final.
// Both end with a toast; an approve that fails says why in one: the backend's detail, e.g. "No desks left
// at 10:00" (409 slot_full) or "Only a pending booking can be confirmed" (422 invalid_status_change).
export function ReservationActions({ booking, onReviewed }: ReservationActionsProps) {
  const confirmBooking = useConfirmBooking()
  const when = `${formatBookingDate(booking.date)}, ${booking.startTime}–${booking.endTime}`
  const summary = `${booking.guest.name} · ${booking.space.name}, ${when}`

  // mutateAsync: the card unmounts once the refetched list moves the booking to Upcoming
  const approve = async () => {
    if (confirmBooking.isPending) return
    try {
      await confirmBooking.mutateAsync(booking.id)
      toast.success('Booking confirmed', { description: summary })
      onReviewed?.(booking, 'confirmed')
    } catch (error) {
      toast.error('Could not approve the booking', {
        description: errorMessage(error, 'Please try again.'),
      })
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        className="h-11 flex-1 rounded-full focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:h-9"
        aria-disabled={confirmBooking.isPending}
        aria-label={`Approve ${booking.guest.name}'s booking at ${booking.space.name}, ${when}`}
        onClick={approve}
      >
        {confirmBooking.isPending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Check aria-hidden="true" />
        )}
        {confirmBooking.isPending ? 'Approving…' : 'Approve'}
      </Button>
      <DeclineBookingDialog
        booking={booking}
        disabled={confirmBooking.isPending}
        onDeclined={(declined) => onReviewed?.(declined, 'declined')}
      />
    </div>
  )
}
