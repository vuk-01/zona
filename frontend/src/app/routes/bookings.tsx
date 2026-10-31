import { useMemo } from 'react'

import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { BookingsList } from '@/features/bookings/components/bookings-list'
import { useSpaces } from '@/features/spaces/api/use-spaces'
import type { Space } from '@/features/spaces/types'
import { MAX_PAGE_SIZE } from '@/lib/api-client'

// Wrapped in RequireAuth, so the user is signed in once the page renders. The bookings feature does
// not load spaces: this route joins in each space (for its cover photo). If the spaces fail to load, the
// bookings still show, with a placeholder instead of the photo. The title sits in the list's hero panel,
// next to the tabs.
export function Bookings() {
  const { data: user } = useCurrentUser()
  const { data: spaces, isError } = useSpaces({}, { size: MAX_PAGE_SIZE })

  const spacesById = useMemo(() => {
    if (isError) return new Map<number, Space>()
    return spaces && new Map(spaces.items.map((space) => [space.id, space]))
  }, [spaces, isError])

  const title = <PageTitle>My bookings</PageTitle>

  return (
    <section>
      {user ? (
        <BookingsList view="guest" userId={user.id} spaces={spacesById} title={title} />
      ) : (
        <HeroPanel>{title}</HeroPanel>
      )}
    </section>
  )
}
