import { House, Loader2 } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

type OwnSpaceNoticeProps = {
  spaceId: number
  // Set in guest mode: the host pages need host mode, so a button switches to it first and then goes
  // to `to`. Without it (host mode) the buttons are plain links.
  onManage?: (to: string) => void
  // Where the switch that is saving goes next; that button shows a spinner and both wait
  managingTo?: string
  // The switch to host mode failed
  manageFailed?: boolean
}

const primaryClass = 'h-11 rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9'
const outlineClass = 'h-11 rounded-full px-6 focus-visible:ring-ring md:h-9'

// In place of the booking form when the signed-in user is the space's host: a host cannot book their own
// space (the backend answers 403 cannot_book_own_space), so they get links to manage it instead.
export function OwnSpaceNotice({
  spaceId,
  onManage,
  managingTo,
  manageFailed = false,
}: OwnSpaceNoticeProps) {
  const editTo = `/host/spaces/${spaceId}/edit`
  const reservationsTo = '/host/reservations'
  const managing = managingTo !== undefined

  return (
    <section
      aria-labelledby="own-space-heading"
      className="flex flex-col gap-4 rounded-lg border bg-card p-6"
    >
      <House className="size-8 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h2 id="own-space-heading" className="text-lg font-semibold">
          This is your space
        </h2>
        <p className="text-sm text-muted-foreground">
          {onManage
            ? 'Guests book it here. Both buttons switch you to hosting first.'
            : 'Guests book it here. Change its details or answer booking requests from host mode.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {onManage ? (
          <>
            {/* aria-disabled instead of disabled, so keyboard focus stays on the button while it saves */}
            <Button
              className={primaryClass}
              aria-disabled={managing}
              onClick={() => {
                if (!managing) onManage(editTo)
              }}
            >
              {managingTo === editTo && <Loader2 className="animate-spin" aria-hidden />}
              Edit space
            </Button>
            <Button
              variant="outline"
              className={outlineClass}
              aria-disabled={managing}
              onClick={() => {
                if (!managing) onManage(reservationsTo)
              }}
            >
              {managingTo === reservationsTo && <Loader2 className="animate-spin" aria-hidden />}
              Reservations
            </Button>
          </>
        ) : (
          <>
            <Button asChild className={primaryClass}>
              <Link to={editTo}>Edit space</Link>
            </Button>
            <Button asChild variant="outline" className={outlineClass}>
              <Link to={reservationsTo}>Reservations</Link>
            </Button>
          </>
        )}
      </div>
      {manageFailed && (
        <p role="alert" className="text-sm text-destructive">
          Could not switch to hosting. Please try again.
        </p>
      )}
    </section>
  )
}
