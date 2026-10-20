import { CircleAlert, Loader2, X } from 'lucide-react'
import { useState } from 'react'

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
import type { Booking } from '@/lib/booking'

import { useCancelBooking } from '../api/use-bookings'
import { formatBookingDate } from './format-booking'

type CancelBookingDialogProps = {
  booking: Booking
  // Called after the cancel. The booking then moves to Past, so the list moves focus.
  onCancelled?: (booking: Booking) => void
}

// "Cancel booking" with a confirmation, for a pending or confirmed booking. The dialog stays open while
// cancelling and on an error, like deleting a space.
export function CancelBookingDialog({ booking, onCancelled }: CancelBookingDialogProps) {
  const [open, setOpen] = useState(false)
  const cancelBooking = useCancelBooking()
  const when = `${formatBookingDate(booking.date)}, ${booking.startTime}–${booking.endTime}`

  // mutateAsync, not mutate(…, { onSuccess }): this card unmounts as soon as the refetched list moves
  // the booking to Past, and mutate callbacks are skipped after that.
  const confirm = async () => {
    if (cancelBooking.isPending) return
    try {
      await cancelBooking.mutateAsync(booking.id)
      setOpen(false)
      onCancelled?.(booking)
    } catch {
      // Shown in the dialog
    }
  }

  const onOpenChange = (next: boolean) => {
    if (cancelBooking.isPending) return
    setOpen(next)
    if (!next) cancelBooking.reset()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          aria-label={`Cancel booking at ${booking.space.name}, ${when}`}
          className="h-11 rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring md:h-9"
        >
          <X aria-hidden="true" />
          Cancel booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-xl bg-card shadow-soft">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel your booking?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-foreground wrap-break-word">{booking.space.name}</span>
            <br />
            {when}
            <br />
            {booking.status === 'confirmed'
              ? 'The slot opens up for other guests again.'
              : 'The host has not confirmed it yet, so it is simply withdrawn.'}{' '}
            You can't undo this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {cancelBooking.isError && (
          <p
            role="alert"
            className="flex items-center justify-center gap-2 text-sm text-destructive sm:justify-start"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            Could not cancel the booking. Please try again.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            className="h-11 rounded-full focus-visible:ring-ring md:h-9"
            disabled={cancelBooking.isPending}
          >
            Keep booking
          </AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction: that one closes the dialog before the cancel finishes */}
          <Button
            className="h-11 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:h-9"
            aria-disabled={cancelBooking.isPending}
            onClick={confirm}
          >
            {cancelBooking.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <X aria-hidden="true" />
            )}
            {cancelBooking.isPending ? 'Cancelling…' : 'Cancel booking'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
