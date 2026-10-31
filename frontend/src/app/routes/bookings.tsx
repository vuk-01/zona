import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { BookingsList } from '@/features/bookings/components/bookings-list'

// Wrapped in RequireAuth, so the user is signed in once the page renders. Each booking carries a
// summary of its space (name, address, cover photo), so this route loads no spaces. The title sits in
// the list's hero panel, next to the tabs.
export function Bookings() {
  const { data: user } = useCurrentUser()

  const title = <PageTitle>My bookings</PageTitle>

  return (
    <section>
      {user ? <BookingsList view="guest" userId={user.id} title={title} /> : <HeroPanel>{title}</HeroPanel>}
    </section>
  )
}
