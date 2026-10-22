import { useMemo } from 'react'

import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { BookingsList } from '@/features/bookings/components/bookings-list'
import { useSpaces } from '@/features/spaces/api/use-spaces'

// Wrapped in RequireAuth, so the user is signed in once the page renders. The bookings feature does
// not load spaces: this route joins in each space's cover photo. If the spaces fail to load, the
// bookings still show, with a placeholder instead of the photo. The title sits in the list's hero panel,
// next to the tabs.
export function Bookings() {
  const { data: user } = useCurrentUser()
  const { data: spaces, isError } = useSpaces()

  const spaceImages = useMemo(() => {
    if (isError) return new Map<number, string>()
    return spaces && new Map(spaces.map((space) => [space.id, space.images[0]]))
  }, [spaces, isError])

  const title = <PageTitle>My bookings</PageTitle>

  return (
    <section>
      {user ? (
        <BookingsList guestId={user.id} spaceImages={spaceImages} title={title} />
      ) : (
        <HeroPanel>{title}</HeroPanel>
      )}
    </section>
  )
}
