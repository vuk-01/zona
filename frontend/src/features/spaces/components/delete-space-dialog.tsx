import { CircleAlert, Loader2, Trash2 } from 'lucide-react'
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
import { ApiError, errorMessage } from '@/lib/api-client'

import { useDeleteSpace } from '../api/use-spaces'
import type { Space } from '../types'

type DeleteSpaceDialogProps = {
  space: Pick<Space, 'id' | 'name' | 'status' | 'bookingCounts'>
  // Called after the delete. The list then moves focus, since this card and its button are gone.
  onDeleted?: (space: Pick<Space, 'id' | 'name'>) => void
}

const bookingsText = (count: number) => `${count} active ${count === 1 ? 'booking' : 'bookings'}`

// "Delete" button with a dialog. A space with active bookings cannot be deleted: the dialog then
// explains why and only offers "OK". Otherwise it asks for confirmation, stays open while deleting
// and on an error; on success the space disappears from the list, and the dialog with it.
export function DeleteSpaceDialog({ space, onDeleted }: DeleteSpaceDialogProps) {
  const [open, setOpen] = useState(false)
  const deleteSpace = useDeleteSpace()

  // The count comes with the host's listing; the API checks again (409) in case it changed since, and
  // then says how many in its detail ("This space has 2 active bookings").
  const refused =
    deleteSpace.error instanceof ApiError && deleteSpace.error.code === 'space_has_active_bookings'
  const activeBookings = space.bookingCounts?.active ?? 0
  const isBlocked = refused || activeBookings > 0

  // mutateAsync, not mutate(…, { onSuccess }): mutate callbacks are skipped once this component
  // unmounts, and it does unmount as soon as the refetched list no longer has this space.
  const confirm = async () => {
    if (deleteSpace.isPending) return
    try {
      await deleteSpace.mutateAsync(space.id)
      setOpen(false)
      onDeleted?.(space)
    } catch {
      // Shown in the dialog: the blocked text for a 409, an error line for anything else
    }
  }

  const onOpenChange = (next: boolean) => {
    if (deleteSpace.isPending) return
    setOpen(next)
    // On open and on close: a 409 from last time never keeps the dialog blocked
    deleteSpace.reset()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          aria-label={`Delete ${space.name}`}
          className="h-11 rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring md:h-9"
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-xl bg-card shadow-soft">
        {isBlocked ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="wrap-break-word">
                You can't delete {space.name} yet
              </AlertDialogTitle>
              <AlertDialogDescription>
                {refused ? (
                  <>
                    {errorMessage(deleteSpace.error)}. You can delete it once its bookings are finished or
                    cancelled.
                  </>
                ) : (
                  <>
                    It has {bookingsText(activeBookings)}. You can delete it once{' '}
                    {activeBookings === 1 ? 'it is' : 'they are'} finished or cancelled.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-11 rounded-full focus-visible:ring-ring md:h-9">
                OK
              </AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="wrap-break-word">Delete {space.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {space.status === 'draft'
                  ? "It was never listed, so no guest has seen it. This can't be undone."
                  : "Guests will no longer see it. This can't be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteSpace.isError && (
              <p
                role="alert"
                className="flex items-center justify-center gap-2 text-sm text-destructive sm:justify-start"
              >
                <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                {errorMessage(deleteSpace.error, 'Could not delete the space. Please try again.')}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel
                className="h-11 rounded-full focus-visible:ring-ring md:h-9"
                disabled={deleteSpace.isPending}
              >
                Cancel
              </AlertDialogCancel>
              {/* A plain Button, not AlertDialogAction: that one closes the dialog before the delete finishes */}
              <Button
                className="h-11 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:h-9"
                aria-disabled={deleteSpace.isPending}
                onClick={confirm}
              >
                {deleteSpace.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                {deleteSpace.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
