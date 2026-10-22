import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { StatusNotice } from '@/components/feedback/status-notice'
import { PageTitle } from '@/components/layout/page-title'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { HostSpacesList } from '@/features/spaces/components/host-spaces-list'
import { useSavedNotice } from '@/features/spaces/hooks/use-saved-notice'

// Wrapped in RequireAuth mode="host" in the router, so the user is a host once the page renders.
export function HostSpaces() {
  const { data: user } = useCurrentUser()
  // "Glass Room is published" after the space form sends the host back here
  const notice = useSavedNotice()

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>My spaces</PageTitle>
        <Button
          asChild
          className="h-11 rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:h-9 md:focus-visible:ring-offset-background"
        >
          <Link to="/host/spaces/new">
            <Plus aria-hidden="true" />
            Add a space
          </Link>
        </Button>
      </div>
      <StatusNotice notice={notice} className="mt-6" />
      {user && <HostSpacesList hostId={user.id} />}
    </section>
  )
}
