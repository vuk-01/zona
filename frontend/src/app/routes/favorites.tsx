import { Heart } from 'lucide-react'
import { Link } from 'react-router'

import { FavoriteHeart } from '@/app/favorite-heart'
import { EmptyState, emptyStateAction } from '@/components/feedback/empty-state'
import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { useFavoriteIds } from '@/features/favorites/api/use-favorites'
import { SpacesList } from '@/features/spaces/components/spaces-list'

// Wrapped in RequireAuth, so the user is signed in once the page renders. The cards come from
// GET /spaces?favoriteOf= (newest saved first); the hearts' own query (favorites feature) takes a
// removed space out of the grid right away, before that list reloads.
export function Favorites() {
  const { data: user } = useCurrentUser()
  const { data: favoriteIds } = useFavoriteIds(user?.id)

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <HeroPanel>
        <div className="flex flex-col gap-2">
          <PageTitle>Favorites</PageTitle>
          <p className="text-muted-foreground">The spaces you saved, ready for your next booking.</p>
        </div>
      </HeroPanel>
      {user && (
        <SpacesList
          filters={{ status: 'listed', favoriteOf: user.id }}
          only={favoriteIds}
          showCount
          cardAction={(space) => <FavoriteHeart space={space} />}
          empty={
            <EmptyState
              icon={Heart}
              title="No favorites yet"
              text="Tap the heart on any space to save it here."
              action={
                <Button asChild className={emptyStateAction}>
                  <Link to="/spaces">Explore spaces</Link>
                </Button>
              }
            />
          }
        />
      )}
    </section>
  )
}
