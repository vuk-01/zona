import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { BookingsList } from '@/features/bookings/components/bookings-list'

// Wrapped in RequireAuth mode="host" in the router, so the user is a host once the page renders. The
// bookings of the host's spaces, laid out like the guest's My bookings: the title and the tabs (Pending,
// Upcoming, Past & cancelled) share the hero panel. Each booking carries a summary of its space and the
// backend checks the overlap rule on approve, so this route loads no spaces.
export function HostReservations() {
  const { data: user } = useCurrentUser()

  const title = <PageTitle>Reservations</PageTitle>

  return (
    <section>
      {user ? <BookingsList view="host" userId={user.id} title={title} /> : <HeroPanel>{title}</HeroPanel>}
    </section>
  )
}
