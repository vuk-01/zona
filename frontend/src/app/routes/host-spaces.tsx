import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { StatusNotice } from '@/components/feedback/status-notice'
import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { HostSpacesList } from '@/features/spaces/components/host-spaces-list'
import { useSavedNotice } from '@/features/spaces/hooks/use-saved-notice'

// Wrapped in RequireAuth mode="host" in the router, so the user is a host once the page renders.
// The title and "Add a space" share the hero panel, like the guest pages; the cards are below it.
export function HostSpaces() {
  const { data: user } = useCurrentUser()
  // "Glass Room is published" after the space form sends the host back here
  const notice = useSavedNotice()

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <HeroPanel>
        {/* Phones: the CTA is a full-width pill under the title; md+: auto width next to it */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <PageTitle>My spaces</PageTitle>
          <Button
            asChild
            className="h-11 w-full rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:h-9 md:w-auto"
          >
            <Link to="/host/spaces/new">
              <Plus aria-hidden="true" />
              Add a space
            </Link>
          </Button>
        </div>
      </HeroPanel>
      <StatusNotice notice={notice} />
      {user && <HostSpacesList hostId={user.id} />}
    </section>
  )
}
