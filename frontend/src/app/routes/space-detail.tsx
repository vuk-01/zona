import { MapPinOff } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { FavoriteHeart } from '@/app/favorite-heart'
import { useLoginDialog } from '@/app/login-dialog'
import { EmptyState, emptyStateAction } from '@/components/feedback/empty-state'
import { PageTitle } from '@/components/layout/page-title'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { BookingForm } from '@/features/bookings/components/booking-form'
import { PopularTimes } from '@/features/bookings/components/popular-times'
import { useSpace } from '@/features/spaces/api/use-spaces'
import { OpeningHours } from '@/features/spaces/components/opening-hours'
import { SpaceDetailSkeleton } from '@/features/spaces/components/space-detail-skeleton'
import { SpaceGallery } from '@/features/spaces/components/space-gallery'
import { SpaceSummary } from '@/features/spaces/components/space-summary'
import { canView } from '@/features/spaces/types'
import { HostCard } from '@/features/users/components/host-card'
import { isNotFound } from '@/lib/api-client'

// A space: gallery, details, opening hours and host on the left; booking on the right (fixed bar on phones).
export function SpaceDetail() {
  const { id } = useParams()
  // "/spaces/abc" gives NaN, which the API answers with 422; isNotFound treats it like an unknown id (404)
  const { data: space, isLoading, error, refetch, isRefetching } = useSpace(Number(id))
  const { data: user, isPending: userPending } = useCurrentUser()
  const openLogin = useLoginDialog()

  if (isLoading || (space && space.status === 'draft' && userPending)) return <SpaceDetailSkeleton />

  if (isNotFound(error) || (space && !canView(space, user?.id))) {
    return (
      <EmptyState
        icon={MapPinOff}
        title={<PageTitle>Space not found</PageTitle>}
        text="This space does not exist or is no longer listed."
        action={
          <Button asChild className={emptyStateAction}>
            <Link to="/spaces">Explore other spaces</Link>
          </Button>
        }
      />
    )
  }

  if (error || !space) {
    return (
      <section role="alert" className="flex flex-col items-start gap-4">
        <PageTitle>Space details</PageTitle>
        <p className="text-destructive">This space failed to load.</p>
        <Button
          variant="outline"
          className="h-11 rounded-full focus-visible:ring-ring md:h-9"
          disabled={isRefetching}
          onClick={() => refetch()}
        >
          Try again
        </Button>
      </section>
    )
  }

  return (
    // Phones: overview, booking, then the rest (pb-24 leaves room for the fixed booking bar).
    // lg: two columns, booking on the right next to both parts.
    <section className="flex flex-col gap-8 pb-24 md:pb-0 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:gap-x-12">
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-4">
          {/* A draft is only seen by its host and never shows in Favorites, so it has no heart */}
          <div className="flex items-start justify-between gap-4">
            <PageTitle>{space.name}</PageTitle>
            {space.status === 'listed' && <FavoriteHeart space={space} placement="page" />}
          </div>
          <SpaceSummary space={space} />
        </div>
        <SpaceGallery images={space.images} name={space.name} />
      </div>

      <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <BookingForm
          space={space}
          user={userPending ? undefined : (user ?? null)}
          onLogin={(continueWith) => openLogin({ continueWith })}
        />
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        {space.description && (
          <section aria-labelledby="about-heading" className="flex flex-col gap-3">
            <h2 id="about-heading" className="text-lg font-semibold">
              About this space
            </h2>
            <p className="text-muted-foreground">{space.description}</p>
          </section>
        )}
        <section aria-labelledby="hours-heading" className="flex flex-col gap-3">
          <h2 id="hours-heading" className="text-lg font-semibold">
            Opening hours
          </h2>
          <OpeningHours hours={space.openingHours} />
        </section>
        <PopularTimes spaceId={space.id} />
        <section aria-labelledby="host-heading" className="flex flex-col gap-3">
          <h2 id="host-heading" className="text-lg font-semibold">
            Your host
          </h2>
          <HostCard userId={space.host.id} />
        </section>
      </div>
    </section>
  )
}
