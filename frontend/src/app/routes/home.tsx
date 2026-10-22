import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { Reveal } from '@/components/motion/reveal'
import { CategoryRow } from '@/features/spaces/components/category-row'
import { FeaturedSpace } from '@/features/spaces/components/featured-space'
import { LiveStats } from '@/features/spaces/components/live-stats'
import { SpaceSearch } from '@/features/spaces/components/space-search'
import { SpacesList } from '@/features/spaces/components/spaces-list'
import { useCategoryStats } from '@/features/spaces/hooks/use-category-stats'

// Guest home (slika2): the hero panel with search and categories (with counts), the newest space on its
// right on large screens, then a few listed spaces.
export function Home() {
  const stats = useCategoryStats()

  return (
    <section className="flex flex-col gap-8 md:gap-12">
      <HeroPanel aside={<FeaturedSpace space={stats.newest} isLoading={stats.isLoading} />}>
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
            <Link
              to="/spaces"
              className="group inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0"
            >
              See all
              <ArrowRight
                className="size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
        </Reveal>
        <SpacesList filters={{ status: 'listed' }} limit={6} />
      </section>
    </section>
  )
}
