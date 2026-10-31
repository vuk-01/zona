import { useMemo } from 'react'

import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { BookingsList } from '@/features/bookings/components/bookings-list'
import { MAX_PAGE_SIZE } from '@/features/spaces/api/spaces-api'
import { useSpaces } from '@/features/spaces/api/use-spaces'
import type { Space } from '@/features/spaces/types'

// Wrapped in RequireAuth mode="host" in the router, so the user is a host once the page renders. The
// bookings of the host's spaces, laid out like the guest's My bookings: the title and the tabs (Pending,
// Upcoming, Past) share the hero panel. This route joins in the host's spaces: the cover photo, and what
// approving a booking checks. If they fail to load, the bookings still show with a placeholder photo.
export function HostReservations() {
  const { data: user } = useCurrentUser()
  const { data: spaces, isError } = useSpaces({ hostId: user?.id }, { size: MAX_PAGE_SIZE })

  const spacesById = useMemo(() => {
    if (isError) return new Map<number, Space>()
    return spaces && new Map(spaces.items.map((space) => [space.id, space]))
  }, [spaces, isError])

  const title = <PageTitle>Reservations</PageTitle>

  return (
    <section>
      {user ? (
        <BookingsList view="host" userId={user.id} spaces={spacesById} title={title} />
      ) : (
        <HeroPanel>{title}</HeroPanel>
      )}
    </section>
  )
}
