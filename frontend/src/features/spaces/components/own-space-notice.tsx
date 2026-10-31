import { House } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

type OwnSpaceNoticeProps = {
  spaceId: number
}

// In place of the booking form when the signed-in user is the space's host: a host cannot book their own
// space (the backend answers 403 cannot_book_own_space), so they get links to manage it instead.
export function OwnSpaceNotice({ spaceId }: OwnSpaceNoticeProps) {
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
          Guests book it here. Change its details or answer booking requests from host mode.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          className="h-11 rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
        >
          <Link to={`/host/spaces/${spaceId}/edit`}>Edit space</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-full px-6 focus-visible:ring-ring md:h-9">
          <Link to="/host/reservations">Reservations</Link>
        </Button>
      </div>
    </section>
  )
}
