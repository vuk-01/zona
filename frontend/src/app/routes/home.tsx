import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { FavoriteHeart } from '@/app/favorite-heart'
import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { CategoryRow } from '@/features/spaces/components/category-row'
import { FeaturedSpace } from '@/features/spaces/components/featured-space'
import { LiveStats } from '@/features/spaces/components/live-stats'
import { SpaceSearch } from '@/features/spaces/components/space-search'
import { SpacesList } from '@/features/spaces/components/spaces-list'
import { useCategoryStats } from '@/features/spaces/hooks/use-category-stats'

// Guest home (slika2): the hero panel with search and categories (with counts), the newest space on its
// right on large screens, then three listed spaces; the rest are on Explore ("See all").
export function Home() {
  const stats = useCategoryStats()

  return (
    <section className="flex flex-col gap-8 md:gap-12">
      <HeroPanel
        aside={
          <FeaturedSpace
            space={stats.newest}
            isLoading={stats.isLoading}
            action={stats.newest && <FavoriteHeart space={stats.newest} />}
          />
        }
      >
        <div className="flex flex-col gap-2">
          <PageTitle>Find your zone</PageTitle>
          <LiveStats stats={stats} />
        </div>
        <SpaceSearch />
        <CategoryRow counts={stats.counts} />
      </HeroPanel>

      <section aria-labelledby="spaces-near-you" className="flex flex-col gap-4">
        <Reveal>
          <div className="flex items-center justify-between gap-4">
            <h2 id="spaces-near-you" className="text-lg font-semibold">
              Spaces near you
            </h2>
            <Button
              asChild
              variant="outline"
              className="group h-11 shrink-0 rounded-full px-5 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9 md:px-4"
            >
              <Link to="/spaces">
                See all
                <ArrowRight
                  className="transition-transform duration-200 motion-safe:group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </Button>
          </div>
        </Reveal>
        <SpacesList
          filters={{ status: 'listed' }}
          limit={3}
          cardAction={(space) => <FavoriteHeart space={space} />}
        />
      </section>
    </section>
  )
}
