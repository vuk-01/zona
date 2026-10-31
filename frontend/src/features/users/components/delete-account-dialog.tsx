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
import { errorMessage } from '@/lib/api-client'
import type { User } from '@/lib/user'

import { useDeleteAccount } from '../api/use-users'

type DeleteAccountDialogProps = {
  user: Pick<User, 'id'>
  // Leaves the page; runs before the session is cleared (see deleteAccountOptions)
  onDeleted?: () => void
}

// "Delete account" with a confirmation, in the style of the space delete dialog: it stays open while
// deleting and on an error, which it shows above the buttons. On success the session ends and the
// route has already left the page, so the dialog goes with it.
export function DeleteAccountDialog({ user, onDeleted }: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const deleteAccount = useDeleteAccount(onDeleted)

  const confirm = () => {
    if (deleteAccount.isPending) return
    deleteAccount.mutate(user.id)
  }

  const onOpenChange = (next: boolean) => {
    if (deleteAccount.isPending) return
    setOpen(next)
    // On open and on close: an error from last time is not shown again
    deleteAccount.reset()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-full rounded-full border-destructive bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring md:h-9 md:w-auto"
        >
          <Trash2 aria-hidden="true" />
          Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-xl bg-card shadow-soft">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            Your profile, spaces, bookings and favorites will be deleted and you will be logged out. This
            can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteAccount.isError && (
          <p
            role="alert"
            className="flex items-center justify-center gap-2 text-sm text-destructive sm:justify-start"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {errorMessage(deleteAccount.error, 'Could not delete your account. Please try again.')}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            className="h-11 rounded-full focus-visible:ring-ring md:h-9"
            disabled={deleteAccount.isPending}
          >
            Cancel
          </AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction: that one closes the dialog before the delete finishes */}
          <Button
            className="h-11 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:h-9"
            aria-disabled={deleteAccount.isPending}
            onClick={confirm}
          >
            {deleteAccount.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            {deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
