import type { User } from '@/lib/user'

import { DeleteAccountDialog } from './delete-account-dialog'

type DeleteAccountCardProps = {
  user: Pick<User, 'id'>
  // Passed on to DeleteAccountDialog: the route goes home
  onDeleted?: () => void
}

// Last card of Profile: deleting the account, below the mode, so it is never the first thing in reach.
export function DeleteAccountCard({ user, onDeleted }: DeleteAccountCardProps) {
  return (
    <section
      aria-labelledby="delete-account-heading"
      className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="delete-account-heading" className="text-lg font-semibold">
          Delete account
        </h2>
        <p className="text-sm text-muted-foreground">
          Removes your profile together with your spaces, bookings and favorites.
        </p>
      </div>
      <div>
        <DeleteAccountDialog user={user} onDeleted={onDeleted} />
      </div>
    </section>
  )
}
