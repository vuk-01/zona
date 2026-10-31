import { CircleAlert, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'

import { useDeclineBooking } from '../api/use-bookings'
import type { Booking } from '../types'
import { formatBookingDate } from './format-booking'

type DeclineBookingDialogProps = {
  booking: Booking
  // While the booking is being approved
  disabled?: boolean
  // Called after the decline. The booking then moves to Past, so the list moves focus.
  onDeclined?: (booking: Booking) => void
}

// "Decline" with a confirmation, for the host on a pending booking. Like cancelling a booking, the dialog
// stays open while declining and on an error; afterwards a toast says what happened.
export function DeclineBookingDialog({ booking, disabled, onDeclined }: DeclineBookingDialogProps) {
  const [open, setOpen] = useState(false)
  const declineBooking = useDeclineBooking()
  const when = `${formatBookingDate(booking.date)}, ${booking.startTime}–${booking.endTime}`

  // mutateAsync, not mutate(…, { onSuccess }): this card unmounts as soon as the refetched list moves
  // the booking to Past, and mutate callbacks are skipped after that.
  const confirm = async () => {
    if (declineBooking.isPending) return
    try {
      await declineBooking.mutateAsync(booking.id)
      setOpen(false)
      toast.success('Booking declined', {
        description: `${booking.guest.name} · ${booking.space.name}, ${when}`,
      })
      onDeclined?.(booking)
    } catch {
      // Shown in the dialog
    }
  }

  const onOpenChange = (next: boolean) => {
    if (declineBooking.isPending) return
    setOpen(next)
    if (!next) declineBooking.reset()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-label={`Decline ${booking.guest.name}'s booking at ${booking.space.name}, ${when}`}
          className="h-11 rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring md:h-9"
        >
          <X aria-hidden="true" />
          Decline
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-xl bg-card shadow-soft">
        <AlertDialogHeader>
          <AlertDialogTitle>Decline this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-foreground wrap-break-word">{booking.space.name}</span>
            <br />
            {booking.guest.name}, {when}
            <br />
            {booking.guest.name} will see it as declined. You can't undo this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {declineBooking.isError && (
          <p
            role="alert"
            className="flex items-center justify-center gap-2 text-sm text-destructive sm:justify-start"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {errorMessage(declineBooking.error, 'Could not decline the booking. Please try again.')}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            className="h-11 rounded-full focus-visible:ring-ring md:h-9"
            disabled={declineBooking.isPending}
          >
            Keep booking
          </AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction: that one closes the dialog before the decline finishes */}
          <Button
            className="h-11 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:h-9"
            aria-disabled={declineBooking.isPending}
            onClick={confirm}
          >
            {declineBooking.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <X aria-hidden="true" />
            )}
            {declineBooking.isPending ? 'Declining…' : 'Decline'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
